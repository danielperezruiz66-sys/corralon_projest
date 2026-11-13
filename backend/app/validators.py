"""Validadores de contraseña del sistema."""

import re

from django.core.exceptions import ValidationError


class LetraNumeroSimboloValidator:
    """La contraseña debe combinar letras, números y símbolos.

    Sin longitud mínima fija: alcanza con al menos un carácter de cada
    clase (letra, número y símbolo).
    """

    def validate(self, password, user=None):
        faltantes = []
        if not re.search(r'[A-Za-z]', password or ''):
            faltantes.append('una letra')
        if not re.search(r'\d', password or ''):
            faltantes.append('un número')
        if not re.search(r'[^A-Za-z0-9]', password or ''):
            faltantes.append('un símbolo')
        if faltantes:
            raise ValidationError(
                'La contraseña debe tener ' + ', '.join(faltantes) + '.'
            )

    def get_help_text(self):
        return 'La contraseña debe tener letras, números y un símbolo.'
