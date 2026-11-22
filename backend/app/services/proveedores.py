"""Asociacion de productos y costos a proveedores."""

from decimal import Decimal

from django.db import transaction

from ..models import ProductoXProveedor


class AsociacionDuplicada(Exception):
    """El producto ya tiene un costo cargado para el proveedor."""

    def __init__(self, asociacion):
        self.asociacion = asociacion
        precio = f'{asociacion.precio_lista:.2f}'
        super().__init__(
            'El proveedor ya está asociado a este producto '
            f'(costo vigente: ${precio}). '
            'Podés editar la asociación existente.'
        )


@transaction.atomic
def asociar_productos(proveedor, items):
    """Crea en bloque los costos nuevos de un proveedor.

    Si algun producto ya tiene una fila para ese proveedor se rechaza el lote
    completo: la edicion del costo existente se hace por `PATCH
    /api/productos-proveedores/{id}/` en lugar de duplicar la relacion.
    """
    if not proveedor.estado_prov:
        raise ValueError('El proveedor esta inactivo.')
    if not items:
        raise ValueError('Agrega al menos un producto.')

    vistos = set()
    productos = []
    for item in items:
        producto = item['producto']
        if producto.pk in vistos:
            raise ValueError(
                f'El producto "{producto}" esta repetido en la lista.'
            )
        vistos.add(producto.pk)
        productos.append(producto)

        precio = Decimal(str(item['precio_lista']))
        if precio <= 0:
            raise ValueError('El precio de costo debe ser mayor que cero.')
        if precio >= producto.precio_unidad:
            raise ValueError(
                f'El costo de "{producto}" debe ser menor al precio de venta '
                f'({producto.precio_unidad}).'
            )

    existentes = {
        asociacion.producto_id: asociacion
        for asociacion in ProductoXProveedor.objects.filter(
            proveedor=proveedor,
            producto_id__in=[producto.pk for producto in productos],
        )
    }
    for producto in productos:
        asociacion = existentes.get(producto.pk)
        if asociacion is not None:
            raise AsociacionDuplicada(asociacion)

    asociaciones = []
    for item in items:
        asociacion = ProductoXProveedor(
            producto=item['producto'],
            proveedor=proveedor,
            precio_lista=Decimal(str(item['precio_lista'])),
            codigo_producto_proveedor=(
                item.get('codigo_producto_proveedor') or None
            ),
            estado=True,
        )
        asociacion._change_reason = (
            f'Costo asociado al proveedor {proveedor}'
        )
        asociacion.save()
        asociaciones.append(asociacion)

    return asociaciones
