from decimal import Decimal

from app.models import (
    DetalleStock,
    MovimientoStock,
    ProductoXSucursal,
)

from .base import BaseCorralonTestCase


class StockApiTests(BaseCorralonTestCase):
    def test_edita_minimos_del_stock(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.patch(
            f'/api/stocks/{self.stock.id}/',
            {
                'cant_min': '10.000',
                'cant_negativa_max': '-5.000',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cant_min, Decimal('10.000'))
        self.assertEqual(self.stock.cant_negativa_max, Decimal('-5.000'))

    def test_filtra_stock_por_alerta(self):
        self.stock_poco.cant_min = Decimal('10.000')
        self.stock_poco.save(update_fields=['cant_min'])
        self.autenticar(self.user_deposito)

        minimo = self.client.get('/api/stocks/', {'alerta': 'minimo'})
        self.assertEqual(minimo.data['count'], 1)
        self.assertEqual(minimo.data['results'][0]['id'], self.stock_poco.id)

        self.stock.cantidad = Decimal('-1.000')
        self.stock.save(update_fields=['cantidad'])
        negativo = self.client.get('/api/stocks/', {'alerta': 'negativo'})
        self.assertEqual(negativo.data['count'], 1)
        self.assertEqual(negativo.data['results'][0]['id'], self.stock.id)

    def _detalle_stock(self, stock=None):
        stock = stock or self.stock
        return DetalleStock.objects.filter(stock=stock).order_by('id').first()

    def test_ajuste_suma_y_resta_stock(self):
        self.autenticar(self.user_deposito)
        detalle = self._detalle_stock()

        suma = self.client.post(
            f'/api/stocks/{self.stock.id}/ajustar/',
            {
                'motivo': 'Conteo de inventario',
                'ingresos': [
                    {
                        'deposito': self.deposito.id,
                        'cantidad': '20.000',
                    }
                ],
            },
            format='json',
        )
        self.assertEqual(suma.status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('120.000'))
        self.assertTrue(
            MovimientoStock.objects.filter(
                stock=self.stock,
                tipo=MovimientoStock.TipoMovimiento.AJUSTE,
                cantidad=Decimal('20.000'),
            ).exists()
        )

        # Reduce el lote original (100 -> 30), total queda 30 + 20 (nuevo lote) = 50.
        resta = self.client.post(
            f'/api/stocks/{self.stock.id}/ajustar/',
            {
                'motivo': 'Merma',
                'reducciones': [
                    {
                        'detalle': detalle.id,
                        'cantidad_nueva': '30.000',
                    }
                ],
            },
            format='json',
        )
        self.assertEqual(resta.status_code, 200)
        self.stock.refresh_from_db()
        detalle.refresh_from_db()
        self.assertEqual(detalle.cantidad, Decimal('30.000'))
        self.assertEqual(self.stock.cantidad, Decimal('50.000'))
        self.assertTrue(
            MovimientoStock.objects.filter(
                stock=self.stock,
                tipo=MovimientoStock.TipoMovimiento.AJUSTE,
                cantidad=Decimal('-70.000'),
                detalle_stock=detalle,
            ).exists()
        )

    def test_ajuste_rechaza_reduccion_mayor_al_lote(self):
        self.autenticar(self.user_deposito)
        detalle = self._detalle_stock()

        respuesta = self.client.post(
            f'/api/stocks/{self.stock.id}/ajustar/',
            {
                'motivo': 'Error de carga',
                'reducciones': [
                    {
                        'detalle': detalle.id,
                        'cantidad_nueva': '150.000',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.stock.refresh_from_db()
        detalle.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))
        self.assertEqual(detalle.cantidad, Decimal('100.000'))

    def test_ajuste_rechaza_cantidad_negativa_en_lote(self):
        self.autenticar(self.user_deposito)
        detalle = self._detalle_stock()

        respuesta = self.client.post(
            f'/api/stocks/{self.stock.id}/ajustar/',
            {
                'motivo': 'Error de carga',
                'reducciones': [
                    {
                        'detalle': detalle.id,
                        'cantidad_nueva': '-1.000',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))

    def test_vendedor_no_puede_ajustar_stock(self):
        self.autenticar(self.user_vendedor)
        detalle = self._detalle_stock()

        respuesta = self.client.post(
            f'/api/stocks/{self.stock.id}/ajustar/',
            {
                'motivo': 'Prueba',
                'reducciones': [
                    {'detalle': detalle.id, 'cantidad_nueva': '90.000'}
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_filtra_movimientos_por_producto_y_sucursal(self):
        self.crear_venta(cantidad='1.000')
        self.autenticar(self.user_cajero)

        respuesta = self.client.get(
            '/api/movimientos-stock/',
            {
                'producto': self.producto.id,
                'sucursal': self.sucursal.id,
            },
        )

        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['tipo'], 'VE')

    def test_no_elimina_deposito_con_stock(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.delete(f'/api/depositos/{self.deposito.id}/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('asociados', respuesta.data['detail'])

    def _payload_carga(self, **extra):
        ProductoXSucursal.objects.get_or_create(
            producto=self.producto,
            sucursal=self.sucursal,
            defaults={'estado': True},
        )
        ProductoXSucursal.objects.get_or_create(
            producto=self.producto_poco_stock,
            sucursal=self.sucursal,
            defaults={'estado': True},
        )
        datos = {
            'sucursal': self.sucursal.id,
            'deposito': self.deposito.id,
            'motivo': 'Carga inicial',
            'items': [
                {
                    'producto': self.producto.id,
                    'cantidad': '5.000',
                    'fecha_venc': '2027-12-31',
                },
                {
                    'producto': self.producto_poco_stock.id,
                    'cantidad': '3.000',
                },
            ],
        }
        datos.update(extra)
        return datos

    def test_carga_masiva_suma_stock_y_registra_lotes(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/stocks/carga-masiva/',
            self._payload_carga(),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.stock.refresh_from_db()
        self.stock_poco.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('105.000'))
        self.assertEqual(self.stock_poco.cantidad, Decimal('8.000'))
        detalle = DetalleStock.objects.filter(
            stock=self.stock,
            cantidad=Decimal('5.000'),
        ).first()
        self.assertIsNotNone(detalle)
        self.assertTrue(detalle.lote.startswith('LOT-'))
        self.assertTrue(
            MovimientoStock.objects.filter(
                stock=self.stock,
                tipo=MovimientoStock.TipoMovimiento.AJUSTE,
                referencia__startswith='carga-stock:',
            ).exists()
        )

    def test_carga_masiva_rechaza_deposito_de_otra_sucursal(self):
        self.autenticar(self.user_deposito)
        from app.models import Deposito, Sucursal

        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )
        deposito = Deposito.objects.create(
            sucursal=otra,
            nombre='Depósito Norte',
        )

        respuesta = self.client.post(
            '/api/stocks/carga-masiva/',
            self._payload_carga(deposito=deposito.id),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('deposito', respuesta.data)

    def test_carga_masiva_rechaza_producto_no_activo_en_sucursal(self):
        self.autenticar(self.user_deposito)
        datos = self._payload_carga()
        ProductoXSucursal.objects.filter(
            producto=self.producto_poco_stock,
            sucursal=self.sucursal,
        ).delete()

        respuesta = self.client.post(
            '/api/stocks/carga-masiva/',
            datos,
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('no esta activo', respuesta.data['detail'])

    def test_carga_masiva_rechaza_productos_repetidos(self):
        self.autenticar(self.user_deposito)
        datos = self._payload_carga()
        datos['items'][1]['producto'] = self.producto.id

        respuesta = self.client.post(
            '/api/stocks/carga-masiva/',
            datos,
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('items', respuesta.data)
