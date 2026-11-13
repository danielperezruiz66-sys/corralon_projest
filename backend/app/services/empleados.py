"""Alta, baja y acceso de empleados.

El sync de roles y sucursales sigue el mismo criterio que el sync de
`ProductoXSucursal`: los cambios se hacen en la misma transacción que crea o
edita el empleado, los registros que salen pasan a `IN` (no se borran, para
conservar historial) y los que entran se reactivan o se crean nuevos.
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from ..models import (
    EmpleadoXRol,
    SucursalXEmpleado,
)


def sincronizar_roles(empleado, roles):
    """Deja `roles_asignados` con los roles indicados (activos)."""
    roles = list(roles)
    actuales = {
        asignacion.rol_id: asignacion
        for asignacion in empleado.roles_asignados.all()
    }
    ids = {
        rol.id if hasattr(rol, 'id') else rol
        for rol in roles
    }
    for rol_id in ids:
        asignacion = actuales.get(rol_id)
        if asignacion is not None:
            if asignacion.estado != 'AC':
                asignacion.estado = 'AC'
                asignacion.save(update_fields=['estado'])
        else:
            EmpleadoXRol.objects.create(empleado=empleado, rol_id=rol_id)
    for rol_id, asignacion in actuales.items():
        if rol_id not in ids and asignacion.estado == 'AC':
            asignacion.estado = 'IN'
            asignacion.save(update_fields=['estado'])
    return empleado


def sincronizar_sucursales(empleado, sucursales):
    """Deja `sucursales_asignadas` con las sucursales indicadas (activas)."""
    sucursales = list(sucursales)
    actuales = {
        asignacion.sucursal_id: asignacion
        for asignacion in empleado.sucursales_asignadas.all()
    }
    ids = {
        sucursal.id if hasattr(sucursal, 'id') else sucursal
        for sucursal in sucursales
    }
    for sucursal_id in ids:
        asignacion = actuales.get(sucursal_id)
        if asignacion is not None:
            if not asignacion.estado:
                asignacion.estado = True
                asignacion.save(update_fields=['estado'])
        else:
            SucursalXEmpleado.objects.create(
                sucursal_id=sucursal_id,
                empleado=empleado,
                fecha_asociacion=timezone.now().date(),
                estado=True,
            )
    for sucursal_id, asignacion in actuales.items():
        if sucursal_id not in ids and asignacion.estado:
            asignacion.estado = False
            asignacion.save(update_fields=['estado'])
    return empleado


def invalidar_sesiones(empleado):
    """Invalida los refresh tokens del empleado (cierra sus sesiones)."""
    usuario = empleado.usuario
    if usuario is None:
        return
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    for token in OutstandingToken.objects.filter(user=usuario):
        BlacklistedToken.objects.get_or_create(token=token)


def cambiar_password(empleado, password):
    """Cambia la contraseña del usuario del empleado e invalida sus tokens."""
    usuario = empleado.usuario
    if usuario is None:
        raise ValueError(
            'El empleado no tiene un usuario asociado. '
            'Creá el acceso primero.'
        )
    try:
        validate_password(password, usuario)
    except DjangoValidationError as exc:
        raise ValueError(' '.join(exc.messages)) from exc
    usuario.set_password(password)
    usuario.save(update_fields=['password'])
    invalidar_sesiones(empleado)
    return usuario
