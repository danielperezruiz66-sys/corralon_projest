"""Cancela ventas pendientes vencidas y restaura el stock."""

from django.core.management.base import BaseCommand

from app.services.ventas import cancelar_ventas_vencidas


class Command(BaseCommand):
    help = (
        'Cancela las ventas pendientes con mas de 1 hora y restaura el stock. '
        'Pensado para ejecutarse periodicamente (cron o Task Scheduler).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--horas',
            type=int,
            default=1,
            help='Antiguedad minima en horas para cancelar (default: 1).',
        )

    def handle(self, *args, **options):
        cantidad = cancelar_ventas_vencidas(horas=options['horas'])
        self.stdout.write(
            self.style.SUCCESS(f'{cantidad} ventas canceladas.')
        )
