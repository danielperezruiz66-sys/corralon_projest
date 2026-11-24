"""Registro de pagos de ventas y compras.

Reglas de ventas:

- una venta sin pagos esta `PENDIENTE` y vence a los 30 minutos;
- un pago parcial la deja `PARCIAL` (no vence y no se puede anular sin
  revertir los pagos);
- cuando los pagos cubren el total, la venta queda `CONFIRMADA`: pagada y
  confirmada son el mismo estado;
- una venta confirmada o anulada no se puede volver a cobrar.

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
    MovimientoCaja,
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


def _validar_caja_abierta(movimiento):
    """No se cobra ni se paga con la caja en pausa o cerrada."""
    if movimiento.estado == MovimientoCaja.EstadoMovimiento.PAUSADA:
        raise ValueError(
            'El movimiento de caja está en pausa: primero hay que reanudarlo.'
        )
    if movimiento.estado != MovimientoCaja.EstadoMovimiento.ABIERTA:
        raise ValueError(
            'El movimiento de caja no está abierto: no se pueden registrar '
            'pagos.'
        )


def _pagado(objeto):
    total = objeto.pagos.aggregate(total=Sum('monto_pagado'))['total']
    return total if total is not None else Decimal('0.00')


def _estado_venta_segun_pago(venta, pagado):
    if pagado <= 0:
        return Venta.EstadoVenta.PENDIENTE
    if pagado < venta.monto_venta:
        return Venta.EstadoVenta.PARCIAL
    return Venta.EstadoVenta.CONFIRMADA


@transaction.atomic
def registrar_pago_venta(venta, metodo_pago, monto, clave='', movimiento_caja=None):
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado == Venta.EstadoVenta.ANULADA:
        raise ValueError('No se puede registrar un pago sobre una venta anulada.')
    if venta.estado == Venta.EstadoVenta.CONFIRMADA:
        raise ValueError('La venta ya está confirmada.')

    if clave:
        existentes = list(MetodoPagoXVenta.objects.filter(venta=venta, clave=clave))
        if existentes:
            return existentes[0]

    movimiento = movimiento_caja or venta.movimiento_caja
    _validar_caja_abierta(movimiento)

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
        movimiento_caja=movimiento,
        metodo_pago=metodo_pago,
        monto_pagado=monto,
        clave=clave,
    )
    nuevo_estado = _estado_venta_segun_pago(venta, _pagado(venta))
    if venta.estado != nuevo_estado:
        venta.estado = nuevo_estado
        venta.save(update_fields=['estado'])
    return pago


@transaction.atomic
def registrar_pagos_venta(
    venta,
    pagos,
    confirmar=False,
    clave='',
    movimiento_caja=None,
):
    """Registra varios metodos de pago para una venta en una sola transaccion.

    Si los pagos no cubren el total, la venta queda `PARCIAL`. Si lo cubren,
    queda `CONFIRMADA` (pagada y confirmada son el mismo estado). El flag
    `confirmar` se mantiene por compatibilidad: cuando es True exige que los
    pagos cubran el total antes de registrar.

    `clave` es la clave de idempotencia: si la misma operacion se reintenta,
    se devuelven los pagos ya registrados en vez de cobrarlos dos veces.
    """
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado == Venta.EstadoVenta.ANULADA:
        raise ValueError('No se puede registrar un pago sobre una venta anulada.')

    if clave:
        existentes = list(MetodoPagoXVenta.objects.filter(venta=venta, clave=clave))
        if existentes:
            return existentes, venta

    if venta.estado == Venta.EstadoVenta.CONFIRMADA:
        raise ValueError('La venta ya está confirmada.')

    movimiento = movimiento_caja or venta.movimiento_caja
    _validar_caja_abierta(movimiento)

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
            movimiento_caja=movimiento,
            metodo_pago=metodo_pago,
            monto_pagado=monto,
            clave=clave,
        )
        for metodo_pago, monto in preparados
    ]

    nuevo_estado = _estado_venta_segun_pago(venta, _pagado(venta))
    venta.estado = nuevo_estado
    venta.save(update_fields=['estado'])

    return creados, venta


@transaction.atomic
def registrar_pagos_compra(compra, pagos, clave='', movimiento_caja=None):
    """Registra varios metodos de pago para una compra en una sola transaccion.

    La compra queda `PARCIAL` si los pagos no cubren el total y `PAGADA` cuando
    lo cubren. La recepcion de la mercaderia no interviene en este estado.

    `clave` es la clave de idempotencia: si la misma operacion se reintenta,
    se devuelven los pagos ya registrados en vez de pagarlos dos veces.
    """
    compra = Compra.objects.select_for_update().get(pk=compra.pk)
    if compra.estado == Compra.EstadoCompra.ANULADA:
        raise ValueError('No se puede registrar un pago sobre una compra anulada.')

    if clave:
        existentes = list(
            MetodoPagoXCompra.objects.filter(compra=compra, clave=clave)
        )
        if existentes:
            return existentes, compra

    movimiento = movimiento_caja or compra.movimiento_caja
    _validar_caja_abierta(movimiento)

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
            movimiento_caja=movimiento,
            metodo_pago=metodo_pago,
            monto_pagado=monto,
            clave=clave,
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
def registrar_pago_compra(
    compra,
    metodo_pago,
    monto,
    clave='',
    movimiento_caja=None,
):
    creados, _ = registrar_pagos_compra(
        compra,
        [{'metodo_pago': metodo_pago, 'monto_pagado': monto}],
        clave=clave,
        movimiento_caja=movimiento_caja,
    )
    return creados[0]
