from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from app.models import Venta
from app.services.ventas import cancelar_ventas_vencidas

from .base import BaseCorralonTestCase


class AutoCancelacionTests(BaseCorralonTestCase):
    def _venta_pendiente(self, minutos):
        respuesta = self.crear_venta(cantidad='1.000')
        self.assertEqual(respuesta.status_code, 201)
        venta = Venta.objects.get(pk=respuesta.data['id'])
        Venta.objects.filter(pk=venta.pk).update(
            fecha_venta=timezone.now() - timedelta(minutes=minutos)
        )
        return venta

    def test_cancela_venta_de_31_minutos(self):
        venta = self._venta_pendiente(31)

        cantidad = cancelar_ventas_vencidas()

        self.assertEqual(cantidad, 1)
        venta.refresh_from_db()
        self.assertEqual(venta.estado, Venta.EstadoVenta.ANULADA)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))

    def test_no_cancela_venta_de_29_minutos(self):
        venta = self._venta_pendiente(29)

        cantidad = cancelar_ventas_vencidas()

        self.assertEqual(cantidad, 0)
        venta.refresh_from_db()
        self.assertEqual(venta.estado, Venta.EstadoVenta.PENDIENTE)

    def test_no_cancela_ventas_confirmadas(self):
        venta = self._venta_pendiente(31)
        venta.estado = Venta.EstadoVenta.CONFIRMADA
        venta.save(update_fields=['estado'])

        cantidad = cancelar_ventas_vencidas()

        self.assertEqual(cantidad, 0)
        venta.refresh_from_db()
        self.assertEqual(venta.estado, Venta.EstadoVenta.CONFIRMADA)

    def test_no_cancela_ventas_con_pagos(self):
        venta = self._venta_pendiente(31)
        self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta.id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '50.00',
            },
            format='json',
        )

        cantidad = cancelar_ventas_vencidas()

        self.assertEqual(cantidad, 0)
        venta.refresh_from_db()
        self.assertEqual(venta.estado, Venta.EstadoVenta.PARCIAL)

    @override_settings(VENTAS_MINUTOS_PARA_CONFIRMAR=15)
    def test_respeta_el_umbral_configurado(self):
        venta = self._venta_pendiente(16)

        cantidad = cancelar_ventas_vencidas()

        self.assertEqual(cantidad, 1)
        venta.refresh_from_db()
        self.assertEqual(venta.estado, Venta.EstadoVenta.ANULADA)

    def test_comando_aplica_el_umbral(self):
        self._venta_pendiente(31)
        salida = StringIO()

        call_command('cancelar_ventas_vencidas', stdout=salida)

        self.assertIn('1 ventas canceladas', salida.getvalue())

    def test_comando_acepta_minutos(self):
        self._venta_pendiente(20)
        salida = StringIO()

        call_command('cancelar_ventas_vencidas', '--minutos', '10', stdout=salida)

        self.assertIn('1 ventas canceladas', salida.getvalue())
