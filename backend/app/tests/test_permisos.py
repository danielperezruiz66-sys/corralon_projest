from .base import BaseCorralonTestCase


class PermisoLecturaTests(BaseCorralonTestCase):
    def test_cualquier_autenticado_puede_leer(self):
        self.autenticar(self.user_sin_rol)

        respuesta = self.client.get('/api/productos/')

        self.assertEqual(respuesta.status_code, 200)

    def test_anonimo_recibe_401(self):
        self.client.force_authenticate(user=None)

        respuesta = self.client.get('/api/productos/')

        self.assertEqual(respuesta.status_code, 401)

    def test_perfil_devuelve_roles(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.get('/api/perfil/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['empleado']['legajo'], '0002')
        self.assertEqual([rol['codigo'] for rol in respuesta.data['roles']], ['CA'])
        self.assertEqual(respuesta.data['codigos'], ['CA'])


class PermisoEscrituraTests(BaseCorralonTestCase):
    def _categoria(self, user):
        self.autenticar(user)
        return self.client.post(
            '/api/categorias/',
            {'categorias': f'Categoria {user.username}'},
            format='json',
        )

    def test_catalogo_solo_gerencia(self):
        self.assertEqual(self._categoria(self.user_gerente).status_code, 201)
        self.assertEqual(self._categoria(self.user_cajero).status_code, 403)
        self.assertEqual(self._categoria(self.user_vendedor).status_code, 403)
        self.assertEqual(self._categoria(self.user_deposito).status_code, 403)
        self.assertEqual(self._categoria(self.user_sin_rol).status_code, 403)

    def test_admin_puede_todo(self):
        self.assertEqual(self._categoria(self.admin).status_code, 201)

    def test_clientes_los_carga_venta(self):
        self.autenticar(self.user_vendedor)
        vendedor = self.client.post(
            '/api/clientes/',
            {'razon_social': 'Cliente vendedor'},
            format='json',
        )
        self.assertEqual(vendedor.status_code, 201)

        self.autenticar(self.user_deposito)
        deposito = self.client.post(
            '/api/clientes/',
            {'razon_social': 'Cliente deposito'},
            format='json',
        )
        self.assertEqual(deposito.status_code, 403)

    def test_depositos_los_gestiona_el_encargado(self):
        datos = {
            'sucursal': self.sucursal.id,
            'nombre': 'Deposito nuevo',
            'es_predeterminado': False,
        }

        self.autenticar(self.user_deposito)
        permitido = self.client.post('/api/depositos/', datos, format='json')
        self.assertEqual(permitido.status_code, 201)

        self.autenticar(self.user_vendedor)
        denegado = self.client.post('/api/depositos/', datos, format='json')
        self.assertEqual(denegado.status_code, 403)

    def test_ventas_las_hacen_cajero_y_vendedor(self):
        self.assertEqual(self.crear_venta(user=self.user_cajero).status_code, 201)
        self.assertEqual(self.crear_venta(user=self.user_vendedor).status_code, 201)
        self.assertEqual(self.crear_venta(user=self.user_deposito).status_code, 403)
        self.assertEqual(self.crear_venta(user=self.user_sin_rol).status_code, 403)

    def test_compras_las_hace_el_encargado_de_deposito(self):
        self.assertEqual(self.crear_compra(user=self.user_deposito).status_code, 201)
        self.assertEqual(self.crear_compra(user=self.user_gerente).status_code, 201)
        self.assertEqual(self.crear_compra(user=self.user_vendedor).status_code, 403)

    def test_cancelar_venta_no_lo_puede_hacer_un_vendedor(self):
        venta = self.crear_venta(user=self.user_vendedor)

        self.autenticar(self.user_vendedor)
        respuesta = self.client.post(f'/api/ventas/{venta.data["id"]}/cancelar/')

        self.assertEqual(respuesta.status_code, 403)

    def test_caja_la_operan_admin_gerente_y_cajero(self):
        self.assertEqual(
            self.crear_venta(user=self.user_cajero).status_code,
            201,
        )
        self.autenticar(self.user_vendedor)
        respuesta = self.client.post(
            '/api/secciones-caja/',
            {'caja': self.caja.id, 'monto_inicial': '100.00'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, 403)

    def test_usuarios_solo_staff(self):
        self.autenticar(self.user_gerente)
        gerente = self.client.get('/api/usuarios/')
        self.assertEqual(gerente.status_code, 403)

        self.autenticar(self.admin)
        admin = self.client.get('/api/usuarios/')
        self.assertEqual(admin.status_code, 200)
