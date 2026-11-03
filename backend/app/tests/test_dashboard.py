from decimal import Decimal

from app.models import Stock

from .base import BaseCorralonTestCase


class DashboardApiTests(BaseCorralonTestCase):
    def test_dashboard_devuelve_resumen(self):
        self.crear_venta()
        self.stock_poco.cant_min = Decimal('10.000')
        self.stock_poco.save(update_fields=['cant_min'])

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['ventas']['hoy']['cantidad'], 1)
        self.assertEqual(
            Decimal(respuesta.data['ventas']['hoy']['monto']),
            Decimal('200.00'),
        )
        self.assertEqual(respuesta.data['ventas']['pendientes']['cantidad'], 1)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)
        self.assertEqual(respuesta.data['catalogo']['productos'], 2)
        self.assertEqual(respuesta.data['stock']['bajo'], 1)
        self.assertEqual(len(respuesta.data['ventas_por_dia']), 7)
        self.assertEqual(respuesta.data['ventas_recientes'][0]['cliente'], 'Cliente Test')
        self.assertEqual(respuesta.data['stock_critico'][0]['alerta'], 'MINIMO')

    def test_dashboard_exige_autenticacion(self):
        self.client.force_authenticate(user=None)

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 401)
