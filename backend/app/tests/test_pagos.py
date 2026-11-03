from decimal import Decimal

from app.models import Compra, Venta

from .base import BaseCorralonTestCase


class PagoVentaTests(BaseCorralonTestCase):
    def _pagar(self, venta_id, monto, metodo=None):
        return self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta_id,
                'metodo_pago': (metodo or self.efectivo).id,
                'monto_pagado': monto,
            },
            format='json',
        )

    def test_pago_parcial_y_total(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self.assertEqual(Decimal(venta.data['monto_venta']), Decimal('100.00'))

        parcial = self._pagar(venta_id, '40.00')
        self.assertEqual(parcial.status_code, 201)
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PC')

        total = self._pagar(venta_id, '60.00')
        self.assertEqual(total.status_code, 201)
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PA')

    def test_no_permite_pagar_de_mas(self):
        venta = self.crear_venta(cantidad='1.000')

        respuesta = self._pagar(venta.data['id'], '150.00')

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data['codigo'], 'error_de_negocio')
        self.assertIn('supera', respuesta.data['detail'])

    def test_no_permite_pagar_una_venta_anulada(self):
        venta = self.crear_venta(cantidad='1.000')
        self.client.post(f'/api/ventas/{venta.data["id"]}/cancelar/')

        respuesta = self._pagar(venta.data['id'], '10.00')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('anulada', respuesta.data['detail'])

    def test_no_permite_pagar_una_venta_inexistente(self):
        respuesta = self._pagar(999999, '10.00')

        self.assertEqual(respuesta.status_code, 400)


class PagoCompraTests(BaseCorralonTestCase):
    def test_pago_parcial_y_total_de_compra(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']
        self.assertEqual(Decimal(compra.data['monto_compra']), Decimal('1000.00'))

        parcial = self.client.post(
            '/api/metodos-pago-compras/',
            {
                'compra': compra_id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '300.00',
            },
            format='json',
        )
        self.assertEqual(parcial.status_code, 201)
        self.assertEqual(Compra.objects.get(pk=compra_id).estado, 'PC')

        total = self.client.post(
            '/api/metodos-pago-compras/',
            {
                'compra': compra_id,
                'metodo_pago': self.tarjeta.id,
                'monto_pagado': '700.00',
            },
            format='json',
        )
        self.assertEqual(total.status_code, 201)
        self.assertEqual(Compra.objects.get(pk=compra_id).estado, 'PA')
