from decimal import Decimal

from app.models import MovimientoStock

from .base import BaseCorralonTestCase


class CompraApiTests(BaseCorralonTestCase):
    def test_registrar_compra_no_toca_stock(self):
        respuesta = self.crear_compra()

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['estado'], 'PE')
        self.assertFalse(respuesta.data['recibida'])
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))

    def test_recibir_compra_repone_stock(self):
        creada = self.crear_compra(cantidad='10.000')
        compra_id = creada.data['id']

        respuesta = self.client.post(f'/api/compras/{compra_id}/recibir/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['recibida'])
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('110.000'))
        self.assertTrue(
            MovimientoStock.objects.filter(
                compra_id=compra_id,
                tipo=MovimientoStock.TipoMovimiento.COMPRA,
            ).exists()
        )

    def test_recibir_dos_veces_devuelve_400(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']
        self.client.post(f'/api/compras/{compra_id}/recibir/')

        respuesta = self.client.post(f'/api/compras/{compra_id}/recibir/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya fue recibida', respuesta.data['detail'])

    def test_filtra_compras_por_recibir(self):
        creada = self.crear_compra()

        respuesta = self.client.get('/api/compras/', {'por_recibir': '1'})
        self.assertEqual(respuesta.data['count'], 1)

        self.client.post(f"/api/compras/{creada.data['id']}/recibir/")
        respuesta = self.client.get('/api/compras/', {'por_recibir': '1'})
        self.assertEqual(respuesta.data['count'], 0)

    def test_proveedor_inactivo_devuelve_400(self):
        self.proveedor.estado_prov = False
        self.proveedor.save(update_fields=['estado_prov'])

        respuesta = self.crear_compra()

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('inactivo', respuesta.data['detail'])
