"""Permisos basados en los roles del corralon.

Reglas generales:

- La lectura se declara por viewset con `roles_lectura`. Si el viewset no
  declara el atributo, cualquier usuario autenticado puede leer (catalogos de
  referencia que usan todos los formularios).
- Para escribir hace falta un rol activo del empleado (`EmpleadoXRol.estado`).
- `is_superuser` y el rol `Admin` pueden todo: el superusuario no necesita rol.
- Un usuario sin empleado o sin rol queda sin acceso a los viewset que
  declaran `roles_lectura`.

Los viewsets declaran que roles pueden leer y escribir en ellos con los
atributos `roles_lectura` y `roles_escritura`.
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


def es_gestion(user):
    """Superuser o rol de administracion (AD/GE)."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(codigos_activos(user) & {ADMIN, GERENTE})


class SoloAdministrador(BasePermission):
    def has_permission(self, request, view):
        return es_admin(request.user)


class PermisoPorRol(BasePermission):
    """Lectura segun `roles_lectura`; escritura segun `roles_escritura`.

    `roles_lectura = None` (o ausente) deja la lectura abierta a cualquier
    usuario autenticado. `roles_escritura` vacio bloquea toda escritura.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        codigos = codigos_activos(request.user)

        if request.method in SAFE_METHODS:
            roles_lectura = getattr(view, 'roles_lectura', None)
            if roles_lectura is None:
                return True
            return bool(codigos & set(roles_lectura))

        roles = getattr(view, 'roles_escritura', ())
        if not roles:
            return False
        return bool(codigos & set(roles))
