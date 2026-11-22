from app.models import Empresa

from .base import BaseCorralonTestCase


class ConfiguracionEmpresaTests(BaseCorralonTestCase):
    def test_superuser_puede_listar_y_editar_empresa(self):
        self.autenticar(self.admin)

        lista = self.client.get('/api/empresas/')
        self.assertEqual(lista.status_code, 200)
        self.assertEqual(lista.data['count'], 1)

        respuesta = self.client.patch(
            f'/api/empresas/{self.empresa.id}/',
            {'telefono': '3879999999'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, 200)
        self.empresa.refresh_from_db()
        self.assertEqual(self.empresa.telefono, '3879999999')

    def test_rol_ad_edita_solo_la_empresa_asignada(self):
        otra = Empresa.objects.create(
            cuit='30999999999',
            nombre='Otra',
            razon_social='Otra SA',
        )
        user_ad, _ = self._crear_usuario('adminrol', '0007', 'AD')
        self.autenticar(user_ad)

        lista = self.client.get('/api/empresas/')
        self.assertEqual(lista.status_code, 200)
        self.assertEqual(lista.data['count'], 1)
        self.assertEqual(lista.data['results'][0]['id'], self.empresa.id)

        propia = self.client.patch(
            f'/api/empresas/{self.empresa.id}/',
            {'nombre': 'Corralón Editado'},
            format='json',
        )
        self.assertEqual(propia.status_code, 200)

        ajena = self.client.patch(
            f'/api/empresas/{otra.id}/',
            {'nombre': 'No debería cambiar'},
            format='json',
        )
        self.assertEqual(ajena.status_code, 404)

    def test_gerente_no_puede_acceder_a_configuracion(self):
        self.autenticar(self.user_gerente)

        lista = self.client.get('/api/empresas/')
        self.assertEqual(lista.status_code, 403)

        edicion = self.client.patch(
            f'/api/empresas/{self.empresa.id}/',
            {'nombre': 'No permitido'},
            format='json',
        )
        self.assertEqual(edicion.status_code, 403)

    def test_otros_roles_no_pueden_acceder_a_configuracion(self):
        for usuario in (
            self.user_cajero,
            self.user_vendedor,
            self.user_deposito,
            self.user_sin_rol,
        ):
            self.autenticar(usuario)
            respuesta = self.client.get('/api/empresas/')
            self.assertEqual(respuesta.status_code, 403)

    def test_no_permite_cuit_duplicado(self):
        self.autenticar(self.admin)

        respuesta = self.client.post(
            '/api/empresas/',
            {
                'cuit': self.empresa.cuit,
                'nombre': 'Duplicada',
                'razon_social': 'Duplicada SA',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('cuit', respuesta.data)
        self.assertEqual(Empresa.objects.count(), 1)

    def test_cuit_se_normaliza_antes_de_validar(self):
        self.autenticar(self.admin)

        respuesta = self.client.post(
            '/api/empresas/',
            {
                'cuit': '30-11111111-1',
                'nombre': 'Duplicada',
                'razon_social': 'Duplicada SA',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('cuit', respuesta.data)
        self.assertEqual(Empresa.objects.count(), 1)


class PerfilTests(BaseCorralonTestCase):
    def test_perfil_incluye_datos_del_empleado(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.get('/api/perfil/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['is_active'])
        empleado = respuesta.data['empleado']
        self.assertEqual(empleado['dni'], self.emp_cajero.dni)
        self.assertIsNone(empleado['telefono'])
        self.assertEqual(empleado['estado'], 'AC')
        self.assertEqual(empleado['estado_detalle'], 'Activo')

    def test_rol_no_administrador_no_puede_editar_su_perfil(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.patch(
            f'/api/usuarios/{self.user_cajero.id}/',
            {'email': 'otro@corralon.com'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_rol_ad_puede_editar_su_perfil(self):
        user_ad, emp_ad = self._crear_usuario('adminrol', '0007', 'AD')
        self.autenticar(user_ad)

        respuesta = self.client.patch(
            f'/api/usuarios/{user_ad.id}/',
            {'empleado': {'nombre': 'Nuevo'}},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        emp_ad.refresh_from_db()
        self.assertEqual(emp_ad.nombre, 'Nuevo')

    def test_superuser_puede_editar_su_perfil(self):
        self.autenticar(self.admin)

        respuesta = self.client.patch(
            f'/api/usuarios/{self.admin.id}/',
            {'email': 'admin2@corralon.com'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.email, 'admin2@corralon.com')
