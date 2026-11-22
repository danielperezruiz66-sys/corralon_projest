"""Registro y recepcion de compras.

- La compra se registra con su proveedor, su deposito destino y sus detalles,
  pero **no** toca el stock.
- El stock se repone recien al recibirla, en el deposito elegido al registrar
  la compra. Si la compra no tiene deposito (datos historicos), se usa el
  deposito predeterminado de la sucursal del movimiento de caja.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from ..models import (
    Compra,
    Deposito,
    DetalleCompra,
    MovimientoCaja,
    Producto,
    ProductoXProveedor,
    Proveedor,
)
from ..utils import validar_cantidad_por_unidad
from . import stock as stock_service


def _decimal(valor):
    return Decimal(str(valor))


@transaction.atomic
def registrar_compra(
    movimiento_caja,
    proveedor,
    deposito,
    items,
    estado_entrega=Compra.EstadoEntrega.PENDIENTE,
    fecha_estimada_llegada=None,
):
    """Crea la compra y sus detalles. No repone stock."""
    if not items:
        raise ValueError('La compra debe tener al menos un producto.')

    if estado_entrega == Compra.EstadoEntrega.RECIBIDA:
        raise ValueError('La compra no puede nacer recibida.')

    movimiento_caja = (
        MovimientoCaja.objects.select_for_update()
        .select_related('caja__sucursal')
        .get(pk=movimiento_caja.pk)
    )
    if movimiento_caja.estado != MovimientoCaja.EstadoMovimiento.ABIERTA:
        raise ValueError('El movimiento de caja no esta abierto.')

    if not isinstance(proveedor, Proveedor):
        proveedor = Proveedor.objects.get(pk=proveedor)
    if not proveedor.estado_prov:
        raise ValueError('El proveedor esta inactivo.')

    if deposito is None:
        deposito = stock_service.deposito_predeterminado(
            movimiento_caja.caja.sucursal
        )
    elif not isinstance(deposito, Deposito):
        deposito = Deposito.objects.get(pk=deposito)
    if deposito.sucursal_id != movimiento_caja.caja.sucursal_id:
        raise ValueError(
            'El depósito de la compra debe pertenecer a la sucursal de la caja.'
        )

    productos_habilitados = set(
        ProductoXProveedor.objects.filter(
            proveedor=proveedor,
            estado=True,
        ).values_list('producto_id', flat=True)
    )

    compra = Compra(
        movimiento_caja=movimiento_caja,
        deposito=deposito,
        proveedor=proveedor,
        estado=Compra.EstadoCompra.PENDIENTE,
        estado_entrega=estado_entrega,
        fecha_estimada_llegada=fecha_estimada_llegada,
        monto_compra=Decimal('0.00'),
    )
    compra.full_clean()
    compra.save()

    total = Decimal('0.00')
    for item in items:
        producto = item['producto']
        if not isinstance(producto, Producto):
            producto = Producto.objects.get(pk=producto)

        if producto.pk not in productos_habilitados:
            raise ValueError(
                f'El producto "{producto}" no está asociado al proveedor '
                f'"{proveedor}".'
            )

        cantidad = _decimal(item['cantidad'])
        if cantidad <= 0:
            raise ValueError('La cantidad comprada debe ser mayor que cero.')

        nombre_unidad = str(getattr(producto, 'unidad', '') or '')
        error_cantidad = validar_cantidad_por_unidad(
            cantidad,
            nombre_unidad,
            etiqueta='La cantidad comprada',
        )
        if error_cantidad:
            raise ValueError(error_cantidad)

        precio = item.get('precio')
        if precio is None:
            raise ValueError(
                'La compra debe tener un precio de costo para cada producto.'
            )
        precio = _decimal(precio)
        if precio <= 0:
            raise ValueError('El precio de costo debe ser mayor que cero.')
        subtotal = (cantidad * precio).quantize(Decimal('0.01'))

        DetalleCompra.objects.create(
            compra=compra,
            producto=producto,
            cantidad_compra=cantidad,
            precio_compra=precio,
            subtotal=subtotal,
        )
        total += subtotal

    compra.monto_compra = total
    compra.save(update_fields=['monto_compra'])
    return compra


@transaction.atomic
def anular_compra(compra, motivo=''):
    """Anula una compra que todavia no fue recibida ni tiene pagos."""
    motivo = (motivo or '').strip()
    if not motivo:
        raise ValueError('Indicá el motivo de la anulación.')

    compra = Compra.objects.select_for_update().get(pk=compra.pk)
    if compra.estado == Compra.EstadoCompra.ANULADA:
        raise ValueError('La compra ya está anulada.')
    if compra.estado_entrega == Compra.EstadoEntrega.RECIBIDA:
        raise ValueError('No se puede anular una compra recibida.')
    if compra.pagos.exists():
        raise ValueError('No se puede anular una compra con pagos registrados.')

    compra._change_reason = f'Anulación de compra: {motivo}'[:100]
    compra.estado = Compra.EstadoCompra.ANULADA
    compra.motivo_cancelacion = motivo
    compra.save(update_fields=['estado', 'motivo_cancelacion'])
    return compra


@transaction.atomic
def marcar_en_camino(compra, fecha_estimada_llegada=None):
    """Marca una compra como en camino, sin mover stock."""
    compra = Compra.objects.select_for_update().get(pk=compra.pk)
    if compra.estado == Compra.EstadoCompra.ANULADA:
        raise ValueError('No se puede marcar en camino una compra anulada.')
    if compra.estado_entrega == Compra.EstadoEntrega.RECIBIDA:
        raise ValueError('La compra ya fue recibida.')
    if (
        fecha_estimada_llegada is None
        and compra.fecha_estimada_llegada is None
    ):
        raise ValueError('Indicá la fecha estimada de llegada.')

    compra.estado_entrega = Compra.EstadoEntrega.EN_CAMINO
    if fecha_estimada_llegada is not None:
        compra.fecha_estimada_llegada = fecha_estimada_llegada
    compra.full_clean()
    compra.save(
        update_fields=['estado_entrega', 'fecha_estimada_llegada'],
    )
    return compra


@transaction.atomic
def recibir_compra(compra):
    """Repone el stock de todos los detalles de la compra.

    Usa el deposito definido en la compra. Si la compra es historica y no
    tiene deposito, usa el predeterminado de la sucursal de su movimiento.
    """
    compra = (
        Compra.objects.select_for_update(of=('self',))
        .select_related(
            'movimiento_caja__caja__sucursal',
            'proveedor',
            'deposito',
        )
        .get(pk=compra.pk)
    )
    if compra.fecha_recepcion is not None:
        raise ValueError('La compra ya fue recibida.')
    if compra.estado == Compra.EstadoCompra.ANULADA:
        raise ValueError('No se puede recibir una compra anulada.')
    if compra.proveedor_id is None:
        raise ValueError('La compra no tiene proveedor.')

    deposito = compra.deposito
    if deposito is None:
        deposito = stock_service.deposito_predeterminado(
            compra.movimiento_caja.caja.sucursal
        )
    if (
        deposito.sucursal_id
        != compra.movimiento_caja.caja.sucursal_id
    ):
        raise ValueError(
            'El depósito de recepción no pertenece a la sucursal de la compra.'
        )

    for detalle in compra.detalles.select_related('producto'):
        stock = stock_service.obtener_stock(
            detalle.producto,
            deposito.sucursal,
        )
        stock_service.reponer_stock(
            stock,
            detalle.cantidad_compra,
            deposito,
            lote=None,
            observaciones=f'Compra #{compra.id}',
        )

    compra.fecha_recepcion = timezone.now()
    compra.estado_entrega = Compra.EstadoEntrega.RECIBIDA
    compra.save(update_fields=['fecha_recepcion', 'estado_entrega'])
    return compra
