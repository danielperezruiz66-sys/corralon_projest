from decimal import Decimal

from django.db import IntegrityError, transaction

from app.models import (
    ProductoXProveedor,
    ProductoXSucursal,
    Proveedor,
    ProveedorXSucursal,
)

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

    def test_no_crea_proveedor_con_nombre_con_numeros(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999991',
                'nombre': 'Proveedor 123',
                'razon_social': 'Proveedor 123 SA',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('nombre', respuesta.data)

    def test_no_crea_proveedor_con_razon_social_sin_letras(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999992',
                'nombre': 'Proveedor Válido',
                'razon_social': '1234',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('razon_social', respuesta.data)

    def test_no_crea_proveedor_con_telefono_con_letras(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999993',
                'nombre': 'Proveedor Válido',
                'razon_social': 'Proveedor Válido SA',
                'contacto': '387ABC1234',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('contacto', respuesta.data)

    def test_no_crea_proveedor_con_telefono_sin_digitos_suficientes(self):
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999994',
                'nombre': 'Proveedor Válido',
                'razon_social': 'Proveedor Válido SA',
                'contacto': '++----',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('contacto', respuesta.data)

    def test_no_crea_proveedor_con_email_duplicado(self):
        self.autenticar(self.user_deposito)
        primero = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999995',
                'nombre': 'Proveedor Uno',
                'razon_social': 'Proveedor Uno SA',
                'email_prov': 'duplicado@proveedor.com',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        segundo = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999996',
                'nombre': 'Proveedor Dos',
                'razon_social': 'Proveedor Dos SA',
                'email_prov': 'duplicado@proveedor.com',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(primero.status_code, 201)
        self.assertEqual(segundo.status_code, 400)
        self.assertIn('email_prov', segundo.data)
        self.assertIn('Ya existe un proveedor', segundo.data['email_prov'][0])

    def test_no_crea_proveedor_con_cuit_duplicado(self):
        self.autenticar(self.user_deposito)
        primero = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999997',
                'nombre': 'Proveedor Uno',
                'razon_social': 'Proveedor Uno SA',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        segundo = self.client.post(
            '/api/proveedores/',
            {
                'cuit': '30799999997',
                'nombre': 'Proveedor Dos',
                'razon_social': 'Proveedor Dos SA',
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(primero.status_code, 201)
        self.assertEqual(segundo.status_code, 400)
        self.assertIn('cuit', segundo.data)
        self.assertIn('Ya existe un proveedor', segundo.data['cuit'][0])

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

    def test_rechaza_producto_ya_asociado_al_proveedor(self):
        self.autenticar(self.user_deposito)
        creado = self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            {
                'items': [
                    {
                        'producto': self.producto.id,
                        'precio_lista': '80.00',
                    }
                ]
            },
            format='json',
        )
        self.assertEqual(creado.status_code, 200)
        asociacion_id = creado.data[0]['id']

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

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data['codigo'], 'duplicado')
        self.assertEqual(respuesta.data['asociacion_id'], asociacion_id)
        self.assertEqual(respuesta.data['precio_lista_actual'], '80.00')
        self.assertIn('costo vigente', respuesta.data['detail'])
        self.assertEqual(
            ProductoXProveedor.objects.filter(
                proveedor=self.proveedor,
                producto=self.producto,
            ).count(),
            1,
        )
        self.assertEqual(
            str(
                ProductoXProveedor.objects.get(pk=asociacion_id).precio_lista
            ),
            '80.00',
        )

    def test_actualiza_costo_existente_por_patch(self):
        self.autenticar(self.user_deposito)
        creado = self.client.post(
            f'/api/proveedores/{self.proveedor.id}/productos/',
            {
                'items': [
                    {
                        'producto': self.producto.id,
                        'precio_lista': '80.00',
                    }
                ]
            },
            format='json',
        )
        asociacion_id = creado.data[0]['id']

        respuesta = self.client.patch(
            f'/api/productos-proveedores/{asociacion_id}/',
            {'precio_lista': '85.00'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['precio_lista'], '85.00')
        self.assertEqual(
            ProductoXProveedor.objects.filter(
                proveedor=self.proveedor,
                producto=self.producto,
            ).count(),
            1,
        )

    def test_producto_proveedor_api_bloquea_par_duplicado(self):
        self.autenticar(self.user_deposito)
        ProductoXProveedor.objects.create(
            producto=self.producto,
            proveedor=self.proveedor,
            precio_lista=Decimal('70.00'),
        )

        respuesta = self.client.post(
            '/api/productos-proveedores/',
            {
                'producto': self.producto.id,
                'proveedor': self.proveedor.id,
                'precio_lista': '75.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data['codigo'], 'duplicado')
        self.assertEqual(respuesta.data['precio_lista_actual'], '70.00')
        self.assertEqual(
            ProductoXProveedor.objects.filter(
                producto=self.producto,
                proveedor=self.proveedor,
            ).count(),
            1,
        )

    def test_producto_sucursal_api_bloquea_par_duplicado(self):
        self.autenticar(self.user_gerente)
        ProductoXSucursal.objects.create(
            producto=self.producto,
            sucursal=self.sucursal,
        )

        respuesta = self.client.post(
            '/api/productos-sucursales/',
            {
                'producto': self.producto.id,
                'sucursal': self.sucursal.id,
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('sucursal', respuesta.data)
        self.assertEqual(
            ProductoXSucursal.objects.filter(
                producto=self.producto,
                sucursal=self.sucursal,
            ).count(),
            1,
        )

    def test_proveedor_sucursal_api_bloquea_par_duplicado(self):
        self.autenticar(self.user_gerente)
        ProveedorXSucursal.objects.create(
            proveedor=self.proveedor,
            sucursal=self.sucursal,
        )

        respuesta = self.client.post(
            '/api/proveedores-sucursales/',
            {
                'proveedor': self.proveedor.id,
                'sucursal': self.sucursal.id,
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('sucursal', respuesta.data)
        self.assertEqual(
            ProveedorXSucursal.objects.filter(
                proveedor=self.proveedor,
                sucursal=self.sucursal,
            ).count(),
            1,
        )

    def test_base_de_datos_rechaza_asociacion_producto_proveedor(self):
        ProductoXProveedor.objects.create(
            producto=self.producto,
            proveedor=self.proveedor,
            precio_lista=Decimal('70.00'),
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            ProductoXProveedor.objects.create(
                producto=self.producto,
                proveedor=self.proveedor,
                precio_lista=Decimal('75.00'),
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
