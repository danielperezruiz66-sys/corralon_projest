"""Claves de idempotencia.

Un reintento (doble clic, corte de red) con la misma clave no puede cobrar,
pagar ni arquear dos veces.
"""

from .base import BaseCorralonTestCase


class IdempotenciaPagosTests(BaseCorralonTestCase):
    def _pagos(self, monto='200.00'):
        return {
            'pagos': [
                {
                    'metodo_pago': self.efectivo.id,
                    'monto_pagado': monto,
                }
            ]
        }

    def test_pago_de_compra_repetido_no_paga_dos_veces(self):
        compra = self.crear_compra()
        compra_id = compra.data['id']
        self.autenticar(self.user_gerente)

        primera = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            {**self._pagos('1000.00'), 'clave': 'clave-1'},
            format='json',
        )
        self.assertEqual(primera.status_code, 200)

        segunda = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            {**self._pagos('1000.00'), 'clave': 'clave-1'},
            format='json',
        )
        self.assertEqual(segunda.status_code, 200)

        compra_actualizada = self.client.get(f'/api/compras/{compra_id}/').data
        self.assertEqual(len(compra_actualizada['pagos']), 1)
        self.assertEqual(compra_actualizada['estado'], 'PA')

    def test_cobro_de_venta_repetido_no_cobra_dos_veces(self):
        venta = self.crear_venta()
        venta_id = venta.data['id']

        primera = self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
            {**self._pagos(), 'clave': 'clave-venta-1'},
            format='json',
        )
        self.assertEqual(primera.status_code, 200)

        segunda = self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
            {**self._pagos(), 'clave': 'clave-venta-1'},
            format='json',
        )
        self.assertEqual(segunda.status_code, 200)

        venta_actualizada = self.client.get(f'/api/ventas/{venta_id}/').data
        self.assertEqual(len(venta_actualizada['pagos']), 1)

    def test_cierre_repetido_no_repite_el_arqueo(self):
        seccion_id = self.seccion.id
        montos = {str(self.efectivo.id): '1000.00'}
        # El cierre lo hace el dueno de la seccion.
        self.autenticar(self.user_cajero2)

        primera = self.client.post(
            f'/api/movimientos-caja/{seccion_id}/cerrar/',
            {
                'montos_reales': montos,
                'clave': 'clave-cierre-1',
                'password': self.PASSWORD,
            },
            format='json',
        )
        self.assertEqual(primera.status_code, 200)

        segunda = self.client.post(
            f'/api/movimientos-caja/{seccion_id}/cerrar/',
            {
                'montos_reales': montos,
                'clave': 'clave-cierre-1',
                'password': self.PASSWORD,
            },
            format='json',
        )
        self.assertEqual(segunda.status_code, 200)

        seccion = self.client.get(f'/api/movimientos-caja/{seccion_id}/').data
        self.assertEqual(seccion['estado'], 'CE')
        self.assertEqual(len(seccion['detalles_cierre']), 1)
