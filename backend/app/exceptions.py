"""Manejo uniforme de los errores de negocio en la API.

Los servicios lanzan `ValueError` y `StockInsuficiente` cuando se rompe una
regla del negocio. Sin este handler, DRF los dejaria escapar como `500`.
Aqui se traducen a respuestas `400` con un mensaje claro y un `codigo` estable
para que el cliente pueda distinguirlos.

Las excepciones propias de DRF (`APIException`: 401, 403, 404, 405, ...) se
devuelven tal cual las arma el handler por defecto.
"""

from django.core.exceptions import ObjectDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .services.stock import StockInsuficiente


def corralon_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, StockInsuficiente):
        return Response(
            {'detail': str(exc), 'codigo': 'stock_insuficiente'},
            status=400,
        )

    if isinstance(exc, DjangoValidationError):
        return Response(
            {'detail': exc.messages, 'codigo': 'validacion'},
            status=400,
        )

    if isinstance(exc, ObjectDoesNotExist):
        return Response(
            {'detail': 'El objeto solicitado no existe.', 'codigo': 'no_encontrado'},
            status=404,
        )

    if isinstance(exc, ValueError):
        return Response(
            {'detail': str(exc), 'codigo': 'error_de_negocio'},
            status=400,
        )

    return None
