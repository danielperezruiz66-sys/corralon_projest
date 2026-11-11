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
from django.utils import timezone

from ..models import (
    Deposito,
    DetalleStock,
    MovimientoStock,
    ProductoXSucursal,
    Stock,
    TransferenciaStock,
)


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
def ajustar_stock(stock, cantidad_nueva, deposito=None, motivo=''):
    """Fija el stock en una cantidad y registra el ajuste en el libro."""
    stock = Stock.objects.select_for_update().get(pk=stock.pk)
    cantidad_nueva = _decimal(cantidad_nueva)
    if cantidad_nueva < stock.cant_negativa_max:
        raise ValueError(
            f'La cantidad no puede ser menor al limite negativo '
            f'({stock.cant_negativa_max}).'
        )

    total_actual = stock.detalles.aggregate(total=Sum('cantidad'))['total']
    total_actual = total_actual if total_actual is not None else Decimal('0.000')
    diferencia = cantidad_nueva - total_actual
    if diferencia == 0:
        return stock

    referencia = f'ajuste: {motivo}'.strip()
    if diferencia > 0:
        deposito = deposito or deposito_predeterminado(stock.sucursal)
        if deposito.sucursal_id != stock.sucursal_id:
            raise ValueError(
                'El deposito debe pertenecer a la sucursal del stock.'
            )
        detalle = DetalleStock.objects.create(
            stock=stock,
            deposito=deposito,
            lote=None,
            cantidad=diferencia,
        )
        MovimientoStock.objects.create(
            stock=stock,
            detalle_stock=detalle,
            tipo=MovimientoStock.TipoMovimiento.AJUSTE,
            cantidad=diferencia,
            referencia=referencia,
        )
    else:
        restante = abs(diferencia)
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
            MovimientoStock.objects.create(
                stock=stock,
                detalle_stock=detalle,
                tipo=MovimientoStock.TipoMovimiento.AJUSTE,
                cantidad=-tomar,
                referencia=referencia,
            )
            restante -= tomar

        if restante > 0:
            detalle = DetalleStock.objects.create(
                stock=stock,
                deposito=deposito_predeterminado(stock.sucursal),
                lote=None,
                cantidad=-restante,
            )
            MovimientoStock.objects.create(
                stock=stock,
                detalle_stock=detalle,
                tipo=MovimientoStock.TipoMovimiento.AJUSTE,
                cantidad=-restante,
                referencia=referencia,
            )

    recalcular_stock(stock)
    return stock


@transaction.atomic
def cargar_stock_sucursal(sucursal, deposito, items, motivo):
    """Carga stock de varios productos en una sucursal y deposito."""
    if not items:
        raise ValueError('Agrega al menos un producto para cargar stock.')
    if deposito.sucursal_id != sucursal.id:
        raise ValueError('El deposito debe pertenecer a la sucursal elegida.')

    motivo = (motivo or '').strip()
    if not motivo:
        raise ValueError('Indica el motivo de la carga de stock.')

    vistos = set()
    stocks = []
    for item in items:
        producto = item['producto']
        if producto.pk in vistos:
            raise ValueError(
                f'El producto "{producto}" esta repetido en la carga.'
            )
        vistos.add(producto.pk)

        if not ProductoXSucursal.objects.filter(
            producto=producto,
            sucursal=sucursal,
            estado=True,
        ).exists():
            raise ValueError(
                f'El producto "{producto}" no esta activo en la sucursal.'
            )

        cantidad = _decimal(item['cantidad'])
        if cantidad <= 0:
            raise ValueError('La cantidad debe ser mayor que cero.')

        lote = (item.get('lote') or '').strip()
        if not lote:
            raise ValueError(
                f'Indica el lote del producto "{producto}".'
            )

        stock = obtener_stock(producto, sucursal)
        reponer_stock(
            stock,
            cantidad,
            deposito,
            lote=lote,
            fecha_venc=item.get('fecha_venc'),
            referencia=f'carga-stock: {motivo}',
            tipo=MovimientoStock.TipoMovimiento.AJUSTE,
        )
        stocks.append(stock)

    return stocks


@transaction.atomic
def crear_transferencia(
    producto,
    deposito_origen,
    deposito_destino,
    cantidad,
    lote=None,
    motivo='',
):
    """Descuenta de un deposito y deja la mercaderia en transito."""
    cantidad = _decimal(cantidad)
    if cantidad <= 0:
        raise ValueError('La cantidad a transferir debe ser mayor que cero.')
    if deposito_origen.pk == deposito_destino.pk:
        raise ValueError('El deposito de origen y destino deben ser distintos.')
    if deposito_origen.sucursal_id is None or deposito_destino.sucursal_id is None:
        raise ValueError('Los depositos deben tener una sucursal asignada.')

    stock_origen = obtener_stock(producto, deposito_origen.sucursal)
    detalles = stock_origen.detalles.select_for_update().filter(
        deposito=deposito_origen,
        cantidad__gt=0,
    )
    if lote:
        detalles = detalles.filter(lote=lote)
    disponible = (
        detalles.aggregate(total=Sum('cantidad'))['total']
        or Decimal('0.000')
    )
    if disponible < cantidad:
        raise ValueError(
            f'No hay stock suficiente en {deposito_origen}. '
            f'Disponible: {disponible}.'
        )

    transferencia = TransferenciaStock.objects.create(
        producto=producto,
        stock_origen=stock_origen,
        deposito_origen=deposito_origen,
        deposito_destino=deposito_destino,
        cantidad=cantidad,
        lote=lote or None,
        motivo=motivo,
        estado=TransferenciaStock.EstadoTransferencia.EN_TRANSITO,
    )

    restante = cantidad
    detalles = detalles.order_by(
        F('fecha_venc').asc(nulls_last=True),
        'fecha_ingreso',
        'id',
    )
    for detalle in detalles:
        if restante <= 0:
            break
        tomar = min(detalle.cantidad, restante)
        detalle.cantidad -= tomar
        detalle.save(update_fields=['cantidad'])
        MovimientoStock.objects.create(
            stock=stock_origen,
            detalle_stock=detalle,
            tipo=MovimientoStock.TipoMovimiento.TRANSFERENCIA,
            cantidad=-tomar,
            referencia=f'transferencia:{transferencia.id}',
        )
        restante -= tomar

    recalcular_stock(stock_origen)
    return transferencia


@transaction.atomic
def recibir_transferencia(transferencia):
    """Confirma la transferencia e ingresa la mercaderia en destino."""
    transferencia = TransferenciaStock.objects.select_for_update().get(
        pk=transferencia.pk,
    )
    if (
        transferencia.estado
        != TransferenciaStock.EstadoTransferencia.EN_TRANSITO
    ):
        raise ValueError('La transferencia no esta en transito.')

    stock_destino = obtener_stock(
        transferencia.producto,
        transferencia.deposito_destino.sucursal,
    )
    detalle = DetalleStock.objects.create(
        stock=stock_destino,
        deposito=transferencia.deposito_destino,
        lote=transferencia.lote,
        cantidad=transferencia.cantidad,
    )
    MovimientoStock.objects.create(
        stock=stock_destino,
        detalle_stock=detalle,
        tipo=MovimientoStock.TipoMovimiento.TRANSFERENCIA,
        cantidad=transferencia.cantidad,
        referencia=f'transferencia:{transferencia.id}',
    )
    recalcular_stock(stock_destino)

    transferencia.estado = TransferenciaStock.EstadoTransferencia.RECIBIDA
    transferencia.fecha_recepcion = timezone.now()
    transferencia.save(update_fields=['estado', 'fecha_recepcion'])
    return transferencia


@transaction.atomic
def cancelar_transferencia(transferencia):
    """Cancela una transferencia en transito y devuelve el stock al origen."""
    transferencia = TransferenciaStock.objects.select_for_update().get(
        pk=transferencia.pk,
    )
    if (
        transferencia.estado
        != TransferenciaStock.EstadoTransferencia.EN_TRANSITO
    ):
        raise ValueError('La transferencia no esta en transito.')

    stock_origen = Stock.objects.select_for_update().get(
        pk=transferencia.stock_origen_id,
    )
    detalle = DetalleStock.objects.create(
        stock=stock_origen,
        deposito=transferencia.deposito_origen,
        lote=transferencia.lote,
        cantidad=transferencia.cantidad,
    )
    MovimientoStock.objects.create(
        stock=stock_origen,
        detalle_stock=detalle,
        tipo=MovimientoStock.TipoMovimiento.TRANSFERENCIA,
        cantidad=transferencia.cantidad,
        referencia=f'transferencia:{transferencia.id}',
    )
    recalcular_stock(stock_origen)

    transferencia.estado = TransferenciaStock.EstadoTransferencia.CANCELADA
    transferencia.fecha_cancelacion = timezone.now()
    transferencia.save(update_fields=['estado', 'fecha_cancelacion'])
    return transferencia


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
