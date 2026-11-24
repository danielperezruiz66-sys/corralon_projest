"""Limites de intentos para los endpoints de autenticacion.

`/api/token/` acepta usuario o legajo y contraseña, y no tenía ningún límite:
era el punto natural para probar contraseñas por fuerza bruta. El límite es
por IP (el usuario todavía no está autenticado) y se configura en
`DEFAULT_THROTTLE_RATES` con las claves `token` y `refresh`.

Para una instancia con todos los empleados detrás de una misma IP (el caso de
un corralón) el límite es generoso a propósito: corta un ataque automático sin
bloquear los ingresos de un cambio de turno.
"""

from rest_framework.throttling import AnonRateThrottle


class TokenRateThrottle(AnonRateThrottle):
    scope = 'token'


class RefreshRateThrottle(AnonRateThrottle):
    scope = 'refresh'
