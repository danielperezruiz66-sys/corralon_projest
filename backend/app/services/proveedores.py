"""Asociacion de productos y costos a proveedores."""

from decimal import Decimal

from django.db import transaction

from ..models import ProductoXProveedor


@transaction.atomic
def asociar_productos(proveedor, items):
    """Crea o actualiza en bloque los costos de un proveedor."""
    if not proveedor.estado_prov:
        raise ValueError('El proveedor esta inactivo.')
    if not items:
        raise ValueError('Agrega al menos un producto.')

    vistos = set()
    asociaciones = []
    for item in items:
        producto = item['producto']
        if producto.pk in vistos:
            raise ValueError(
                f'El producto "{producto}" esta repetido en la lista.'
            )
        vistos.add(producto.pk)

        precio = Decimal(str(item['precio_lista']))
        if precio <= 0:
            raise ValueError('El precio de costo debe ser mayor que cero.')
        if precio >= producto.precio_unidad:
            raise ValueError(
                f'El costo de "{producto}" debe ser menor al precio de venta '
                f'({producto.precio_unidad}).'
            )

        asociacion = ProductoXProveedor.objects.filter(
            producto=producto,
            proveedor=proveedor,
        ).first()
        if asociacion is None:
            asociacion = ProductoXProveedor(
                producto=producto,
                proveedor=proveedor,
            )
        asociacion.precio_lista = precio
        asociacion.codigo_producto_proveedor = (
            item.get('codigo_producto_proveedor') or None
        )
        asociacion.estado = True
        asociacion.save()
        asociaciones.append(asociacion)

    return asociaciones
