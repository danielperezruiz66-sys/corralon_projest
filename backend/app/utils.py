"""Utilidades compartidas de validación y reglas simples."""

import re
from decimal import Decimal, InvalidOperation, ROUND_DOWN


def limpiar_texto(valor):
    return str(valor or '').strip()


def validar_ingresos_brutos(valor):
    texto = limpiar_texto(valor)
    if not texto:
        return ''
    if len(texto) > 30:
        return 'Ingresos brutos no puede superar 30 caracteres.'
    if not re.fullmatch(r'[0-9./-]+', texto):
        return (
            'Ingresos brutos solo puede contener números y los separadores . / -'
        )
    return ''


def validar_nombre_consumidor(valor):
    texto = limpiar_texto(valor)
    if not texto:
        return ''
    if len(texto) < 2:
        return 'El nombre del consumidor final debe tener al menos 2 caracteres.'
    if any(caracter.isdigit() for caracter in texto):
        return 'El nombre del consumidor final no puede contener números.'
    if not re.fullmatch(r"[A-Za-zÁÉÍÓÚáéíóúÑñÜü' .-]+", texto):
        return 'El nombre del consumidor final contiene caracteres no válidos.'
    return ''


_UNIDADES_DECIMALES = {
    'm', 'mt', 'mts', 'metro', 'metros',
    'm2', 'm²', 'm3', 'm³',
    'cm', 'mm', 'km',
    'l', 'lt', 'lts', 'litro', 'litros', 'ml',
    'kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos',
    'g', 'gr', 'grs', 'gramo', 'gramos', 'mg',
    'ton', 'tn', 'tonelada', 'toneladas',
}


def unidad_permite_decimales(nombre_unidad):
    texto = limpiar_texto(nombre_unidad).lower()
    if not texto:
        return False
    reemplazos = str.maketrans('áéíóúü', 'aeiouu')
    texto = texto.translate(reemplazos)
    tokens = [token for token in re.split(r'[^a-z0-9³²]+', texto) if token]
    return any(token in _UNIDADES_DECIMALES for token in tokens)


def cantidad_es_entera(valor):
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, TypeError, ValueError):
        return False
    return numero == numero.to_integral_value(rounding=ROUND_DOWN)


def validar_cantidad_por_unidad(
    valor,
    nombre_unidad,
    etiqueta='La cantidad',
    permitir_no_positiva=False,
):
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, TypeError, ValueError):
        return f'{etiqueta} debe ser un número válido.'
    if not permitir_no_positiva and numero <= 0:
        return f'{etiqueta} debe ser mayor a cero.'
    if not unidad_permite_decimales(nombre_unidad):
        if not cantidad_es_entera(numero):
            return (
                f'{etiqueta} debe ser un número entero para esta unidad.'
            )
    return ''
