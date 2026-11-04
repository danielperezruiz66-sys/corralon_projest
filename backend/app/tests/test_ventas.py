from decimal import Decimal

from app.models import DetalleStock, MovimientoStock, Venta

from .base import BaseCorralonTestCase


class VentaApiTests(BaseCorralonTestCase):
    def test_busca_venta_por_id_y_cliente(self):
        creada = self.crear_venta()
        venta_id = creada.data['id']

        respuesta = self.client.get('/api/ventas/', {'search': str(venta_id)})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get('/api/ventas/', {'search': f'#{venta_id}'})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get('/api/ventas/', {'search': 'Cliente Test'})
        self.assertEqual(respuesta.data['count'], 1)

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

    def test_confirmar_venta_pendiente(self):
        creada = self.crear_venta()
        venta_id = creada.data['id']

        respuesta = self.client.post(f'/api/ventas/{venta_id}/confirmar/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'CO')

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
