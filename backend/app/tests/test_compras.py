from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone

from app.models import (
    Compra,
    Deposito,
    MovimientoStock,
    ProductoXProveedor,
    Proveedor,
    Stock,
    Sucursal,
)

from .base import BaseCorralonTestCase

FECHA_FUTURA = (timezone.localdate() + timedelta(days=7)).isoformat()


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

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(f'/api/compras/{compra_id}/recibir/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['recibida'])
        self.assertEqual(respuesta.data['estado_entrega'], 'RE')
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('110.000'))
        self.assertTrue(
            MovimientoStock.objects.filter(
                compra_id=compra_id,
                tipo=MovimientoStock.TipoMovimiento.COMPRA,
            ).exists()
        )

    def test_recibir_compra_no_cambia_el_estado_de_pago(self):
        creada = self.crear_compra(cantidad='10.000')
        compra_id = creada.data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(f'/api/compras/{compra_id}/recibir/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'PE')
        self.assertEqual(respuesta.data['estado_entrega'], 'RE')

    def test_recibir_compra_en_deposito_elegido(self):
        sucursal_destino = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Destino',
        )
        deposito_destino = Deposito.objects.create(
            sucursal=sucursal_destino,
            nombre='Deposito Destino',
            es_predeterminado=True,
        )
        creada = self.crear_compra(cantidad='5.000')

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/compras/{creada.data["id"]}/recibir/',
            {'deposito': deposito_destino.id},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        stock_destino = Stock.objects.get(
            producto=self.producto,
            sucursal=sucursal_destino,
        )
        self.assertEqual(stock_destino.cantidad, Decimal('5.000'))

    def test_recibir_compra_usa_la_sucursal_central_por_defecto(self):
        self.sucursal.es_central = True
        self.sucursal.save(update_fields=['es_central'])
        sucursal_destino = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Destino',
        )
        Deposito.objects.create(
            sucursal=sucursal_destino,
            nombre='Deposito Destino',
            es_predeterminado=True,
        )
        creada = self.crear_compra(cantidad='5.000')

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/compras/{creada.data["id"]}/recibir/',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('105.000'))
        self.assertFalse(
            Stock.objects.filter(
                producto=self.producto,
                sucursal=sucursal_destino,
            ).exists()
        )

    def test_compra_en_camino_no_toca_stock(self):
        respuesta = self.crear_compra(
            user=self.user_gerente,
            estado_entrega='EC',
            fecha_estimada_llegada=FECHA_FUTURA,
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['estado_entrega'], 'EC')
        self.assertEqual(respuesta.data['fecha_estimada_llegada'], FECHA_FUTURA)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))

    def test_rechaza_llegada_anterior_a_la_compra(self):
        ayer = (timezone.localdate() - timedelta(days=1)).isoformat()

        respuesta = self.crear_compra(
            estado_entrega='EC',
            fecha_estimada_llegada=ayer,
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('fecha_estimada_llegada', respuesta.data)

    def test_rechaza_marcar_en_camino_con_fecha_anterior(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']
        ayer = (timezone.localdate() - timedelta(days=1)).isoformat()

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/compras/{compra_id}/en-camino/',
            {'fecha_estimada_llegada': ayer},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('fecha_estimada_llegada', respuesta.data)

    def test_rechaza_producto_de_otro_proveedor(self):
        otro_proveedor = Proveedor.objects.create(
            cuit='30999999999',
            nombre='Otro proveedor',
            razon_social='Otro proveedor SA',
        )
        ProductoXProveedor.objects.create(
            producto=self.producto_poco_stock,
            proveedor=otro_proveedor,
            precio_lista=Decimal('40.00'),
        )
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/compras/',
            {
                'seccion_caja': self.seccion.id,
                'proveedor': self.proveedor.id,
                'items': [
                    {
                        'producto': self.producto_poco_stock.id,
                        'cantidad': '1.000',
                        'precio': '50.00',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('proveedor', str(respuesta.data).lower())

    def test_marcar_compra_en_camino(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/compras/{compra_id}/en-camino/',
            {'fecha_estimada_llegada': FECHA_FUTURA},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado_entrega'], 'EC')
        self.assertEqual(respuesta.data['estado_entrega_detalle'], 'En camino')
        self.assertEqual(respuesta.data['fecha_estimada_llegada'], FECHA_FUTURA)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))

    def test_no_marca_en_camino_una_compra_recibida(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']
        self.autenticar(self.user_gerente)
        self.client.post(f'/api/compras/{compra_id}/recibir/')

        respuesta = self.client.post(f'/api/compras/{compra_id}/en-camino/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('recibida', respuesta.data['detail'])

    def test_filtra_compras_por_estado_de_entrega(self):
        self.crear_compra(
            user=self.user_gerente,
            estado_entrega='EC',
            fecha_estimada_llegada=FECHA_FUTURA,
        )
        self.crear_compra()

        respuesta = self.client.get(
            '/api/compras/',
            {'estado_entrega': 'EC'},
        )

        self.assertEqual(respuesta.data['count'], 1)

    def test_filtra_compras_por_fecha(self):
        creada = self.crear_compra()
        fecha = timezone.make_aware(datetime(2026, 11, 10, 12, 0))
        Compra.objects.filter(pk=creada.data['id']).update(fecha_compra=fecha)

        respuesta = self.client.get('/api/compras/', {'fecha': '2026-11-10'})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get('/api/compras/', {'fecha': '2026-11-11'})
        self.assertEqual(respuesta.data['count'], 0)

    def test_recibir_dos_veces_devuelve_400(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']
        self.autenticar(self.user_gerente)
        self.client.post(f'/api/compras/{compra_id}/recibir/')

        respuesta = self.client.post(f'/api/compras/{compra_id}/recibir/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya fue recibida', respuesta.data['detail'])

    def test_busca_compra_por_id_y_proveedor(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']

        respuesta = self.client.get('/api/compras/', {'search': str(compra_id)})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get('/api/compras/', {'search': f'#{compra_id}'})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get('/api/compras/', {'search': 'Proveedor'})
        self.assertEqual(respuesta.data['count'], 1)

        respuesta = self.client.get(
            '/api/compras/',
            {'search': '30711111111'},
        )
        self.assertEqual(respuesta.data['count'], 1)

    def test_filtra_compras_por_recibir(self):
        creada = self.crear_compra()

        respuesta = self.client.get('/api/compras/', {'por_recibir': '1'})
        self.assertEqual(respuesta.data['count'], 1)

        self.autenticar(self.user_gerente)
        self.client.post(f"/api/compras/{creada.data['id']}/recibir/")
        respuesta = self.client.get('/api/compras/', {'por_recibir': '1'})
        self.assertEqual(respuesta.data['count'], 0)

    def test_por_recibir_excluye_compras_anuladas(self):
        creada = self.crear_compra()
        self.autenticar(self.user_gerente)
        self.client.post(
            f"/api/compras/{creada.data['id']}/anular/",
            {'motivo': 'Compra de prueba'},
            format='json',
        )

        respuesta = self.client.get('/api/compras/', {'por_recibir': '1'})

        self.assertEqual(respuesta.data['count'], 0)

    def test_compra_sin_precio_devuelve_400(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/compras/',
            {
                'seccion_caja': self.seccion.id,
                'proveedor': self.proveedor.id,
                'items': [
                    {
                        'producto': self.producto.id,
                        'cantidad': '1.000',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('precio', respuesta.data['items'][0])

    def test_compra_en_camino_sin_fecha_devuelve_400(self):
        respuesta = self.crear_compra(estado_entrega='EC')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('fecha_estimada_llegada', respuesta.data)

    def test_no_marca_en_camino_sin_fecha(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(f'/api/compras/{compra_id}/en-camino/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('fecha estimada', respuesta.data['detail'])

    def test_proveedor_inactivo_devuelve_400(self):
        self.proveedor.estado_prov = False
        self.proveedor.save(update_fields=['estado_prov'])

        respuesta = self.crear_compra()

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('inactivo', respuesta.data['detail'])

    def test_anular_compra_pendiente_no_toca_stock(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/compras/{compra_id}/anular/',
            {'motivo': 'Compra de prueba'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'AN')
        self.assertEqual(
            respuesta.data['motivo_cancelacion'],
            'Compra de prueba',
        )
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))

    def test_anular_compra_exige_motivo(self):
        creada = self.crear_compra()

        self.autenticar(self.user_gerente)
        sin_motivo = self.client.post(
            f"/api/compras/{creada.data['id']}/anular/",
            {},
            format='json',
        )
        self.assertEqual(sin_motivo.status_code, 400)
        self.assertIn('motivo', sin_motivo.data)

        solo_espacios = self.client.post(
            f"/api/compras/{creada.data['id']}/anular/",
            {'motivo': '   '},
            format='json',
        )
        self.assertEqual(solo_espacios.status_code, 400)
        self.assertIn('motivo', solo_espacios.data)

    def test_no_anula_compra_recibida(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']
        self.autenticar(self.user_gerente)
        self.client.post(f'/api/compras/{compra_id}/recibir/')

        respuesta = self.client.post(
            f'/api/compras/{compra_id}/anular/',
            {'motivo': 'Compra de prueba'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('recibida', respuesta.data['detail'])

    def test_no_anula_compra_con_pagos(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']
        self.autenticar(self.user_gerente)
        self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            {
                'pagos': [
                    {
                        'metodo_pago': self.efectivo.id,
                        'monto_pagado': '100.00',
                    }
                ]
            },
            format='json',
        )

        respuesta = self.client.post(
            f'/api/compras/{compra_id}/anular/',
            {'motivo': 'Compra de prueba'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pagos registrados', respuesta.data['detail'])

    def test_filtra_compras_anuladas(self):
        creada = self.crear_compra()
        self.crear_compra()
        self.autenticar(self.user_gerente)
        self.client.post(
            f"/api/compras/{creada.data['id']}/anular/",
            {'motivo': 'Compra de prueba'},
            format='json',
        )

        respuesta = self.client.get('/api/compras/', {'estado': 'AN'})

        self.assertEqual(respuesta.data['count'], 1)

    def test_no_recibe_compra_anulada(self):
        creada = self.crear_compra()
        compra_id = creada.data['id']
        self.autenticar(self.user_gerente)
        self.client.post(
            f'/api/compras/{compra_id}/anular/',
            {'motivo': 'Compra de prueba'},
            format='json',
        )

        respuesta = self.client.post(f'/api/compras/{compra_id}/recibir/')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('anulada', respuesta.data['detail'])
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))
