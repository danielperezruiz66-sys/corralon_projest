"""Movimientos y control de stock.

Reglas:

- `DetalleStock` es la fuente de verdad; `Stock.cantidad` es el total y se
  recalcula despues de cada movimiento.
- Las ventas consumen primero los lotes con vencimiento mas proximo (FEFO) y
  luego por antiguedad de ingreso (FIFO).
- Se permite stock negativo hasta `Stock.cant_negativa_max`. El excedente se
  registra como un `DetalleStock` negativo sin lote, para que la suma siga
  coincidiendo con el total.
- Los lotes consumidos por una venta se guardan en `DetalleVenta.consumos`
  para poder restaurar el stock sobre los mismos lotes al anularla.
- Un lote vive en un solo deposito. Para moverlo entre depositos se usa
  `mover_lote` (lote completo); mover una parte exige un ajuste detallado.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import F, Sum

from ..models import (
    Deposito,
    DetalleStock,
    ProductoXSucursal,
    Stock,
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
def consumir_stock(stock, cantidad):
    """Descuenta `cantidad` del stock y devuelve los consumos generados.

    Cada consumo es un dict `{'detalle_stock': id, 'cantidad': 'str'}` para
    guardarlo en la linea de venta y poder restaurarlo despues.
    """
    cantidad = _decimal(cantidad)
    stock = Stock.objects.select_for_update().get(pk=stock.pk)

    total_actual = stock.detalles.aggregate(total=Sum('cantidad'))['total']
    stock.cantidad = total_actual if total_actual is not None else Decimal('0.000')
    validar_limite(stock, cantidad)

    restante = cantidad
    consumos = []
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
        consumos.append(
            {'detalle_stock': detalle.id, 'cantidad': str(tomar)}
        )
        restante -= tomar

    if restante > 0:
        detalle_negativo = DetalleStock.objects.create(
            stock=stock,
            deposito=deposito_predeterminado(stock.sucursal),
            lote=None,
            cantidad=-restante,
        )
        consumos.append(
            {
                'detalle_stock': detalle_negativo.id,
                'cantidad': str(restante),
            }
        )

    recalcular_stock(stock)
    return consumos


@transaction.atomic
def restaurar_stock(venta):
    """Revierte los consumos de una venta anulada sobre los mismos lotes.

    Si un lote consumido ya no existe, se repone la cantidad en un lote nuevo
    del deposito predeterminado de la sucursal del stock.
    """
    stocks_afectados = set()
    for renglon in venta.detalles.all():
        for consumo in renglon.consumos or []:
            detalle_id = consumo.get('detalle_stock')
            cantidad = _decimal(consumo.get('cantidad') or 0)
            if cantidad <= 0:
                continue

            detalle = (
                DetalleStock.objects.select_for_update()
                .filter(pk=detalle_id)
                .first()
            )
            if detalle is None:
                stock = Stock.objects.select_for_update().get(
                    producto=renglon.producto,
                    sucursal=venta.movimiento_caja.caja.sucursal,
                )
                detalle = DetalleStock.objects.create(
                    stock=stock,
                    deposito=deposito_predeterminado(stock.sucursal),
                    lote=None,
                    cantidad=cantidad,
                )
            else:
                detalle.cantidad += cantidad
                detalle.save(update_fields=['cantidad'])
            stocks_afectados.add(detalle.stock_id)

    for stock in Stock.objects.filter(pk__in=stocks_afectados):
        recalcular_stock(stock)

    return stocks_afectados


@transaction.atomic
def ajustar_stock_detallado(stock, reducciones, ingresos, motivo):
    """Ajusta stock por lote: reduce lotes existentes y/o crea nuevos ingresos.

    - `reducciones`: lista de dicts {detalle: DetalleStock|id, cantidad_nueva: Decimal|str}
      con 0 <= cantidad_nueva <= cantidad actual del detalle (solo quita, no agrega).
    - `ingresos`: lista de dicts {deposito: Deposito|id, cantidad: Decimal|str, fecha_venc?: date}
      que crean nuevos lotes (código LOT automático).
    """
    stock = Stock.objects.select_for_update().select_related(
        'producto__unidad',
        'sucursal',
    ).get(pk=stock.pk)

    reducciones = list(reducciones or [])
    ingresos = list(ingresos or [])
    if not reducciones and not ingresos:
        raise ValueError('Indicá al menos una reducción por lote o un ingreso de stock.')

    motivo = (motivo or '').strip()
    if len(motivo) < 3:
        raise ValueError('El motivo del ajuste debe tener al menos 3 caracteres.')

    nombre_unidad = str(getattr(stock.producto, 'unidad', '') or '')
    from ..utils import validar_cantidad_por_unidad

    cambios = Decimal('0.000')

    # Reducciones sobre lotes existentes (cantidad_nueva = cantidad resultante del lote).
    vistos = set()
    for item in reducciones:
        detalle_ref = item.get('detalle')
        detalle_id = detalle_ref.pk if hasattr(detalle_ref, 'pk') else detalle_ref
        if detalle_id in vistos:
            raise ValueError('Hay lotes repetidos en el ajuste.')
        vistos.add(detalle_id)

        detalle = (
            DetalleStock.objects.select_for_update()
            .select_related('deposito')
            .get(pk=detalle_id)
        )
        if detalle.stock_id != stock.id:
            raise ValueError(f'El lote "{detalle.lote}" no pertenece a este stock.')
        if detalle.deposito.sucursal_id != stock.sucursal_id:
            raise ValueError(
                f'El lote "{detalle.lote}" no pertenece a la sucursal del stock.'
            )

        cantidad_nueva = _decimal(item.get('cantidad_nueva'))
        error_cantidad = validar_cantidad_por_unidad(
            cantidad_nueva,
            nombre_unidad,
            etiqueta='La cantidad del lote',
            permitir_no_positiva=True,
        )
        if error_cantidad:
            raise ValueError(error_cantidad)
        if cantidad_nueva > detalle.cantidad:
            raise ValueError(
                f'La cantidad nueva del lote "{detalle.lote}" no puede ser mayor '
                f'a su stock actual ({detalle.cantidad}).'
            )
        if cantidad_nueva < 0:
            raise ValueError('La cantidad del lote no puede ser negativa.')

        diferencia = cantidad_nueva - detalle.cantidad
        if diferencia == 0:
            continue
        if diferencia > 0:
            raise ValueError(
                f'No se puede aumentar la cantidad del lote "{detalle.lote}" en este ajuste; '
                'usá un ingreso para agregar stock con un lote nuevo.'
            )

        detalle.cantidad = cantidad_nueva
        detalle._change_reason = f'Ajuste de stock: {motivo}'[:100]
        detalle.save(update_fields=['cantidad'])
        cambios += diferencia

    # Ingresos: siempre crean un nuevo lote (LOT automático).
    for item in ingresos:
        deposito_ref = item.get('deposito')
        deposito_id = (
            deposito_ref.pk if hasattr(deposito_ref, 'pk') else deposito_ref
        )
        deposito = Deposito.objects.select_for_update().get(pk=deposito_id)
        if deposito.sucursal_id != stock.sucursal_id:
            raise ValueError(
                'El depósito de ingreso debe pertenecer a la sucursal del stock.'
            )

        cantidad = _decimal(item.get('cantidad'))
        error_cantidad = validar_cantidad_por_unidad(
            cantidad,
            nombre_unidad,
            etiqueta='La cantidad a ingresar',
        )
        if error_cantidad:
            raise ValueError(error_cantidad)

        detalle = DetalleStock.objects.create(
            stock=stock,
            deposito=deposito,
            cantidad=cantidad,
            fecha_venc=item.get('fecha_venc'),
            observaciones=f'Ajuste de stock: {motivo}',
        )
        cambios += cantidad

    if cambios == 0:
        return stock

    total = recalcular_stock(stock)
    if total < stock.cant_negativa_max:
        raise ValueError(
            f'La cantidad no puede ser menor al limite negativo '
            f'({stock.cant_negativa_max}).'
        )
    return Stock.objects.select_related('producto__unidad', 'sucursal').get(pk=stock.pk)


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

        nombre_unidad = str(getattr(producto, 'unidad', '') or '')
        from ..utils import validar_cantidad_por_unidad
        error_cantidad = validar_cantidad_por_unidad(
            cantidad,
            nombre_unidad,
            etiqueta='La cantidad',
        )
        if error_cantidad:
            raise ValueError(error_cantidad)

        stock = obtener_stock(producto, sucursal)
        reponer_stock(
            stock,
            cantidad,
            deposito,
            lote=None,
            fecha_venc=item.get('fecha_venc'),
            observaciones=f'Carga de stock: {motivo}',
        )
        stocks.append(stock)

    return stocks


@transaction.atomic
def mover_lote(detalle, deposito_destino, motivo):
    """Mueve un lote completo a otro deposito de la misma sucursal.

    Un lote siempre vive en un solo deposito: mover una parte obliga a partir
    el lote, por eso solo se permite el traslado completo. El movimiento queda
    auditado en el historial del lote con el motivo indicado.
    """
    motivo = (motivo or '').strip()
    if len(motivo) < 3:
        raise ValueError('Indicá el motivo del movimiento (mínimo 3 caracteres).')

    detalle = (
        DetalleStock.objects.select_for_update()
        .select_related('deposito', 'stock__sucursal')
        .get(pk=detalle.pk)
    )
    if detalle.cantidad <= 0:
        raise ValueError('El lote no tiene stock disponible para mover.')
    if detalle.deposito_id == deposito_destino.pk:
        raise ValueError('El lote ya está en ese depósito.')
    if deposito_destino.sucursal_id != detalle.stock.sucursal_id:
        raise ValueError('El depósito destino debe pertenecer a la sucursal del stock.')

    detalle._change_reason = f'Movimiento entre depósitos: {motivo}'[:100]
    detalle.deposito = deposito_destino
    detalle.save(update_fields=['deposito'])
    return detalle


@transaction.atomic
def reponer_stock(
    stock,
    cantidad,
    deposito,
    lote=None,
    fecha_venc=None,
    observaciones='',
):
    """Agrega un lote al stock y devuelve el detalle creado."""
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
        observaciones=observaciones,
    )
    recalcular_stock(stock)
    return detalle
