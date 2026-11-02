"""Movimientos y control de stock.

Reglas:

- `DetalleStock` es la fuente de verdad; `Stock.cantidad` es el total y se
  recalcula despues de cada movimiento.
- Las ventas consumen primero los lotes con vencimiento mas proximo (FEFO) y
  luego por antiguedad de ingreso (FIFO).
- Se permite stock negativo hasta `Stock.cant_negativa_max`. El excedente se
  registra como un `DetalleStock` negativo sin lote, para que la suma siga
  coincidiendo con el total.
- Cada movimiento queda en `MovimientoStock`, lo que permite revertir una venta
  cancelada sobre los mismos lotes.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import F, Sum

from ..models import Deposito, DetalleStock, MovimientoStock, Stock


class StockInsuficiente(Exception):
    """La operacion dejaria el stock por debajo del limite permitido."""


def _decimal(valor):
    return Decimal(str(valor))


def deposito_predeterminado(sucursal):
    deposito = Deposito.objects.filter(
        sucursal=sucursal,
        es_predeterminado=True,
    ).first()
    if deposito is None:
        raise ValueError(
            f'La sucursal {sucursal} no tiene un deposito predeterminado.'
        )
    return deposito


def nivel_alerta(stock):
    if stock.cantidad < 0:
        return 'NEGATIVO'
    if stock.cantidad <= stock.cant_min:
        return 'MINIMO'
    return 'OK'


@transaction.atomic
def recalcular_stock(stock):
    stock = Stock.objects.select_for_update().get(pk=stock.pk)
    total = stock.detalles.aggregate(total=Sum('cantidad'))['total']
    stock.cantidad = total if total is not None else Decimal('0.000')
    stock.save(update_fields=['cantidad'])
    return stock.cantidad


@transaction.atomic
def obtener_stock(producto, sucursal):
    stock, _ = Stock.objects.select_for_update().get_or_create(
        producto=producto,
        sucursal=sucursal,
        defaults={
            'cantidad': Decimal('0.000'),
            'cant_min': Decimal('0.000'),
            'cant_negativa_max': Decimal('-10.000'),
        },
    )
    return stock


def validar_limite(stock, cantidad):
    cantidad = _decimal(cantidad)
    if cantidad <= 0:
        raise ValueError('La cantidad debe ser mayor que cero.')
    nuevo_total = stock.cantidad - cantidad
    if nuevo_total < stock.cant_negativa_max:
        raise StockInsuficiente(
            f'Stock insuficiente para {stock.producto}: '
            f'disponible {stock.cantidad}, limite {stock.cant_negativa_max}, '
            f'solicitado {cantidad}.'
        )
    return nuevo_total


@transaction.atomic
def consumir_stock(stock, cantidad, referencia='', venta=None):
    """Descuenta `cantidad` del stock y devuelve los movimientos generados."""
    cantidad = _decimal(cantidad)
    stock = Stock.objects.select_for_update().get(pk=stock.pk)

    total_actual = stock.detalles.aggregate(total=Sum('cantidad'))['total']
    stock.cantidad = total_actual if total_actual is not None else Decimal('0.000')
    validar_limite(stock, cantidad)

    restante = cantidad
    movimientos = []
    detalles = (
        stock.detalles.select_for_update()
        .filter(cantidad__gt=0)
        .order_by(F('fecha_venc').asc(nulls_last=True), 'fecha_ingreso', 'id')
    )

    for detalle in detalles:
        if restante <= 0:
            break
        tomar = min(detalle.cantidad, restante)
        detalle.cantidad -= tomar
        detalle.save(update_fields=['cantidad'])
        movimientos.append(
            MovimientoStock.objects.create(
                stock=stock,
                detalle_stock=detalle,
                tipo=MovimientoStock.TipoMovimiento.VENTA,
                cantidad=-tomar,
                venta=venta,
                referencia=referencia,
            )
        )
        restante -= tomar

    if restante > 0:
        detalle_negativo = DetalleStock.objects.create(
            stock=stock,
            deposito=deposito_predeterminado(stock.sucursal),
            lote=None,
            cantidad=-restante,
        )
        movimientos.append(
            MovimientoStock.objects.create(
                stock=stock,
                detalle_stock=detalle_negativo,
                tipo=MovimientoStock.TipoMovimiento.VENTA,
                cantidad=-restante,
                venta=venta,
                referencia=referencia,
            )
        )

    recalcular_stock(stock)
    return movimientos


@transaction.atomic
def reponer_stock(
    stock,
    cantidad,
    deposito,
    lote=None,
    fecha_venc=None,
    referencia='',
    compra=None,
    tipo=MovimientoStock.TipoMovimiento.COMPRA,
):
    """Agrega un lote al stock y devuelve `(detalle, movimiento)`."""
    cantidad = _decimal(cantidad)
    if cantidad <= 0:
        raise ValueError('La cantidad debe ser mayor que cero.')
    if deposito.sucursal_id and deposito.sucursal_id != stock.sucursal_id:
        raise ValueError(
            'El deposito no pertenece a la sucursal del stock.'
        )

    stock = Stock.objects.select_for_update().get(pk=stock.pk)
    detalle = DetalleStock.objects.create(
        stock=stock,
        deposito=deposito,
        lote=lote,
        cantidad=cantidad,
        fecha_venc=fecha_venc,
    )
    movimiento = MovimientoStock.objects.create(
        stock=stock,
        detalle_stock=detalle,
        tipo=tipo,
        cantidad=cantidad,
        compra=compra,
        referencia=referencia,
    )
    recalcular_stock(stock)
    return detalle, movimiento


@transaction.atomic
def restaurar_stock(venta, referencia=''):
    """Revierte los movimientos de una venta cancelada."""
    ya_revertida = MovimientoStock.objects.filter(
        venta=venta,
        tipo=MovimientoStock.TipoMovimiento.CANCELACION,
    ).exists()
    if ya_revertida:
        return []

    movimientos = list(
        MovimientoStock.objects.select_for_update(of=('self',))
        .filter(
            venta=venta,
            tipo=MovimientoStock.TipoMovimiento.VENTA,
            cantidad__lt=0,
        )
        .select_related('detalle_stock', 'stock')
    )
    if not movimientos:
        return []

    reversos = []
    stocks_afectados = set()
    for movimiento in movimientos:
        cantidad = abs(movimiento.cantidad)
        detalle = movimiento.detalle_stock
        if detalle is None:
            detalle = DetalleStock.objects.create(
                stock=movimiento.stock,
                deposito=deposito_predeterminado(movimiento.stock.sucursal),
                lote=None,
                cantidad=cantidad,
            )
        else:
            detalle.cantidad += cantidad
            detalle.save(update_fields=['cantidad'])

        reversos.append(
            MovimientoStock.objects.create(
                stock=movimiento.stock,
                detalle_stock=detalle,
                tipo=MovimientoStock.TipoMovimiento.CANCELACION,
                cantidad=cantidad,
                venta=venta,
                referencia=referencia,
            )
        )
        stocks_afectados.add(movimiento.stock_id)

    for stock in Stock.objects.filter(pk__in=stocks_afectados):
        recalcular_stock(stock)

    return reversos
