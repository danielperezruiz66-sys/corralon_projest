"""Apertura y cierre de cajas.

El cierre guarda dos totales:

- `monto_teorico`: lo que el sistema calcula con los pagos de la seccion.
- `monto_final`: lo que el usuario cuenta realmente.

El detalle por metodo de pago queda en `DetalleCierreCaja` (`monto_sistema` vs
`monto_real`), con la diferencia calculada.
"""

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Exists, OuterRef, Q, Sum
from django.utils import timezone

from ..models import (
    Caja,
    Compra,
    DetalleCierreCaja,
    Empleado,
    EmpleadoXRol,
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

# Roles que habilitan abrir una seccion de caja.
ROLES_CAJA = {
    Rol.CodigoRol.ADMIN,
    Rol.CodigoRol.GERENTE,
    Rol.CodigoRol.CAJERO,
}


def _decimal(valor):
    return Decimal(str(valor))


def _roles_activos(empleado):
    """Codigos de rol activos del empleado (sin exigir sucursal)."""
    return set(
        empleado.roles_asignados.filter(
            estado='AC',
            rol__codigo__isnull=False,
        ).values_list('rol__codigo', flat=True)
    )


def _empleado_puede_operar_sucursal(empleado, sucursal):
    """AD/GE operan en cualquier sucursal; el resto solo en las asignadas."""
    roles = _roles_activos(empleado)
    if roles & ROLES_GESTION:
        return True
    return SucursalXEmpleado.objects.filter(
        empleado=empleado,
        sucursal=sucursal,
        estado=True,
    ).exists()


def empleados_que_pueden_abrir_caja(queryset, sucursal_id):
    """Empleados activos que pueden abrir caja en la sucursal dada.

    AD/GE (activos) pueden en cualquier sucursal; un CA solo si esta asignado
    a la sucursal. Quedan fuera los que ya tienen una seccion abierta (un
    empleado no puede abrir dos cajas a la vez). Se usa en el filtro
    `?puede_operar_caja=` del endpoint de empleados (el dropdown de apertura)
    y en los tests de la regla.
    """
    gestion = EmpleadoXRol.objects.filter(
        empleado=OuterRef('pk'),
        estado='AC',
        rol__codigo__in=[Rol.CodigoRol.ADMIN, Rol.CodigoRol.GERENTE],
    )
    cajero = EmpleadoXRol.objects.filter(
        empleado=OuterRef('pk'),
        estado='AC',
        rol__codigo=Rol.CodigoRol.CAJERO,
    )
    asignado = SucursalXEmpleado.objects.filter(
        empleado=OuterRef('pk'),
        sucursal_id=sucursal_id,
        estado=True,
    )
    abierta = SeccionCaja.objects.filter(
        empleado=OuterRef('pk'),
        estado=SeccionCaja.EstadoSeccion.ABIERTA,
    )
    return queryset.filter(estado=Empleado.EstadoEmpleado.ACTIVO).filter(
        Q(Exists(gestion)) | (Q(Exists(cajero)) & Q(Exists(asignado)))
    ).filter(~Exists(abierta))


def sugerir_apertura(caja, sucursal):
    """Sugerencia de monto inicial para abrir una seccion.

    Devuelve el efectivo contado (`monto_real` del metodo es_efectivo) en la
    ultima seccion cerrada o auditada de esa caja en esa sucursal. Si nunca
    se cerro una seccion ahi, sugiere 0.00 con `encontrado=False`.
    """
    caja_id = getattr(caja, 'pk', caja)
    sucursal_id = getattr(sucursal, 'pk', sucursal)
    asignacion = (
        SucursalXCaja.objects.select_related('caja', 'sucursal')
        .filter(caja_id=caja_id, sucursal_id=sucursal_id)
        .first()
    )
    if asignacion is None:
        return {
            'monto_sugerido': Decimal('0.00'),
            'encontrado': False,
            'seccion_id': None,
            'fecha_hora_cierre': None,
        }
    ultima = (
        SeccionCaja.objects.filter(
            sucursal_caja=asignacion,
            estado__in=[
                SeccionCaja.EstadoSeccion.CERRADA,
                SeccionCaja.EstadoSeccion.AUDITADA,
            ],
            fecha_hora_cierre__isnull=False,
        )
        .order_by('-fecha_hora_cierre')
        .prefetch_related('detalles_cierre__metodo_pago')
        .first()
    )
    if ultima is None:
        return {
            'monto_sugerido': Decimal('0.00'),
            'encontrado': False,
            'seccion_id': None,
            'fecha_hora_cierre': None,
        }
    efectivo = next(
        (
            detalle
            for detalle in ultima.detalles_cierre.all()
            if detalle.metodo_pago.es_efectivo
        ),
        None,
    )
    return {
        'monto_sugerido': (
            efectivo.monto_real if efectivo is not None else Decimal('0.00')
        ),
        'encontrado': True,
        'seccion_id': ultima.id,
        'fecha_hora_cierre': ultima.fecha_hora_cierre,
    }


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
def abrir_seccion(
    caja,
    sucursal,
    empleado,
    monto_inicial,
    historial_motivo=None,
    historial_usuario=None,
    observaciones_apertura=None,
):
    """Abre una seccion para una caja fisica en una sucursal.

    Valida que la caja este asignada y habilitada en la sucursal, que este
    activa, que el empleado tenga permiso de abrir caja (rol AD/GE/CA con la
    regla de sucursal: AD/GE en cualquiera, CA asignado), que no tenga ya
    una seccion abierta (un empleado no puede abrir dos cajas a la vez) y
    que no exista otra seccion abierta para la misma asignacion (misma caja
    en la misma sucursal).

    `observaciones_apertura` es obligatoria cuando el `monto_inicial` difiere
    del sugerido por `sugerir_apertura` (el efectivo contado en el ultimo
    cierre de la caja en la sucursal).

    `historial_motivo` se guarda como `history_change_reason` del alta y
    `historial_usuario` como `history_user` (por defecto los toma del
    middleware); la vista los completa al abrir a nombre de otro empleado.
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
    if empleado is None:
        raise ValueError(
            'El usuario autenticado no tiene un empleado asociado. '
            'Asociele un empleado o indique a nombre de quien abrir la caja.'
        )
    if empleado.estado != Empleado.EstadoEmpleado.ACTIVO:
        raise ValueError(
            'El empleado a nombre de quien se abre la seccion no esta activo.'
        )
    if not _roles_activos(empleado) & ROLES_CAJA:
        raise ValueError(
            'El empleado no tiene permisos para abrir una seccion de caja.'
        )
    if not _empleado_puede_operar_sucursal(empleado, asignacion.sucursal):
        raise ValueError(
            'El empleado no esta asignado a la sucursal de la caja.'
        )
    if SeccionCaja.objects.filter(
        empleado=empleado,
        estado=SeccionCaja.EstadoSeccion.ABIERTA,
    ).exists():
        raise ValueError('El empleado ya tiene una seccion de caja abierta.')
    if SeccionCaja.objects.filter(
        sucursal_caja=asignacion,
        estado=SeccionCaja.EstadoSeccion.ABIERTA,
    ).exists():
        raise ValueError('La caja ya tiene una seccion abierta en esta sucursal.')

    sugerencia = sugerir_apertura(asignacion.caja, asignacion.sucursal)
    observaciones_apertura = (observaciones_apertura or '').strip()
    if (
        monto_inicial != sugerencia['monto_sugerido']
        and not observaciones_apertura
    ):
        raise ValueError(
            'Indicá el motivo del monto inicial: difiere del efectivo contado '
            'en el último cierre de la caja.'
        )

    try:
        with transaction.atomic():
            seccion = SeccionCaja(
                sucursal_caja=asignacion,
                empleado=empleado,
                fecha_hora_apertura=timezone.now(),
                monto_inicial=monto_inicial,
                estado=SeccionCaja.EstadoSeccion.ABIERTA,
                observaciones_apertura=observaciones_apertura or None,
            )
            if historial_motivo:
                seccion._change_reason = historial_motivo[:100]
            if historial_usuario is not None and historial_usuario.is_authenticated:
                seccion._history_user = historial_usuario
            seccion.save()
            return seccion
    except IntegrityError as exc:
        raise ValueError(
            'La caja ya tiene una seccion abierta en esta sucursal.'
        ) from exc


@transaction.atomic
def cerrar_seccion(seccion, montos_reales, observaciones=None):
    """Cierra la seccion con los montos reales contados por el usuario.

    `montos_reales` es un diccionario `{metodo_pago_id_o_instancia: monto}`.
    Si el arqueo tiene diferencia, la primera linea de `observaciones` es una
    nota del sistema inborrable con el monto y la direccion (faltante/
    sobrante); el usuario puede agregar sus observaciones en lineas siguientes.
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

    # Si el arqueo no cierra exacto, la primera linea es una nota del
    # sistema inborrable (como la nota de origen de las transferencias);
    # el usuario puede sumar sus observaciones en lineas siguientes.
    diferencia = seccion.monto_final - seccion.monto_teorico
    observaciones = (observaciones or '').strip()
    if diferencia != 0:
        direccion = 'faltante' if diferencia < 0 else 'sobrante'
        signo = '-' if diferencia < 0 else '+'
        monto = abs(diferencia).quantize(Decimal('0.01'))
        nota = f'Diferencia de arqueo: {signo}${monto} ({direccion}).'
        observaciones = (
            f'{nota}\nObservación: {observaciones}'
            if observaciones
            else nota
        )
    seccion.observaciones = observaciones or None
    seccion.fecha_hora_cierre = timezone.now()
    seccion.estado = SeccionCaja.EstadoSeccion.CERRADA
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
