"""Registro y recepcion de compras.

- La compra se registra con su proveedor y sus detalles, pero **no** toca el
  stock.
- El stock se repone recien al recibirla, en el deposito predeterminado de la
  sucursal de la caja.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from ..models import (
    Compra,
    DetalleCompra,
    Producto,
    ProductoXProveedor,
    Proveedor,
    SeccionCaja,
    Sucursal,
)
from ..utils import validar_cantidad_por_unidad
from . import stock as stock_service


def _decimal(valor):
    return Decimal(str(valor))


@transaction.atomic
def registrar_compra(
    seccion_caja,
    proveedor,
    items,
    estado_entrega=Compra.EstadoEntrega.PENDIENTE,
    fecha_estimada_llegada=None,
):
    """Crea la compra y sus detalles. No repone stock."""
    if not items:
        raise ValueError('La compra debe tener al menos un producto.')

    if estado_entrega == Compra.EstadoEntrega.RECIBIDA:
        raise ValueError('La compra no puede nacer recibida.')

    seccion_caja = (
        SeccionCaja.objects.select_for_update()
        .select_related('sucursal_caja__sucursal')
        .get(pk=seccion_caja.pk)
    )
    if seccion_caja.estado != SeccionCaja.EstadoSeccion.ABIERTA:
        raise ValueError('La seccion de caja no esta abierta.')

    if not isinstance(proveedor, Proveedor):
        proveedor = Proveedor.objects.get(pk=proveedor)
    if not proveedor.estado_prov:
        raise ValueError('El proveedor esta inactivo.')

    productos_habilitados = set(
        ProductoXProveedor.objects.filter(
            proveedor=proveedor,
            estado=True,
        ).values_list('producto_id', flat=True)
    )

    compra = Compra(
        seccion_caja=seccion_caja,
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
def recibir_compra(compra, deposito=None):
    """Repone el stock de todos los detalles de la compra.

    Si no se indica deposito, usa el deposito predeterminado de la sucursal
    central. Si no hay sucursal central marcada, usa el de la sucursal de la
    caja de la compra.
    """
    compra = (
        Compra.objects.select_for_update(of=('self',))
        .select_related('seccion_caja__sucursal_caja__sucursal', 'proveedor')
        .get(pk=compra.pk)
    )
    if compra.fecha_recepcion is not None:
        raise ValueError('La compra ya fue recibida.')
    if compra.estado == Compra.EstadoCompra.ANULADA:
        raise ValueError('No se puede recibir una compra anulada.')
    if compra.proveedor_id is None:
        raise ValueError('La compra no tiene proveedor.')

    if deposito is None:
        sucursal_caja = compra.seccion_caja.sucursal_caja.sucursal
        central = Sucursal.objects.filter(
            es_central=True,
            empresa=sucursal_caja.empresa,
        ).first()
        sucursal = central if central is not None else sucursal_caja
        deposito = stock_service.deposito_predeterminado(sucursal)

    if deposito.sucursal_id is None:
        raise ValueError('El deposito de recepcion no tiene sucursal.')

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
            referencia=f'compra:{compra.id}',
            compra=compra,
        )

    compra.fecha_recepcion = timezone.now()
    compra.estado_entrega = Compra.EstadoEntrega.RECIBIDA
    compra.save(update_fields=['fecha_recepcion', 'estado_entrega'])
    return compra
