"""Autenticación JWT con control de empleados no activos.

Bloquea las peticiones de empleados suspendidos, en baja temporal o inactivos:
ni siquiera con un token válido siguen entrando (si fueron desactivados con la
sesión abierta, el 401 hace que el cliente cierre sesión).
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from .models import Empleado


class EmpleadoActivoJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        # El superusuario sin empleado siempre puede operar (mantenimiento).
        if user.is_superuser:
            return user
        empleado = getattr(user, 'empleado', None)
        if (
            empleado is not None
            and empleado.estado != Empleado.EstadoEmpleado.ACTIVO
        ):
            raise AuthenticationFailed(
                'Tu cuenta fue suspendida o desactivada.'
            )
        return user
