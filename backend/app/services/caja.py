"""Apertura y cierre de cajas.

El cierre guarda dos totales:

- `monto_teorico`: lo que el sistema calcula con los pagos de la seccion.
- `monto_final`: lo que el usuario cuenta realmente.

El detalle por metodo de pago queda en `DetalleCierreCaja` (`monto_sistema` vs
`monto_real`), con la diferencia calculada.
"""

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import (
    Caja,
    Compra,
    DetalleCierreCaja,
    MetodoPago,
    MetodoPagoXCompra,
    MetodoPagoXVenta,
    Rol,
    SeccionCaja,
    SucursalXCaja,
    SucursalXEmpleado,
    Venta,
)

ROLES_GESTION = {Rol.CodigoRol.ADMIN, Rol.CodigoRol.GERENTE}


def _decimal(valor):
    return Decimal(str(valor))


def _empleado_puede_operar_sucursal(empleado, sucursal):
    """AD/GE operan en cualquier sucursal; el resto solo en las asignadas."""
    roles = set(
        empleado.roles_asignados.filter(
            estado='AC',
            rol__codigo__isnull=False,
        ).values_list('rol__codigo', flat=True)
    )
    if roles & ROLES_GESTION:
        return True
    return SucursalXEmpleado.objects.filter(
        empleado=empleado,
        sucursal=sucursal,
        estado=True,
    ).exists()


def calcular_teorico(seccion):
    """Devuelve una lista de `{metodo_pago, monto_sistema}`."""
    ventas = seccion.ventas.exclude(estado=Venta.EstadoVenta.ANULADA)
    compras = seccion.compras.exclude(estado=Compra.EstadoCompra.ANULADA)

    pagos_venta = {
        fila['metodo_pago']: fila['total']
        for fila in MetodoPagoXVenta.objects.filter(venta__in=ventas)
        .values('metodo_pago')
        .annotate(total=Sum('monto_pagado'))
    }
    pagos_compra = {
        fila['metodo_pago']: fila['total']
        for fila in MetodoPagoXCompra.objects.filter(compra__in=compras)
        .values('metodo_pago')
        .annotate(total=Sum('monto_pagado'))
    }

    ids_metodos = set(pagos_venta) | set(pagos_compra)
    ids_metodos.update(
        MetodoPago.objects.filter(estado=True).values_list('id', flat=True)
    )
    metodos = list(
        MetodoPago.objects.filter(id__in=ids_metodos).order_by('metodo_pago')
    )
    efectivo = next((metodo for metodo in metodos if metodo.es_efectivo), None)

    resultado = []
    for metodo in metodos:
        sistema = (
            pagos_venta.get(metodo.id, Decimal('0.00'))
            - pagos_compra.get(metodo.id, Decimal('0.00'))
        )
        if metodo == efectivo:
            sistema += seccion.monto_inicial
        if sistema != 0 or metodo == efectivo:
            resultado.append(
                {
                    'metodo_pago': metodo,
                    'monto_sistema': sistema.quantize(Decimal('0.01')),
                }
            )
    return resultado


@transaction.atomic
def abrir_seccion(caja, sucursal, empleado, monto_inicial):
    """Abre una seccion para una caja fisica en una sucursal.

    Valida que la caja este asignada y habilitada en la sucursal, que este
    activa, que el empleado pueda operar esa sucursal y que no exista otra
    seccion abierta para la misma asignacion (misma caja en la misma sucursal).
    """
    monto_inicial = _decimal(monto_inicial)
    if monto_inicial < 0:
        raise ValueError('El monto inicial no puede ser negativo.')

    caja_id = getattr(caja, 'pk', caja)
    sucursal_id = getattr(sucursal, 'pk', sucursal)
    asignacion = (
        SucursalXCaja.objects.select_for_update()
        .select_related('caja', 'sucursal')
        .filter(caja_id=caja_id, sucursal_id=sucursal_id)
        .first()
    )
    if asignacion is None:
        raise ValueError('La caja no esta asignada a la sucursal.')
    if not asignacion.habilitada:
        raise ValueError('La caja no esta habilitada en la sucursal.')
    if asignacion.caja.estado != Caja.EstadoCaja.ACTIVA:
        raise ValueError('La caja no esta activa.')
    if not _empleado_puede_operar_sucursal(empleado, asignacion.sucursal):
        raise ValueError(
            'El empleado no esta asignado a la sucursal de la caja.'
        )
    if SeccionCaja.objects.filter(
        sucursal_caja=asignacion,
        estado=SeccionCaja.EstadoSeccion.ABIERTA,
    ).exists():
        raise ValueError('La caja ya tiene una seccion abierta en esta sucursal.')

    try:
        with transaction.atomic():
            return SeccionCaja.objects.create(
                sucursal_caja=asignacion,
                empleado=empleado,
                fecha_hora_apertura=timezone.now(),
                monto_inicial=monto_inicial,
                estado=SeccionCaja.EstadoSeccion.ABIERTA,
            )
    except IntegrityError as exc:
        raise ValueError(
            'La caja ya tiene una seccion abierta en esta sucursal.'
        ) from exc


@transaction.atomic
def cerrar_seccion(seccion, montos_reales, observaciones=None):
    """Cierra la seccion con los montos reales contados por el usuario.

    `montos_reales` es un diccionario `{metodo_pago_id_o_instancia: monto}`.
    """
    seccion = SeccionCaja.objects.select_for_update().get(pk=seccion.pk)
    if seccion.estado != SeccionCaja.EstadoSeccion.ABIERTA:
        raise ValueError('La seccion de caja no esta abierta.')

    reales = {}
    for clave, valor in montos_reales.items():
        metodo_id = clave.id if hasattr(clave, 'id') else int(clave)
        reales[metodo_id] = _decimal(valor)

    detalles = []
    for item in calcular_teorico(seccion):
        metodo = item['metodo_pago']
        real = reales.pop(metodo.id, Decimal('0.00'))
        detalles.append(
            DetalleCierreCaja.objects.create(
                seccion_caja=seccion,
                metodo_pago=metodo,
                monto_sistema=item['monto_sistema'],
                monto_real=real,
            )
        )

    for metodo_id, real in reales.items():
        metodo = MetodoPago.objects.get(pk=metodo_id)
        detalles.append(
            DetalleCierreCaja.objects.create(
                seccion_caja=seccion,
                metodo_pago=metodo,
                monto_sistema=Decimal('0.00'),
                monto_real=real,
            )
        )

    seccion.monto_teorico = sum(
        (detalle.monto_sistema for detalle in detalles),
        Decimal('0.00'),
    )
    seccion.monto_final = sum(
        (detalle.monto_real for detalle in detalles),
        Decimal('0.00'),
    )
    seccion.fecha_hora_cierre = timezone.now()
    seccion.estado = SeccionCaja.EstadoSeccion.CERRADA
    seccion.observaciones = observaciones
    seccion.save()
    return seccion


@transaction.atomic
def auditar_seccion(seccion):
    seccion = SeccionCaja.objects.select_for_update().get(pk=seccion.pk)
    if seccion.estado != SeccionCaja.EstadoSeccion.CERRADA:
        raise ValueError('Solo se puede auditar una seccion cerrada.')
    seccion.estado = SeccionCaja.EstadoSeccion.AUDITADA
    seccion.save(update_fields=['estado'])
    return seccion
