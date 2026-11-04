"""Registro, confirmacion y cancelacion de ventas.

Reglas:

- La venta nace en `PENDIENTE` y descuenta stock en ese momento.
- Si no se confirma dentro de `VENTAS_MINUTOS_PARA_CONFIRMAR` (30 por defecto),
  se cancela y el stock se restaura sobre los mismos lotes.
- Se permite stock negativo hasta `Stock.cant_negativa_max`; mas alla, la venta
  se rechaza con `StockInsuficiente`.
- Una venta con pagos registrados no se puede cancelar sin revertir los pagos.
"""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import DetalleVenta, Producto, SeccionCaja, Venta
from . import stock as stock_service

MINUTOS_PARA_CONFIRMAR = 30


def _minutos_para_confirmar():
    """Lee la configuracion en cada llamada para respetar `override_settings`."""
    return getattr(settings, 'VENTAS_MINUTOS_PARA_CONFIRMAR', MINUTOS_PARA_CONFIRMAR)


def _decimal(valor):
    return Decimal(str(valor))


@transaction.atomic
def crear_venta(seccion_caja, items, cliente=None):
    """Crea una venta pendiente y descuenta el stock.

    `items` es una lista de diccionarios:
    `{'producto': Producto|id, 'cantidad': Decimal|str, 'precio': opcional}`.
    """
    if not items:
        raise ValueError('La venta debe tener al menos un producto.')

    seccion_caja = (
        SeccionCaja.objects.select_for_update()
        .select_related('caja__sucursal')
        .get(pk=seccion_caja.pk)
    )
    if seccion_caja.estado != SeccionCaja.EstadoSeccion.ABIERTA:
        raise ValueError('La seccion de caja no esta abierta.')

    venta = Venta.objects.create(
        seccion_caja=seccion_caja,
        cliente=cliente,
        estado=Venta.EstadoVenta.PENDIENTE,
        monto_venta=Decimal('0.00'),
    )

    total = Decimal('0.00')
    for item in items:
        producto = item['producto']
        if not isinstance(producto, Producto):
            producto = Producto.objects.get(pk=producto)

        cantidad = _decimal(item['cantidad'])
        if cantidad <= 0:
            raise ValueError('La cantidad vendida debe ser mayor que cero.')

        precio = item.get('precio')
        precio = producto.precio_unidad if precio is None else _decimal(precio)
        if precio < 0:
            raise ValueError('El precio no puede ser negativo.')
        subtotal = (cantidad * precio).quantize(Decimal('0.01'))

        DetalleVenta.objects.create(
            venta=venta,
            producto=producto,
            cantidad_venta=cantidad,
            precio_venta=precio,
            subtotal=subtotal,
        )

        stock = stock_service.obtener_stock(
            producto,
            seccion_caja.caja.sucursal,
        )
        stock_service.consumir_stock(
            stock,
            cantidad,
            referencia=f'venta:{venta.id}',
            venta=venta,
        )
        total += subtotal

    venta.monto_venta = total
    venta.save(update_fields=['monto_venta'])
    return venta


@transaction.atomic
def confirmar_venta(venta):
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado != Venta.EstadoVenta.PENDIENTE:
        raise ValueError('Solo se puede confirmar una venta pendiente.')

    pagado = venta.pagos.aggregate(total=Sum('monto_pagado'))['total']
    pagado = pagado if pagado is not None else Decimal('0.00')
    if pagado <= 0:
        raise ValueError(
            'Registrá al menos un pago antes de confirmar la venta.'
        )
    if pagado >= venta.monto_venta:
        venta.estado = Venta.EstadoVenta.CONFIRMADA
    else:
        venta.estado = Venta.EstadoVenta.PARCIAL
    venta.save(update_fields=['estado'])
    return venta


@transaction.atomic
def cancelar_venta(venta, motivo=''):
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado == Venta.EstadoVenta.ANULADA:
        return venta
    if venta.pagos.exists():
        raise ValueError('No se puede anular una venta con pagos registrados.')

    stock_service.restaurar_stock(
        venta,
        referencia=f'cancelacion:venta:{venta.id}',
    )
    if motivo:
        venta._history_change_reason = motivo
    venta.estado = Venta.EstadoVenta.ANULADA
    venta.save(update_fields=['estado'])
    return venta


def cancelar_ventas_vencidas(minutos=None):
    """Cancela las ventas pendientes mas antiguas que `minutos`."""
    minutos = _minutos_para_confirmar() if minutos is None else minutos
    limite = timezone.now() - timedelta(minutes=minutos)
    ventas = Venta.objects.filter(
        estado=Venta.EstadoVenta.PENDIENTE,
        fecha_venta__lt=limite,
        pagos__isnull=True,
    )
    canceladas = 0
    for venta in ventas:
        try:
            cancelar_venta(
                venta,
                motivo='Cancelacion automatica por vencimiento',
            )
            canceladas += 1
        except ValueError:
            continue
    return canceladas
