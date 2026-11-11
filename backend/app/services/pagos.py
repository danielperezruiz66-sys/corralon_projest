"""Registro de pagos de ventas y compras.

Reglas de ventas:

- el pago no cambia el estado de la venta: sigue `PENDIENTE` hasta que el
  cajero la confirme manualmente con el total cubierto;
- se permiten pagos parciales mientras la venta esta pendiente;
- una venta confirmada o anulada no se puede volver a cobrar si ya esta paga
  o anulada.

Las compras conservan `PENDIENTE`, `PARCIAL`, `PAGADA` y `ANULADA`. El pago
las deja `PARCIAL` o `PAGADA`; la recepcion es un estado logistico aparte y no
modifica el estado de pago.

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

    return MetodoPagoXVenta.objects.create(
        venta=venta,
        metodo_pago=metodo_pago,
        monto_pagado=monto,
    )


@transaction.atomic
def registrar_pagos_venta(venta, pagos, confirmar=False):
    """Registra varios métodos de pago para una venta en una sola transaccion.

    Si `confirmar` es True, exige que la suma de los pagos cubra el saldo y
    deja la venta Confirmada. Si es False, la venta sigue Pendiente aunque
    los pagos cubran el total.
    """
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado == Venta.EstadoVenta.ANULADA:
        raise ValueError('No se puede registrar un pago sobre una venta anulada.')
    if venta.estado == Venta.EstadoVenta.CONFIRMADA:
        raise ValueError('La venta ya está confirmada.')

    if not pagos:
        raise ValueError('Registrá al menos un pago.')

    pagado = _pagado(venta)
    saldo = venta.monto_venta - pagado
    preparados = []
    total = Decimal('0.00')
    for item in pagos:
        metodo_pago = _metodo(item['metodo_pago'])
        monto = _validar_monto(item['monto_pagado'])
        preparados.append((metodo_pago, monto))
        total += monto

    if total > saldo:
        raise ValueError(
            f'Los pagos superan el saldo de la venta. '
            f'Saldo pendiente: {saldo}.'
        )
    if confirmar and total < saldo:
        raise ValueError(
            f'Para confirmar la venta los pagos deben cubrir el total. '
            f'Saldo pendiente: {saldo - total}.'
        )

    creados = [
        MetodoPagoXVenta.objects.create(
            venta=venta,
            metodo_pago=metodo_pago,
            monto_pagado=monto,
        )
        for metodo_pago, monto in preparados
    ]

    if confirmar:
        venta.estado = Venta.EstadoVenta.CONFIRMADA
        venta.save(update_fields=['estado'])

    return creados, venta


@transaction.atomic
def registrar_pagos_compra(compra, pagos):
    """Registra varios metodos de pago para una compra en una sola transaccion.

    La compra queda `PARCIAL` si los pagos no cubren el total y `PAGADA` cuando
    lo cubren. La recepcion de la mercaderia no interviene en este estado.
    """
    compra = Compra.objects.select_for_update().get(pk=compra.pk)
    if compra.estado == Compra.EstadoCompra.ANULADA:
        raise ValueError('No se puede registrar un pago sobre una compra anulada.')

    if not pagos:
        raise ValueError('Registrá al menos un pago.')

    pagado = _pagado(compra)
    saldo = compra.monto_compra - pagado
    if saldo <= 0:
        raise ValueError('La compra ya está pagada.')

    preparados = []
    total = Decimal('0.00')
    for item in pagos:
        metodo_pago = _metodo(item['metodo_pago'])
        monto = _validar_monto(item['monto_pagado'])
        preparados.append((metodo_pago, monto))
        total += monto

    if total > saldo:
        raise ValueError(
            f'Los pagos superan el saldo de la compra. '
            f'Saldo pendiente: {saldo}.'
        )

    creados = [
        MetodoPagoXCompra.objects.create(
            compra=compra,
            metodo_pago=metodo_pago,
            monto_pagado=monto,
        )
        for metodo_pago, monto in preparados
    ]

    if pagado + total >= compra.monto_compra:
        compra.estado = Compra.EstadoCompra.PAGADA
    else:
        compra.estado = Compra.EstadoCompra.PARCIAL
    compra.save(update_fields=['estado'])
    return creados, compra


@transaction.atomic
def registrar_pago_compra(compra, metodo_pago, monto):
    creados, _ = registrar_pagos_compra(
        compra,
        [{'metodo_pago': metodo_pago, 'monto_pagado': monto}],
    )
    return creados[0]
