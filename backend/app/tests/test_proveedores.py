from app.models import ProductoXProveedor, Proveedor

from .base import BaseCorralonTestCase


class ProveedorApiTests(BaseCorralonTestCase):
    def test_crea_proveedor_con_sucursal(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999999',
                'nombre': 'Proveedor Nuevo',
                'razon_social': 'Proveedor Nuevo SA',
                'contacto': '3415551234',
                'email_prov': 'nuevo@proveedor.com',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(
            respuesta.data['sucursales_activas'],
            [self.sucursal.id],
        )
        self.assertTrue(
            Proveedor.objects.filter(cuit='30799999999').exists()
        )

    def test_no_crea_proveedor_con_cuit_con_letras(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '3079999999A',
                'nombre': 'Proveedor inválido',
                'razon_social': 'Proveedor inválido SA',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('cuit', respuesta.data)

    def test_no_crea_proveedor_sin_sucursal(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999998',
                'nombre': 'Proveedor sin sucursal',
                'razon_social': 'Proveedor sin sucursal SA',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('sucursales', respuesta.data)

    def _payload_productos(self, **extra):
        datos = {
            'items': [
                {
                    'producto': self.producto.id,
                    'precio_lista': '80.00',
                },
                {
                    'producto': self.producto_poco_stock.id,
                    'precio_lista': '40.00',
                },
            ],
        }
        datos.update(extra)
        return datos

    def test_asocia_multiples_productos_con_costo(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            self._payload_productos(),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.data), 2)
        self.assertEqual(
            ProductoXProveedor.objects.filter(
                proveedor=self.proveedor,
                estado=True,
            ).count(),
            2,
        )

    def test_actualiza_costos_existentes_sin_duplicar(self):
        self.autenticar(self.user_deposito)
        self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            self._payload_productos(),
            format='json',
        )

        respuesta = self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            {
                'items': [
                    {
                        'producto': self.producto.id,
                        'precio_lista': '85.00',
                    }
                ]
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(
            ProductoXProveedor.objects.filter(
                proveedor=self.proveedor,
                producto=self.producto,
            ).count(),
            1,
        )
        self.assertEqual(
            str(
                ProductoXProveedor.objects.get(
                    proveedor=self.proveedor,
                    producto=self.producto,
                ).precio_lista
            ),
            '85.00',
        )

    def test_no_asocia_costo_mayor_o_igual_al_precio(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            {
                'items': [
                    {
                        'producto': self.producto.id,
                        'precio_lista': '100.00',
                    }
                ]
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('precio_lista', respuesta.data['items'][0])
        self.assertFalse(
            ProductoXProveedor.objects.filter(
                proveedor=self.proveedor,
            ).exists()
        )

    def test_no_asocia_productos_repetidos(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            {
                'items': [
                    {
                        'producto': self.producto.id,
                        'precio_lista': '80.00',
                    },
                    {
                        'producto': self.producto.id,
                        'precio_lista': '70.00',
                    },
                ]
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('items', respuesta.data)

    def test_no_asocia_productos_si_proveedor_inactivo(self):
        self.proveedor.estado_prov = False
        self.proveedor.save(update_fields=['estado_prov'])
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            self._payload_productos(),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('inactivo', respuesta.data['detail'])
