"""Reglas de acceso por sucursal.

El sistema opera hoy con una sola sucursal, pero la base soporta varias. Un
usuario solo puede operar y consultar las sucursales que tiene asignadas; el
superusuario y el rol `AD` ven todas.

Se usa desde las vistas (filtros de queryset) y los serializers (validacion de
escrituras) para que ninguna peticion pueda cruzar de sucursal.
"""

from ..models import Sucursal
from ..permissions import ADMIN, codigos_activos


def sucursales_permitidas(user):
    """Sucursales que puede ver el usuario.

    Devuelve `None` cuando ve todas (superusuario o `AD`) y un queryset con
    las asignadas en el resto de los casos. Un usuario sin empleado no tiene
    sucursales.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return Sucursal.objects.none()

    if user.is_superuser or ADMIN in codigos_activos(user):
        return None

    empleado = getattr(user, 'empleado', None)
    if empleado is None:
        return Sucursal.objects.none()

    return Sucursal.objects.filter(
        empleados_asignados__empleado=empleado,
        empleados_asignados__estado=True,
    ).distinct()


def sucursal_permitida(user, sucursal_id):
    """True si el usuario puede operar en esa sucursal."""
    permitidas = sucursales_permitidas(user)
    if permitidas is None:
        return True
    if sucursal_id in (None, ''):
        return False
    try:
        return permitidas.filter(pk=sucursal_id).exists()
    except (TypeError, ValueError):
        return False


def filtrar_por_sucursal(queryset, user, campo):
    """Limita el queryset a las sucursales permitidas.

    `campo` es la ruta al id de sucursal (por ejemplo `sucursal` o
    `movimiento_caja__caja__sucursal`).
    """
    permitidas = sucursales_permitidas(user)
    if permitidas is None:
        return queryset
    return queryset.filter(**{f'{campo}__in': permitidas})


def sucursales_asignables(user):
    """Sucursales que el usuario puede asignar a otra persona.

    Es la misma regla que para operar: nadie asigna una sucursal que no ve.
    """
    return sucursales_permitidas(user)
