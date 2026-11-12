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

    referencia = f'ajuste: {motivo}'
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
        detalle.save(update_fields=['cantidad'])
        MovimientoStock.objects.create(
            stock=stock,
            detalle_stock=detalle,
            tipo=MovimientoStock.TipoMovimiento.AJUSTE,
            cantidad=diferencia,
            referencia=referencia,
        )
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
        )
        MovimientoStock.objects.create(
            stock=stock,
            detalle_stock=detalle,
            tipo=MovimientoStock.TipoMovimiento.AJUSTE,
            cantidad=cantidad,
            referencia=referencia,
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


# Compatibilidad temporal: ajuste por total (legado).
@transaction.atomic
def ajustar_stock(stock, cantidad_nueva, deposito=None, motivo=''):
    """[Legado] Fija el stock en una cantidad total. Preferir ajustar_stock_detallado."""
    stock = Stock.objects.select_for_update().select_related('producto__unidad').get(pk=stock.pk)
    cantidad_nueva = _decimal(cantidad_nueva)
    nombre_unidad = str(getattr(stock.producto, 'unidad', '') or '')
    error_cantidad = validar_cantidad_por_unidad(
        cantidad_nueva,
        nombre_unidad,
        etiqueta='La cantidad',
        permitir_no_positiva=True,
    )
    if error_cantidad:
        raise ValueError(error_cantidad)
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
            raise ValueError('El deposito debe pertenecer a la sucursal del stock.')
        detalle = DetalleStock.objects.create(
            stock=stock,
            deposito=deposito,
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
            referencia=f'carga-stock: {motivo}',
            tipo=MovimientoStock.TipoMovimiento.AJUSTE,
        )
        stocks.append(stock)

    return stocks


NOTA_ORIGEN_PREFIJO = 'Origen: '


def _nota_origen_transferencia(transferencia):
    detalle = transferencia.detalle_origen
    lote = (
        getattr(detalle, 'lote', None)
        or transferencia.lote
        or '—'
    )
    return (
        f'Transferido de {transferencia.producto} (lote {lote}) '
        f'desde {transferencia.deposito_origen}.'
    )


def _componer_motivo_transferencia(nota_origen, motivo_usuario=''):
    motivo_usuario = (motivo_usuario or '').strip()
    if motivo_usuario:
        return f'{nota_origen}\nMotivo: {motivo_usuario}'
    return nota_origen


@transaction.atomic
def crear_transferencia(
    producto,
    deposito_origen,
    deposito_destino,
    cantidad,
    detalle_origen=None,
    lote=None,
    motivo='',
):
    """Descuenta un detalle/lote de origen y deja la mercadería en tránsito."""
    cantidad = _decimal(cantidad)
    if cantidad <= 0:
        raise ValueError('La cantidad a transferir debe ser mayor que cero.')
    nombre_unidad = str(getattr(producto, 'unidad', '') or '')
    from ..utils import validar_cantidad_por_unidad

    error_cantidad = validar_cantidad_por_unidad(
        cantidad,
        nombre_unidad,
        etiqueta='La cantidad a transferir',
    )
    if error_cantidad:
        raise ValueError(error_cantidad)
    if deposito_origen.pk == deposito_destino.pk:
        raise ValueError('El deposito de origen y destino deben ser distintos.')
    if deposito_origen.sucursal_id is None or deposito_destino.sucursal_id is None:
        raise ValueError('Los depositos deben tener una sucursal asignada.')

    stock_origen = obtener_stock(producto, deposito_origen.sucursal)

    detalle = None
    if detalle_origen is not None:
        detalle = (
            DetalleStock.objects.select_for_update()
            .select_related('stock', 'deposito')
            .get(pk=detalle_origen.pk)
        )
        if detalle.stock_id != stock_origen.id:
            raise ValueError('El lote seleccionado no pertenece al producto y sucursal de origen.')
        if detalle.deposito_id != deposito_origen.id:
            raise ValueError('El lote seleccionado no pertenece al depósito de origen.')
    elif lote:
        detalle = (
            stock_origen.detalles.select_for_update()
            .filter(deposito=deposito_origen, lote=lote, cantidad__gt=0)
            .first()
        )
    if detalle is None:
        raise ValueError('Seleccioná el lote de origen de la transferencia.')
    if detalle.cantidad < cantidad:
        raise ValueError(
            f'No hay stock suficiente en el lote seleccionado. '
            f'Disponible: {detalle.cantidad}.'
        )

    nota_origen = (
        f'Transferido de {producto} (lote {detalle.lote}) '
        f'desde {deposito_origen}.'
    )
    motivo_final = _componer_motivo_transferencia(nota_origen, motivo)

    transferencia = TransferenciaStock.objects.create(
        producto=producto,
        stock_origen=stock_origen,
        deposito_origen=deposito_origen,
        deposito_destino=deposito_destino,
        detalle_origen=detalle,
        cantidad=cantidad,
        lote=detalle.lote,
        motivo=motivo_final,
        estado=TransferenciaStock.EstadoTransferencia.EN_TRANSITO,
    )

    detalle.cantidad -= cantidad
    detalle.save(update_fields=['cantidad'])
    MovimientoStock.objects.create(
        stock=stock_origen,
        detalle_stock=detalle,
        tipo=MovimientoStock.TipoMovimiento.TRANSFERENCIA,
        cantidad=-cantidad,
        referencia=f'transferencia:{transferencia.id}',
    )
    recalcular_stock(stock_origen)
    return transferencia


@transaction.atomic
def recibir_transferencia(transferencia):
    """Confirma la transferencia e ingresa la mercadería en destino con nuevo lote."""
    transferencia = (
        TransferenciaStock.objects.select_for_update(of=('self',))
        .select_related(
            'producto',
            'deposito_destino__sucursal',
            'deposito_origen',
            'detalle_origen',
        )
        .get(pk=transferencia.pk)
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
    fecha_venc = None
    if transferencia.detalle_origen_id:
        origen = transferencia.detalle_origen
        fecha_venc = getattr(origen, 'fecha_venc', None)
    nota_origen = _nota_origen_transferencia(transferencia)
    detalle = DetalleStock.objects.create(
        stock=stock_destino,
        deposito=transferencia.deposito_destino,
        cantidad=transferencia.cantidad,
        fecha_venc=fecha_venc,
        observaciones=nota_origen,
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
    """Cancela una transferencia en tránsito y devuelve el stock al origen."""
    transferencia = (
        TransferenciaStock.objects.select_for_update(of=('self',))
        .select_related('detalle_origen', 'deposito_origen', 'stock_origen')
        .get(pk=transferencia.pk)
    )
    if (
        transferencia.estado
        != TransferenciaStock.EstadoTransferencia.EN_TRANSITO
    ):
        raise ValueError('La transferencia no esta en transito.')

    stock_origen = Stock.objects.select_for_update().get(
        pk=transferencia.stock_origen_id,
    )
    detalle_origen = None
    if transferencia.detalle_origen_id:
        detalle_origen = (
            DetalleStock.objects.select_for_update()
            .filter(pk=transferencia.detalle_origen_id)
            .first()
        )
    if detalle_origen is not None:
        detalle_origen.cantidad += transferencia.cantidad
        detalle_origen.save(update_fields=['cantidad'])
        detalle_mov = detalle_origen
    else:
        detalle_mov = DetalleStock.objects.create(
            stock=stock_origen,
            deposito=transferencia.deposito_origen,
            cantidad=transferencia.cantidad,
        )
    MovimientoStock.objects.create(
        stock=stock_origen,
        detalle_stock=detalle_mov,
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
