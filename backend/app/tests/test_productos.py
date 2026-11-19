from app.models import ProductoXProveedor, ProductoXSucursal

from .base import BaseCorralonTestCase


class ProductoApiTests(BaseCorralonTestCase):
    def _payload(self, **extra):
        datos = {
            'codigo': 'P100',
            'categoria': self.categoria.id,
            'marca': self.marca.id,
            'unidad': self.unidad.id,
            'nombre': 'Producto nuevo',
            'precio_unidad': '150.00',
            'sucursales': [self.sucursal.id],
            'proveedor': self.proveedor.id,
            'precio_lista': '100.00',
        }
        datos.update(extra)
        return datos

    def test_filtra_productos_por_sucursal_activa(self):
        ProductoXSucursal.objects.create(
            producto=self.producto,
            sucursal=self.sucursal,
            estado=True,
        )
        self.autenticar(self.user_gerente)

        respuesta = self.client.get(
            '/api/productos/',
            {'sucursal': self.sucursal.id},
        )

        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(
            respuesta.data['results'][0]['sucursales_activas'],
            [self.sucursal.id],
        )

    def test_crea_producto_con_sucursal(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.post(
            '/api/productos/',
            self._payload(),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(
            ProductoXSucursal.objects.filter(
                producto_id=respuesta.data['id'],
                estado=True,
            ).count(),
            1,
        )
        self.assertEqual(
            ProductoXProveedor.objects.filter(
                producto_id=respuesta.data['id'],
                proveedor=self.proveedor,
                estado=True,
            ).count(),
            1,
        )

    def test_no_crea_producto_sin_sucursal(self):
        self.autenticar(self.user_gerente)
        datos = self._payload()
        datos.pop('sucursales')

        respuesta = self.client.post(
            '/api/productos/',
            datos,
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('sucursales', respuesta.data)

    def test_no_crea_producto_con_precio_cero(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.post(
            '/api/productos/',
            self._payload(precio_unidad='0.00'),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('precio_unidad', respuesta.data)

    def test_no_crea_producto_sin_proveedor_ni_costo(self):
        self.autenticar(self.user_gerente)
        datos = self._payload()
        datos.pop('proveedor')
        datos.pop('precio_lista')

        respuesta = self.client.post(
            '/api/productos/',
            datos,
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('proveedor', respuesta.data)
        self.assertIn('precio_lista', respuesta.data)

    def test_no_crea_producto_con_costo_mayor_al_precio(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.post(
            '/api/productos/',
            self._payload(precio_lista='150.00'),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('precio_lista', respuesta.data)

    def test_precio_de_venta_debe_superar_el_costo(self):
        self.autenticar(self.user_gerente)
        creado = self.client.post(
            '/api/productos/',
            self._payload(),
            format='json',
        )
        self.assertEqual(creado.status_code, 201)
        producto_id = creado.data['id']

        bajo = self.client.patch(
            f'/api/productos/{producto_id}/',
            {'precio_unidad': '90.00'},
            format='json',
        )
        self.assertEqual(bajo.status_code, 400)
        self.assertIn('precio_unidad', bajo.data)

        correcto = self.client.patch(
            f'/api/productos/{producto_id}/',
            {'precio_unidad': '120.00'},
            format='json',
        )
        self.assertEqual(correcto.status_code, 200)

    def test_actualiza_costo_del_proveedor(self):
        self.autenticar(self.user_gerente)
        creado = self.client.post(
            '/api/productos/',
            self._payload(),
            format='json',
        )
        producto_id = creado.data['id']

        respuesta = self.client.patch(
            f'/api/productos/{producto_id}/',
            {
                'proveedor': self.proveedor.id,
                'precio_lista': '110.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['costo_max'], '110.00')
        self.assertEqual(
            ProductoXProveedor.objects.filter(
                producto_id=producto_id,
                proveedor=self.proveedor,
            ).count(),
            1,
        )
