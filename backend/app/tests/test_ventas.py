from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone

from app.models import DetalleStock, MovimientoStock, ProductoXProveedor, Venta

from .base import BaseCorralonTestCase


class VentaApiTests(BaseCorralonTestCase):
    def test_no_vende_a_un_cliente_inactivo(self):
        self.cliente.estado = False
        self.cliente.save(update_fields=['estado'])

        respuesta = self.crear_venta()

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('inactivo', respuesta.data['detail'])

    def test_no_vende_con_precio_cero(self):
        payload = self.payload_venta()
        payload['items'][0]['precio'] = '0.00'

        respuesta = self.client.post('/api/ventas/', payload, format='json')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('precio', respuesta.data['items'][0])

    def test_no_vende_por_debajo_del_costo(self):
        ProductoXProveedor.objects.create(
            producto=self.producto,
            proveedor=self.proveedor,
            precio_lista=Decimal('80.00'),
        )
        payload = self.payload_venta(cantidad='1.000')
        payload['items'][0]['precio'] = '70.00'

        respuesta = self.client.post('/api/ventas/', payload, format='json')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('costo', respuesta.data['detail'])

    def test_busca_venta_por_id_y_cliente(self):
        creada = self.crear_venta()
        venta_id = creada.data['id']

        respuesta = self.client.get('/api/ventas/', {'search': str(venta_id)})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get('/api/ventas/', {'search': f'#{venta_id}'})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get('/api/ventas/', {'search': 'Cliente Test'})
        self.assertEqual(respuesta.data['count'], 1)

    def test_guarda_y_busca_el_nombre_del_consumidor_final(self):
        respuesta = self.crear_venta(
            cliente=None,
            cliente_venta='  Juan Perez  ',
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['cliente_venta'], 'Juan Perez')

        busqueda = self.client.get('/api/ventas/', {'search': 'Juan Perez'})
        self.assertEqual(busqueda.data['count'], 1)

    def test_no_permite_cliente_y_nombre_libre_juntos(self):
        respuesta = self.crear_venta(cliente_venta='Juan Perez')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('cliente_venta', respuesta.data)

    def test_filtra_ventas_por_fecha(self):
        creada = self.crear_venta()
        fecha = timezone.make_aware(datetime(2026, 11, 10, 12, 0))
        Venta.objects.filter(pk=creada.data['id']).update(fecha_venta=fecha)

        por_dia = self.client.get('/api/ventas/', {'fecha': '2026-11-10'})
        self.assertEqual(por_dia.data['count'], 1)

        por_rango = self.client.get(
            '/api/ventas/',
            {'fecha_desde': '2026-11-10', 'fecha_hasta': '2026-11-10'},
        )
        self.assertEqual(por_rango.data['count'], 1)

        otro_dia = self.client.get('/api/ventas/', {'fecha': '2026-11-11'})
        self.assertEqual(otro_dia.data['count'], 0)

    def test_filtra_ventas_por_alerta_de_vencimiento(self):
        por_vencer = self.crear_venta().data['id']
        vencida = self.crear_venta().data['id']
        confirmada = self.crear_venta().data['id']
        con_pago = self.crear_venta().data['id']
        Venta.objects.filter(pk=por_vencer).update(
            fecha_venta=timezone.now() - timedelta(minutes=25)
        )
        Venta.objects.filter(pk=vencida).update(
            fecha_venta=timezone.now() - timedelta(minutes=35)
        )
        Venta.objects.filter(pk=confirmada).update(
            estado=Venta.EstadoVenta.CONFIRMADA
        )
        Venta.objects.filter(pk=con_pago).update(
            fecha_venta=timezone.now() - timedelta(minutes=25)
        )
        self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': con_pago,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '50.00',
            },
            format='json',
        )

        respuesta = self.client.get('/api/ventas/', {'alerta': 'por_vencer'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['id'], por_vencer)

        respuesta = self.client.get('/api/ventas/', {'alerta': 'vencida'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['id'], vencida)

    def test_rechaza_fechas_invalidas(self):
        invalida = self.client.get('/api/ventas/', {'fecha': '10/11/2026'})
        self.assertEqual(invalida.status_code, 400)

        rango = self.client.get(
            '/api/ventas/',
            {'fecha_desde': '2026-11-11', 'fecha_hasta': '2026-11-10'},
        )
        self.assertEqual(rango.status_code, 400)

    def test_crear_venta_descuenta_stock(self):
        respuesta = self.crear_venta()

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['estado'], 'PE')
        self.assertEqual(Decimal(respuesta.data['monto_venta']), Decimal('200.00'))
        self.assertEqual(len(respuesta.data['detalles']), 1)

        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('98.000'))
        self.assertEqual(
            MovimientoStock.objects.filter(venta_id=respuesta.data['id']).count(),
            1,
        )

    def test_venta_rechaza_stock_por_debajo_del_limite(self):
        respuesta = self.crear_venta(producto=self.producto_poco_stock, cantidad='16.000')

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data['codigo'], 'stock_insuficiente')
        self.stock_poco.refresh_from_db()
        self.assertEqual(self.stock_poco.cantidad, Decimal('5.000'))
        self.assertEqual(Venta.objects.count(), 0)

    def test_venta_exige_seccion_abierta(self):
        self.seccion.estado = 'CE'
        self.seccion.save(update_fields=['estado'])

        respuesta = self.crear_venta()

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('no esta abierta', respuesta.data['detail'])

    def test_confirmar_venta_sin_pagos_devuelve_400(self):
        creada = self.crear_venta()
        venta_id = creada.data['id']

        respuesta = self.client.post(f'/api/ventas/{venta_id}/confirmar/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pago', respuesta.data['detail'])

    def test_cancelar_venta_restaura_stock(self):
        creada = self.crear_venta()
        venta_id = creada.data['id']
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('98.000'))

        respuesta = self.client.post(
            f'/api/ventas/{venta_id}/cancelar/',
            {'motivo': 'prueba'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'AN')
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))
        self.assertTrue(
            MovimientoStock.objects.filter(
                venta_id=venta_id,
                tipo=MovimientoStock.TipoMovimiento.CANCELACION,
            ).exists()
        )

    def test_cancelar_venta_con_pagos_devuelve_400(self):
        creada = self.crear_venta()
        venta_id = creada.data['id']
        self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta_id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '50.00',
            },
            format='json',
        )

        respuesta = self.client.post(f'/api/ventas/{venta_id}/cancelar/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pagos', respuesta.data['detail'])

    def test_detalle_stock_coincide_con_la_suma(self):
        self.crear_venta(cantidad='3.000')
        self.stock.refresh_from_db()

        total_detalles = sum(
            detalle.cantidad
            for detalle in DetalleStock.objects.filter(stock=self.stock)
        )
        self.assertEqual(self.stock.cantidad, total_detalles)
