"""Alta, edicion y acceso (roles, sucursales, contrasena) de empleados."""

from app.models import (
    Empleado,
    EmpleadoXRol,
    Sucursal,
    Usuario,
)

from .base import BaseCorralonTestCase


def credenciales(username, password='corralon-seguro-123'):
    return {'username': username, 'password': password}


class EmpleadosApiTests(BaseCorralonTestCase):
    def _payload(self, **extra):
        datos = {
            'dni': '40123123',
            'legajo': '0101',
            'nombre': 'Jeremias',
            'apellido': 'Vega',
            'telefono': '3875551234',
            'estado': 'AC',
        }
        datos.update(extra)
        return datos

    def _crear(self, **extra):
        self.autenticar(self.user_gerente)
        respuesta = self.client.post('/api/empleados/', self._payload(**extra), format='json')
        self.assertEqual(respuesta.status_code, 201)
        return respuesta

    def test_crear_empleado_con_acceso_y_roles(self):
        payload = self._payload(
            usuario_datos={
                'username': 'jvega',
                'email': 'jvega@corralon.com',
                'password': 'corralon-seguro-123',
            },
            roles=[self.roles['CA'].id, self.roles['VE'].id],
            sucursales=[self.sucursal.id],
        )

        self.autenticar(self.user_gerente)
        respuesta = self.client.post('/api/empleados/', payload, format='json')

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['usuario_detalle'], 'jvega')
        self.assertEqual(respuesta.data['roles_detalle'], ['CA', 'VE'])
        self.assertEqual(respuesta.data['sucursales_detalle'], ['Central'])

        empleado = Empleado.objects.get(legajo='0101')
        self.assertEqual(
            empleado.sucursales_asignadas.filter(estado=True).count(), 1
        )
        self.assertEqual(empleado.roles_asignados.filter(estado='AC').count(), 2)

        # El usuario creado puede loguearse.
        token = self.client.post(
            '/api/token/',
            credenciales('jvega'),
            format='json',
        )
        self.assertEqual(token.status_code, 200)

    def test_crear_empleado_sin_acceso_queda_huerfano(self):
        respuesta = self._crear()

        self.assertIsNone(respuesta.data['usuario'])
        self.assertIsNone(respuesta.data['usuario_detalle'])

    def test_crear_empleado_dni_duplicado_devuelve_400(self):
        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            '/api/empleados/',
            self._payload(dni=self.emp_cajero.dni),
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('dni', respuesta.data)

    def test_crear_empleado_legajo_duplicado_devuelve_400(self):
        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            '/api/empleados/',
            self._payload(legajo=self.emp_cajero.legajo),
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('legajo', respuesta.data)

    def test_crear_empleado_usuario_duplicado_devuelve_400(self):
        payload = self._payload(
            usuario_datos={
                'username': self.user_cajero.username,
                'password': 'corralon-seguro-123',
                'email': 'x@corralon.com',
            }
        )
        self.autenticar(self.user_gerente)
        respuesta = self.client.post('/api/empleados/', payload, format='json')

        self.assertEqual(respuesta.status_code, 400)

    def test_crear_empleado_password_debil_devuelve_400(self):
        payload = self._payload(
            usuario_datos={
                'username': 'jvega',
                'password': '12345678',
                'email': 'jvega@corralon.com',
            }
        )
        self.autenticar(self.user_gerente)
        respuesta = self.client.post('/api/empleados/', payload, format='json')

        self.assertEqual(respuesta.status_code, 400)

    def test_update_sincroniza_roles_y_sucursales(self):
        respuesta = self._crear(
            roles=[self.roles['CA'].id],
            sucursales=[self.sucursal.id],
        )
        empleado_id = respuesta.data['id']

        sucursal_nueva = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Nueva',
        )
        respuesta = self.client.patch(
            f'/api/empleados/{empleado_id}/',
            {
                'roles': [self.roles['CA'].id, self.roles['AD'].id],
                'sucursales': [sucursal_nueva.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['roles_detalle'], ['AD', 'CA'])
        self.assertEqual(respuesta.data['sucursales_detalle'], ['Nueva'])

        empleado = Empleado.objects.get(pk=empleado_id)
        self.assertFalse(
            empleado.sucursales_asignadas.filter(sucursal=self.sucursal).first().estado
        )
        self.assertTrue(
            empleado.sucursales_asignadas.filter(sucursal=sucursal_nueva).first().estado
        )

    def test_update_quita_los_roles_que_faltan(self):
        respuesta = self._crear(roles=[self.roles['CA'].id, self.roles['VE'].id])
        empleado_id = respuesta.data['id']

        respuesta = self.client.patch(
            f'/api/empleados/{empleado_id}/',
            {'roles': [self.roles['CA'].id]},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['roles_detalle'], ['CA'])
        self.assertEqual(
            EmpleadoXRol.objects.get(
                empleado_id=empleado_id, rol=self.roles['VE']
            ).estado,
            'IN',
        )

    def test_listado_expone_los_campos_enriquecidos(self):
        respuesta = self.client.get('/api/empleados/')

        self.assertEqual(respuesta.status_code, 200)
        fila = next(
            (row for row in respuesta.data['results'] if row['id'] == self.emp_cajero.id),
            None,
        )
        self.assertIsNotNone(fila)
        self.assertIn('CA', fila['roles_detalle'])
        self.assertIn('Central', fila['sucursales_detalle'])
        self.assertEqual(fila['usuario_email'], 'cajero@corralon.com')

    def test_cambiar_password_ad_lo_hace(self):
        self.autenticar(self.admin)
        respuesta = self.client.post(
            f'/api/empleados/{self.emp_cajero.id}/cambiar-password/',
            {
                'password': 'corralon-seguro-123',
                'password_confirmacion': 'corralon-seguro-123',
                'password_admin': 'test1234',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 200)

        # Con la nueva contraseña se puede loguear.
        token = self.client.post(
            '/api/token/',
            credenciales('cajero'),
            format='json',
        )
        self.assertEqual(token.status_code, 200)

    def test_cambiar_password_gerente_no_puede(self):
        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/empleados/{self.emp_cajero.id}/cambiar-password/',
            {
                'password': 'corralon-seguro-123',
                'password_confirmacion': 'corralon-seguro-123',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 403)

    def test_cambiar_password_cajero_no_puede(self):
        respuesta = self.client.post(
            f'/api/empleados/{self.emp_cajero2.id}/cambiar-password/',
            {
                'password': 'corralon-seguro-123',
                'password_confirmacion': 'corralon-seguro-123',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 403)

    def test_cambiar_password_sin_usuario_devuelve_400(self):
        self.autenticar(self.user_gerente)
        creado = self.client.post(
            '/api/empleados/',
            self._payload(legajo='0505'),
            format='json',
        )
        self.assertEqual(creado.status_code, 201)

        self.autenticar(self.admin)
        respuesta = self.client.post(
            f'/api/empleados/{creado.data["id"]}/cambiar-password/',
            {
                'password': 'corralon-seguro-123',
                'password_confirmacion': 'corralon-seguro-123',
                'password_admin': 'test1234',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)

    def test_cambiar_password_no_coinciden_devuelve_400(self):
        self.autenticar(self.admin)
        respuesta = self.client.post(
            f'/api/empleados/{self.emp_cajero.id}/cambiar-password/',
            {
                'password': 'aaaaaaaa-A1',
                'password_confirmacion': 'bbbbbbbb-B1',
                'password_admin': 'test1234',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password_confirmacion', respuesta.data)

    def test_cambiar_password_admin_incorrecta_devuelve_400(self):
        self.autenticar(self.admin)
        respuesta = self.client.post(
            f'/api/empleados/{self.emp_cajero.id}/cambiar-password/',
            {
                'password': 'corralon-seguro-123',
                'password_confirmacion': 'corralon-seguro-123',
                'password_admin': 'no-es-esta',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password_admin', respuesta.data)

    def test_cambiar_password_debil_devuelve_400(self):
        self.autenticar(self.admin)
        respuesta = self.client.post(
            f'/api/empleados/{self.emp_cajero.id}/cambiar-password/',
            {
                'password': '12345678',
                'password_confirmacion': '12345678',
                'password_admin': 'test1234',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)

    def test_cambiar_password_invalida_tokens_del_usuario(self):
        token = self.client.post(
            '/api/token/',
            credenciales('cajero', 'test1234'),
            format='json',
        )
        self.assertEqual(token.status_code, 200)
        refresco = token.data['refresh']

        self.autenticar(self.admin)
        cambio = self.client.post(
            f'/api/empleados/{self.emp_cajero.id}/cambiar-password/',
            {
                'password': 'corralon-seguro-123',
                'password_confirmacion': 'corralon-seguro-123',
                'password_admin': 'test1234',
            },
            format='json',
        )
        self.assertEqual(cambio.status_code, 200)

        # El refresh token anterior debe estar revocado.
        refresh = self.client.post(
            '/api/token/refresh/',
            {'refresh': refresco},
            format='json',
        )
        self.assertEqual(refresh.status_code, 401)

    def test_roles_detalle_solo_muestra_los_activos(self):
        empleado = Empleado.objects.get(legajo=self.emp_cajero.legajo)
        EmpleadoXRol.objects.update_or_create(
            empleado=empleado,
            rol=self.roles['VE'],
            defaults={'estado': 'IN'},
        )

        respuesta = self.client.get('/api/empleados/')

        self.assertEqual(respuesta.status_code, 200)
        fila = next(
            (row for row in respuesta.data['results'] if row['id'] == empleado.id),
            None,
        )
        self.assertIsNotNone(fila)
        self.assertIn('CA', fila['roles_detalle'])
        self.assertNotIn('VE', fila['roles_detalle'])

    def test_login_bloqueado_si_el_empleado_esta_suspendido(self):
        from rest_framework.test import APIClient

        self.autenticar(self.admin)
        patch = self.client.patch(
            f'/api/empleados/{self.emp_cajero.id}/',
            {'estado': 'SU'},
            format='json',
        )
        self.assertEqual(patch.status_code, 200)

        crudo = APIClient()
        token = crudo.post(
            '/api/token/',
            {'username': 'cajero', 'password': 'test1234'},
            format='json',
        )
        self.assertEqual(token.status_code, 401)

    def test_empleado_suspendido_no_accede_con_token_anterior(self):
        from rest_framework.test import APIClient

        crudo = APIClient()
        token = crudo.post(
            '/api/token/',
            {'username': 'cajero', 'password': 'test1234'},
            format='json',
        )
        self.assertEqual(token.status_code, 200)
        acceso = token.data['access']
        crudo.credentials(HTTP_AUTHORIZATION=f'Bearer {acceso}')

        antes = crudo.get('/api/empleados/')
        self.assertEqual(antes.status_code, 200)

        self.autenticar(self.admin)
        self.client.patch(
            f'/api/empleados/{self.emp_cajero.id}/',
            {'estado': 'SU'},
            format='json',
        )

        # El mismo token, ya suspendido: el servidor lo rechaza (401).
        despues = crudo.get('/api/empleados/')
        self.assertEqual(despues.status_code, 401)

    def test_suspension_invalida_los_refresh_tokens(self):
        from rest_framework.test import APIClient

        crudo = APIClient()
        token = crudo.post(
            '/api/token/',
            {'username': 'cajero', 'password': 'test1234'},
            format='json',
        )
        self.assertEqual(token.status_code, 200)
        refresco = token.data['refresh']

        self.autenticar(self.admin)
        self.client.patch(
            f'/api/empleados/{self.emp_cajero.id}/',
            {'estado': 'SU'},
            format='json',
        )

        refresh = crudo.post(
            '/api/token/refresh/',
            {'refresh': refresco},
            format='json',
        )
        self.assertEqual(refresh.status_code, 401)

    def test_filtro_sucursal_devuelve_solo_los_asignados(self):
        sucursal_vacia = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal futura',
        )

        respuesta = self.client.get(
            f'/api/empleados/?sucursal={self.sucursal.id}'
        )
        self.assertEqual(respuesta.status_code, 200)
        ids = {fila['id'] for fila in respuesta.data['results']}
        self.assertIn(self.emp_cajero.id, ids)

        respuesta = self.client.get(
            f'/api/empleados/?sucursal={sucursal_vacia.id}'
        )
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['results'], [])

    def test_filtro_sucursal_invalida_devuelve_400(self):
        respuesta = self.client.get('/api/empleados/?sucursal=xyz')
        self.assertEqual(respuesta.status_code, 400)
