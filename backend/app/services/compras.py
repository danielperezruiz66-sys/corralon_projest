"""Registro y recepcion de compras.

- La compra se registra con su proveedor y sus detalles, pero **no** toca el
  stock.
- El stock se repone recien al recibirla, en el deposito predeterminado de la
  sucursal de la caja.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from ..models import Compra, DetalleCompra, Producto, Proveedor, SeccionCaja
from . import stock as stock_service


def _decimal(valor):
    return Decimal(str(valor))


@transaction.atomic
def registrar_compra(seccion_caja, proveedor, items):
    """Crea la compra y sus detalles. No repone stock."""
    if not items:
        raise ValueError('La compra debe tener al menos un producto.')

    seccion_caja = (
        SeccionCaja.objects.select_for_update()
        .select_related('caja__sucursal')
        .get(pk=seccion_caja.pk)
    )
    if seccion_caja.estado != SeccionCaja.EstadoSeccion.ABIERTA:
        raise ValueError('La seccion de caja no esta abierta.')

    if not isinstance(proveedor, Proveedor):
        proveedor = Proveedor.objects.get(pk=proveedor)
    if not proveedor.estado_prov:
        raise ValueError('El proveedor esta inactivo.')

    compra = Compra.objects.create(
        seccion_caja=seccion_caja,
        proveedor=proveedor,
        estado=Compra.EstadoCompra.PENDIENTE,
        monto_compra=Decimal('0.00'),
    )

    total = Decimal('0.00')
    for item in items:
        producto = item['producto']
        if not isinstance(producto, Producto):
            producto = Producto.objects.get(pk=producto)

        cantidad = _decimal(item['cantidad'])
        if cantidad <= 0:
            raise ValueError('La cantidad comprada debe ser mayor que cero.')

        precio = item.get('precio')
        precio = producto.precio_unidad if precio is None else _decimal(precio)
        if precio < 0:
            raise ValueError('El precio no puede ser negativo.')
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
def recibir_compra(compra):
    """Repone el stock de todos los detalles de la compra."""
    compra = (
        Compra.objects.select_for_update(of=('self',))
        .select_related('seccion_caja__caja__sucursal', 'proveedor')
        .get(pk=compra.pk)
    )
    if compra.fecha_recepcion is not None:
        raise ValueError('La compra ya fue recibida.')
    if compra.proveedor_id is None:
        raise ValueError('La compra no tiene proveedor.')

    sucursal = compra.seccion_caja.caja.sucursal
    deposito = stock_service.deposito_predeterminado(sucursal)

    for detalle in compra.detalles.select_related('producto'):
        stock = stock_service.obtener_stock(detalle.producto, sucursal)
        stock_service.reponer_stock(
            stock,
            detalle.cantidad_compra,
            deposito,
            lote=None,
            referencia=f'compra:{compra.id}',
            compra=compra,
        )

    compra.fecha_recepcion = timezone.now()
    compra.save(update_fields=['fecha_recepcion'])
    return compra
