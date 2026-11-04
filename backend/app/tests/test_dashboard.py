from decimal import Decimal

from django.utils import timezone

from app.models import Stock, Sucursal

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
        self.assertEqual(respuesta.data['ventas']['semana']['cantidad'], 1)
        self.assertEqual(
            Decimal(respuesta.data['ventas']['semana']['monto']),
            Decimal('200.00'),
        )
        self.assertEqual(respuesta.data['ventas']['pendientes']['cantidad'], 1)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)
        self.assertEqual(respuesta.data['catalogo']['productos'], 2)
        self.assertEqual(respuesta.data['stock']['bajo'], 1)
        self.assertEqual(len(respuesta.data['ventas_por_dia']), 7)
        self.assertEqual(respuesta.data['ventas_recientes'][0]['cliente'], 'Cliente Test')
        self.assertEqual(respuesta.data['stock_critico'][0]['alerta'], 'MINIMO')
        self.assertEqual(len(respuesta.data['cajas_abiertas']), 1)
        self.assertIsNone(respuesta.data['filtros']['sucursal'])

    def test_dashboard_incluye_compras_por_recibir(self):
        self.crear_compra()
        self.autenticar()

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['compras']['pendientes_recepcion'], 1)
        self.assertEqual(len(respuesta.data['compras_por_recibir']), 1)
        self.assertEqual(
            respuesta.data['compras_por_recibir'][0]['proveedor'],
            'Proveedor SA',
        )

    def test_dashboard_filtra_por_sucursal(self):
        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )

        respuesta = self.client.get('/api/dashboard/', {'sucursal': self.sucursal.id})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)

        respuesta = self.client.get('/api/dashboard/', {'sucursal': otra.id})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 0)
        self.assertEqual(respuesta.data['ventas']['hoy']['cantidad'], 0)

    def test_dashboard_rechaza_sucursal_inexistente(self):
        respuesta = self.client.get('/api/dashboard/', {'sucursal': 999999})

        self.assertEqual(respuesta.status_code, 400)

    def test_dashboard_periodo_mes(self):
        respuesta = self.client.get('/api/dashboard/', {'periodo': 'mes'})

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['filtros']['periodo'], 'mes')
        self.assertEqual(len(respuesta.data['ventas_por_dia']), timezone.localdate().day)
        self.assertEqual(respuesta.data['serie_etiqueta'], 'Mes actual')

    def test_dashboard_exige_autenticacion(self):
        self.client.force_authenticate(user=None)

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 401)
