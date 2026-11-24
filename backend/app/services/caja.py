"""Apertura y cierre de cajas.

Cada `Caja` pertenece a una sucursal y cada sesion de trabajo es un
`MovimientoCaja`. El cierre guarda dos totales:

- `monto_teorico`: lo que el sistema calcula con los pagos del movimiento.
- `monto_final`: lo que el usuario cuenta realmente.

El detalle por metodo de pago queda en `DetalleCierreCaja` (`monto_sistema` vs
`monto_real`), con la diferencia calculada.

Para cerrar se exige la contraseña del usuario autenticado: no se guarda, solo
se valida. Quien cerro queda en el historial (`history_user`).
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
    MovimientoCaja,
    Rol,
    SucursalXEmpleado,
    Venta,
)

ROLES_GESTION = {Rol.CodigoRol.ADMIN, Rol.CodigoRol.GERENTE}

# Roles que habilitan abrir un movimiento de caja.
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
    a la sucursal. Quedan fuera los que ya tienen un movimiento abierto o en
    pausa (un empleado no puede manejar dos cajas a la vez).
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
    abierta = MovimientoCaja.objects.filter(
        empleado=OuterRef('pk'),
        estado__in=[
            MovimientoCaja.EstadoMovimiento.ABIERTA,
            MovimientoCaja.EstadoMovimiento.PAUSADA,
        ],
    )
    return queryset.filter(estado=Empleado.EstadoEmpleado.ACTIVO).filter(
        Q(Exists(gestion)) | (Q(Exists(cajero)) & Q(Exists(asignado)))
    ).filter(~Exists(abierta))


def sugerir_apertura(caja):
    """Sugerencia de monto inicial para abrir un movimiento.

    Devuelve el efectivo contado (`monto_real` del metodo es_efectivo) en el
    ultimo movimiento cerrado o auditado de esa caja. Si nunca se cerro,
    sugiere 0.00 con `encontrado=False`.
    """
    caja_id = getattr(caja, 'pk', caja)
    ultima = (
        MovimientoCaja.objects.filter(
            caja_id=caja_id,
            estado__in=[
                MovimientoCaja.EstadoMovimiento.CERRADA,
                MovimientoCaja.EstadoMovimiento.AUDITADA,
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


def calcular_teorico(movimiento):
    """Devuelve una lista de `{metodo_pago, monto_sistema}`."""
    ventas = movimiento.ventas.exclude(estado=Venta.EstadoVenta.ANULADA)
    compras = movimiento.compras.exclude(estado=Compra.EstadoCompra.ANULADA)

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
            sistema += movimiento.monto_inicial
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
    empleado,
    monto_inicial,
    historial_motivo=None,
    historial_usuario=None,
    observaciones_apertura=None,
):
    """Abre un movimiento de caja para una caja fisica.

    Valida que la caja este activa, que el empleado tenga permiso de abrir
    caja (rol AD/GE/CA con la regla de sucursal: AD/GE en cualquiera, CA
    asignado), que no tenga ya un movimiento abierto o en pausa y que no
    exista otro movimiento abierto o en pausa para la misma caja.

    `observaciones_apertura` es obligatoria cuando el `monto_inicial` difiere
    del sugerido por `sugerir_apertura` (el efectivo contado en el ultimo
    cierre de la caja).

    `historial_motivo` se guarda como `history_change_reason` del alta y
    `historial_usuario` como `history_user` (por defecto los toma del
    middleware); la vista los completa al abrir a nombre de otro empleado.
    """
    monto_inicial = _decimal(monto_inicial)
    if monto_inicial < 0:
        raise ValueError('El monto inicial no puede ser negativo.')

    caja_id = getattr(caja, 'pk', caja)
    caja = (
        Caja.objects.select_for_update()
        .select_related('sucursal')
        .get(pk=caja_id)
    )
    if caja.estado != Caja.EstadoCaja.ACTIVA:
        raise ValueError('La caja no esta activa.')
    if empleado is None:
        raise ValueError(
            'El usuario autenticado no tiene un empleado asociado. '
            'Asociele un empleado o indique a nombre de quien abrir la caja.'
        )
    if empleado.estado != Empleado.EstadoEmpleado.ACTIVO:
        raise ValueError(
            'El empleado a nombre de quien se abre el movimiento no esta activo.'
        )
    if not _roles_activos(empleado) & ROLES_CAJA:
        raise ValueError(
            'El empleado no tiene permisos para abrir un movimiento de caja.'
        )
    if not _empleado_puede_operar_sucursal(empleado, caja.sucursal):
        raise ValueError(
            'El empleado no esta asignado a la sucursal de la caja.'
        )
    if MovimientoCaja.objects.filter(
        empleado=empleado,
        estado__in=[
            MovimientoCaja.EstadoMovimiento.ABIERTA,
            MovimientoCaja.EstadoMovimiento.PAUSADA,
        ],
    ).exists():
        raise ValueError('El empleado ya tiene un movimiento de caja abierto.')

    sugerencia = sugerir_apertura(caja)
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
            movimiento = MovimientoCaja(
                caja=caja,
                empleado=empleado,
                fecha_hora_apertura=timezone.now(),
                monto_inicial=monto_inicial,
                estado=MovimientoCaja.EstadoMovimiento.ABIERTA,
                observaciones_apertura=observaciones_apertura or None,
            )
            if historial_motivo:
                movimiento._change_reason = historial_motivo[:100]
            if historial_usuario is not None and historial_usuario.is_authenticated:
                movimiento._history_user = historial_usuario
            movimiento.save()
            return movimiento
    except IntegrityError as exc:
        raise ValueError(
            'La caja ya tiene un movimiento abierto en esta sucursal.'
        ) from exc


@transaction.atomic
def cerrar_seccion(
    movimiento,
    montos_reales,
    observaciones=None,
    clave='',
    password=None,
    usuario=None,
):
    """Cierra el movimiento con los montos reales contados por el usuario.

    `montos_reales` es un diccionario `{metodo_pago_id_o_instancia: monto}`.
    Si el arqueo tiene diferencia, la primera linea de `observaciones` es una
    nota del sistema inborrable con el monto y la direccion (faltante/
    sobrante); el usuario puede agregar sus observaciones en lineas siguientes.

    `password` es la contraseña del usuario autenticado y es obligatoria.
    `clave` es la clave de idempotencia: si se reintenta el mismo cierre, no
    se repite el arqueo.
    """
    if (
        usuario is None
        or not password
        or not usuario.check_password(password)
    ):
        raise ValueError('La contraseña del usuario autenticado no es correcta.')

    movimiento = MovimientoCaja.objects.select_for_update().get(pk=movimiento.pk)
    if clave and movimiento.clave_cierre == clave:
        # El cierre ya se registro con esta misma operacion.
        return movimiento
    if movimiento.estado == MovimientoCaja.EstadoMovimiento.PAUSADA:
        raise ValueError(
            'La sección está en pausa: primero hay que reanudarla.'
        )
    if movimiento.estado != MovimientoCaja.EstadoMovimiento.ABIERTA:
        raise ValueError('El movimiento de caja no esta abierto.')

    reales = {}
    for metodo_clave, valor in montos_reales.items():
        metodo_id = (
            metodo_clave.id if hasattr(metodo_clave, 'id') else int(metodo_clave)
        )
        reales[metodo_id] = _decimal(valor)

    detalles = []
    for item in calcular_teorico(movimiento):
        metodo = item['metodo_pago']
        real = reales.pop(metodo.id, Decimal('0.00'))
        detalles.append(
            DetalleCierreCaja.objects.create(
                movimiento_caja=movimiento,
                metodo_pago=metodo,
                monto_sistema=item['monto_sistema'],
                monto_real=real,
            )
        )

    for metodo_id, real in reales.items():
        metodo = MetodoPago.objects.get(pk=metodo_id)
        detalles.append(
            DetalleCierreCaja.objects.create(
                movimiento_caja=movimiento,
                metodo_pago=metodo,
                monto_sistema=Decimal('0.00'),
                monto_real=real,
            )
        )

    movimiento.monto_teorico = sum(
        (detalle.monto_sistema for detalle in detalles),
        Decimal('0.00'),
    )
    movimiento.monto_final = sum(
        (detalle.monto_real for detalle in detalles),
        Decimal('0.00'),
    )

    # Si el arqueo no cierra exacto, la primera linea es una nota del
    # sistema inborrable; el usuario puede sumar sus observaciones en
    # lineas siguientes.
    diferencia = movimiento.monto_final - movimiento.monto_teorico
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
    movimiento.observaciones = observaciones or None
    movimiento.fecha_hora_cierre = timezone.now()
    movimiento.estado = MovimientoCaja.EstadoMovimiento.CERRADA
    movimiento.clave_cierre = clave or movimiento.clave_cierre
    movimiento.save()
    return movimiento


@transaction.atomic
def auditar_seccion(movimiento):
    movimiento = MovimientoCaja.objects.select_for_update().get(pk=movimiento.pk)
    if movimiento.estado != MovimientoCaja.EstadoMovimiento.CERRADA:
        raise ValueError('Solo se puede auditar un movimiento cerrado.')
    movimiento.estado = MovimientoCaja.EstadoMovimiento.AUDITADA
    movimiento.save(update_fields=['estado'])
    return movimiento


def _es_dueno(movimiento, usuario):
    """True si el usuario es el empleado que abrio el movimiento."""
    empleado = getattr(usuario, 'empleado', None)
    return empleado is not None and movimiento.empleado_id == empleado.id


def _puede_gestionar(usuario):
    """True si el usuario es admin o gerente."""
    if usuario is None or not usuario.is_authenticated:
        return False
    if usuario.is_superuser:
        return True
    empleado = getattr(usuario, 'empleado', None)
    if empleado is None:
        return False
    return bool(_roles_activos(empleado) & ROLES_GESTION)


@transaction.atomic
def pausar_seccion(movimiento, motivo, usuario):
    """Deja el movimiento en pausa.

    La caja queda bloqueada: no se pueden registrar ventas ni pagos sobre
    ella y el empleado no puede abrir otro movimiento. Queda registrado quien
    pauso, cuando y por que (historial del movimiento).
    """
    motivo = (motivo or '').strip()
    if len(motivo) < 10:
        raise ValueError('Explicá el motivo de la pausa (10 caracteres o más).')

    movimiento = MovimientoCaja.objects.select_for_update().get(pk=movimiento.pk)
    if movimiento.estado != MovimientoCaja.EstadoMovimiento.ABIERTA:
        raise ValueError('Solo se puede pausar un movimiento abierto.')
    if not _es_dueno(movimiento, usuario) and not _puede_gestionar(usuario):
        raise ValueError(
            'Solo el empleado que abrió el movimiento puede pausarlo.'
        )

    movimiento._change_reason = f'Pausa de caja: {motivo}'[:100]
    movimiento.estado = MovimientoCaja.EstadoMovimiento.PAUSADA
    movimiento.motivo_pausa = motivo
    movimiento.save(update_fields=['estado', 'motivo_pausa'])
    return movimiento


@transaction.atomic
def reanudar_seccion(movimiento, clave, usuario):
    """Vuelve a abrir un movimiento pausado.

    Puede reanudarlo el dueño o un gestor con la contraseña del empleado que
    abrió la sección o con la propia del gestor.
    """
    movimiento = MovimientoCaja.objects.select_for_update().get(pk=movimiento.pk)
    if movimiento.estado != MovimientoCaja.EstadoMovimiento.PAUSADA:
        raise ValueError('El movimiento de caja no esta pausado.')
    es_dueno = _es_dueno(movimiento, usuario)
    puede_gestionar = _puede_gestionar(usuario)
    if not es_dueno and not puede_gestionar:
        raise ValueError(
            'Solo el empleado que abrió la sección o un gestor puede reanudarlo.'
        )
    dueno = movimiento.empleado
    valida_dueno = bool(clave) and (
        dueno is not None
        and dueno.usuario is not None
        and dueno.usuario.check_password(clave)
    )
    valida_gestor = (
        bool(clave) and puede_gestionar and usuario.check_password(clave)
    )
    if not valida_dueno and not valida_gestor:
        raise ValueError(
            'La contraseña del empleado que abrió la sección o la del '
            'administrador no es correcta.'
        )

    movimiento._change_reason = 'Reanudación de caja con contraseña autorizada'[:100]
    movimiento.estado = MovimientoCaja.EstadoMovimiento.ABIERTA
    movimiento.motivo_pausa = ''
    movimiento.save(update_fields=['estado', 'motivo_pausa'])
    return movimiento
