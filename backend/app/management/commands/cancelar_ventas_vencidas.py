"""Cancela ventas pendientes vencidas y restaura el stock."""

from django.conf import settings
from django.core.management.base import BaseCommand

from app.services.ventas import cancelar_ventas_vencidas


class Command(BaseCommand):
    help = (
        'Cancela las ventas pendientes que superaron el umbral configurado '
        'y restaura el stock. Pensado para ejecutarse periodicamente '
        '(cron o Task Scheduler).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutos',
            type=int,
            default=None,
            help=(
                'Antiguedad minima en minutos para cancelar '
                f'(default: {settings.VENTAS_MINUTOS_PARA_CONFIRMAR}).'
            ),
        )

    def handle(self, *args, **options):
        cantidad = cancelar_ventas_vencidas(minutos=options['minutos'])
        self.stdout.write(
            self.style.SUCCESS(f'{cantidad} ventas canceladas.')
        )
