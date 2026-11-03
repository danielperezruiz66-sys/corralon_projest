"""Permisos basados en los roles del corralon.

Reglas generales:

- Cualquier usuario autenticado puede leer.
- Para escribir hace falta un rol activo del empleado (`EmpleadoXRol.estado`).
- `is_superuser` y el rol `Admin` pueden todo.
- Un usuario sin empleado o sin rol queda en solo lectura.

Los viewsets declaran que roles pueden escribir en ellos con el atributo
`roles_escritura`.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Rol

ADMIN = Rol.CodigoRol.ADMIN
GERENTE = Rol.CodigoRol.GERENTE
CAJERO = Rol.CodigoRol.CAJERO
VENDEDOR = Rol.CodigoRol.VENDEDOR
DEPOSITO = Rol.CodigoRol.DEPOSITO

# Roles con acceso a la gestion completa del sistema.
GESTION = (ADMIN, GERENTE)


def codigos_activos(user):
    """Codigos de los roles activos del empleado asociado al usuario."""
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return {ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO}

    empleado = getattr(user, 'empleado', None)
    if empleado is None:
        return set()

    return set(
        empleado.roles_asignados.filter(estado='AC', rol__codigo__isnull=False)
        .values_list('rol__codigo', flat=True)
    )


def es_admin(user):
    return bool(user and user.is_superuser) or ADMIN in codigos_activos(user)


class PermisoPorRol(BasePermission):
    """Lectura libre para autenticados; escritura segun `roles_escritura`."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True

        roles = getattr(view, 'roles_escritura', ())
        if not roles:
            return False
        return bool(codigos_activos(request.user) & set(roles))
