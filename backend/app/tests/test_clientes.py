from decimal import Decimal

from app.models import Cliente

from .base import BaseCorralonTestCase


class ClienteApiTests(BaseCorralonTestCase):
    def test_no_crea_cliente_sin_identidad(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.post(
            '/api/clientes/',
            {'telefono': '3415550000'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('razon_social', respuesta.data)

    def test_crea_cliente_con_nombre_y_apellido(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.post(
            '/api/clientes/',
            {
                'nombre': 'Ana',
                'apellido': 'Pérez',
                'tipo_documento': 'DNI',
                'dni': '30123456',
                'telefono': '3415550000',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['nombre'], 'Ana')
        self.assertEqual(respuesta.data['apellido'], 'Pérez')

    def test_no_crea_cliente_sin_contacto(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.post(
            '/api/clientes/',
            {
                'razon_social': 'Sin contacto SA',
                'tipo_documento': 'CUIT',
                'dni': '30712345678',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('telefono', respuesta.data)

    def test_no_crea_cliente_con_dni_con_letras(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.post(
            '/api/clientes/',
            {
                'razon_social': 'Cliente inválido',
                'tipo_documento': 'DNI',
                'dni': '30A12345',
                'telefono': '3415550000',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('dni', respuesta.data)

    def test_no_crea_cliente_con_telefono_con_letras(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.post(
            '/api/clientes/',
            {
                'razon_social': 'Cliente inválido',
                'tipo_documento': 'CUIT',
                'dni': '30712345678',
                'telefono': '341ABC0000',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('telefono', respuesta.data)

    def test_endpoint_estado_no_exige_datos_fiscales(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.patch(
            f'/api/clientes/{self.cliente.id}/estado/',
            {'estado': False},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['estado'])

    def test_actualiza_datos_fiscales_y_estado(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.patch(
            f'/api/clientes/{self.cliente.id}/',
            {
                'tipo_documento': 'CUIT',
                'dni': '30712345678',
                'condicion_iva': 'RI',
                'ingresos_brutos': '123456',
                'telefono': '3415550000',
                'notas': 'Cliente mayorista',
                'estado': False,
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['tipo_documento_detalle'], 'CUIT')
        self.assertEqual(
            respuesta.data['condicion_iva_detalle'],
            'Responsable Inscripto',
        )
        self.assertFalse(respuesta.data['estado'])

    def test_resumen_con_ventas_y_pagos(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta_id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '40.00',
            },
            format='json',
        )

        respuesta = self.client.get(
            f'/api/clientes/{self.cliente.id}/resumen/',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['cantidad_ventas'], 1)
        self.assertEqual(
            Decimal(respuesta.data['total_comprado']),
            Decimal('100.00'),
        )
        self.assertEqual(
            Decimal(respuesta.data['total_pagado']),
            Decimal('40.00'),
        )
        self.assertEqual(
            Decimal(respuesta.data['saldo_pendiente']),
            Decimal('60.00'),
        )
        self.assertEqual(
            Decimal(respuesta.data['ventas_recientes'][0]['saldo']),
            Decimal('60.00'),
        )

    def test_resumen_ignora_ventas_anuladas(self):
        venta = self.crear_venta(cantidad='1.000')
        self.client.post(f'/api/ventas/{venta.data["id"]}/cancelar/')

        respuesta = self.client.get(
            f'/api/clientes/{self.cliente.id}/resumen/',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['cantidad_ventas'], 0)
        self.assertEqual(
            Decimal(respuesta.data['total_comprado']),
            Decimal('0.00'),
        )

    def test_filtra_clientes_por_estado(self):
        Cliente.objects.create(razon_social='Cliente inactivo', estado=False)

        respuesta = self.client.get('/api/clientes/', {'estado': 'false'})

        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(
            respuesta.data['results'][0]['razon_social'],
            'Cliente inactivo',
        )

    def test_busca_cliente_por_telefono(self):
        self.cliente.telefono = '3415559999'
        self.cliente.save(update_fields=['telefono'])

        respuesta = self.client.get(
            '/api/clientes/',
            {'search': '3415559999'},
        )

        self.assertEqual(respuesta.data['count'], 1)
