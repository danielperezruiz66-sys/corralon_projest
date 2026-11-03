"""Registro de pagos de ventas y compras.

Un pago se registra sobre una venta/compra existente y actualiza su estado:

- sin pagos: `PENDIENTE` (o `CONFIRMADA` si la venta ya fue confirmada)
- con pagos parciales: `PARCIAL`
- con el total cubierto: `PAGADA`

No se permite pagar de mas, pagar sobre un documento anulado ni usar un
metodo de pago inactivo.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from ..models import (
    Compra,
    MetodoPago,
    MetodoPagoXCompra,
    MetodoPagoXVenta,
    Venta,
)


def _decimal(valor):
    return Decimal(str(valor))


def _metodo(metodo_pago):
    if not isinstance(metodo_pago, MetodoPago):
        metodo_pago = MetodoPago.objects.get(pk=metodo_pago)
    if not metodo_pago.estado:
        raise ValueError('El metodo de pago esta inactivo.')
    return metodo_pago


def _validar_monto(monto):
    monto = _decimal(monto)
    if monto <= 0:
        raise ValueError('El monto del pago debe ser mayor que cero.')
    return monto


def _pagado(objeto):
    total = objeto.pagos.aggregate(total=Sum('monto_pagado'))['total']
    return total if total is not None else Decimal('0.00')


def _estado_venta(venta, pagado):
    if pagado >= venta.monto_venta:
        return Venta.EstadoVenta.PAGADA
    return Venta.EstadoVenta.PARCIAL


@transaction.atomic
def registrar_pago_venta(venta, metodo_pago, monto):
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado == Venta.EstadoVenta.ANULADA:
        raise ValueError('No se puede registrar un pago sobre una venta anulada.')

    metodo_pago = _metodo(metodo_pago)
    monto = _validar_monto(monto)

    pagado = _pagado(venta)
    if pagado + monto > venta.monto_venta:
        raise ValueError(
            f'El pago supera el total de la venta. '
            f'Pendiente: {venta.monto_venta - pagado}.'
        )

    pago = MetodoPagoXVenta.objects.create(
        venta=venta,
        metodo_pago=metodo_pago,
        monto_pagado=monto,
    )

    venta.estado = _estado_venta(venta, pagado + monto)
    venta.save(update_fields=['estado'])
    return pago


@transaction.atomic
def registrar_pago_compra(compra, metodo_pago, monto):
    compra = Compra.objects.select_for_update().get(pk=compra.pk)
    if compra.estado == Compra.EstadoCompra.ANULADA:
        raise ValueError('No se puede registrar un pago sobre una compra anulada.')

    metodo_pago = _metodo(metodo_pago)
    monto = _validar_monto(monto)

    pagado = _pagado(compra)
    if pagado + monto > compra.monto_compra:
        raise ValueError(
            f'El pago supera el total de la compra. '
            f'Pendiente: {compra.monto_compra - pagado}.'
        )

    pago = MetodoPagoXCompra.objects.create(
        compra=compra,
        metodo_pago=metodo_pago,
        monto_pagado=monto,
    )

    if pagado + monto >= compra.monto_compra:
        compra.estado = Compra.EstadoCompra.PAGADA
    else:
        compra.estado = Compra.EstadoCompra.PARCIAL
    compra.save(update_fields=['estado'])
    return pago
