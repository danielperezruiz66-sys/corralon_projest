"""Reglas endurecidas de roles, sucursal y caja.

Cubre los huecos detectados en la auditoria:

- la lectura ya no queda abierta a cualquier autenticado;
- un gerente no puede asignar el rol `AD` ni modificar el rol de administrador;
- `is_staff` no se puede cambiar desde la API;
- nadie opera sobre otra sucursal;
- una caja en pausa no recibe ventas ni pagos;
- la sugerencia de apertura solo la ve quien puede abrir caja.
"""

from decimal import Decimal

from django.utils import timezone

from app.models import (
    Caja,
    EmpleadoXRol,
    MovimientoCaja,
    Sucursal,
    Usuario,
    Venta,
)

from .base import BaseCorralonTestCase


class LecturaPorRolTests(BaseCorralonTestCase):
    def test_el_encargado_de_deposito_no_lee_ventas_ni_auditoria(self):
        self.autenticar(self.user_deposito)

        for url in (
            '/api/ventas/',
            '/api/clientes/',
            '/api/facturas/',
            '/api/empleados/',
            '/api/actividad/',
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)

        self.assertEqual(self.client.get('/api/compras/').status_code, 200)
        self.assertEqual(self.client.get('/api/productos/').status_code, 200)

    def test_el_cajero_no_lee_empleados_ni_auditoria(self):
        self.autenticar(self.user_cajero)

        self.assertEqual(self.client.get('/api/empleados/').status_code, 403)
        self.assertEqual(self.client.get('/api/actividad/').status_code, 403)
        self.assertEqual(self.client.get('/api/cajas/').status_code, 200)
        self.assertEqual(self.client.get('/api/facturas/').status_code, 200)

    def test_sin_rol_no_lee_ningun_modulo_operativo(self):
        self.autenticar(self.user_sin_rol)

        for url in (
            '/api/productos/',
            '/api/stocks/',
            '/api/clientes/',
            '/api/compras/',
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)

    def test_el_admin_lee_todo(self):
        self.autenticar(self.admin)

        for url in (
            '/api/empleados/',
            '/api/actividad/',
            '/api/ventas/',
            '/api/compras/',
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)


class EscaladaDeRolesTests(BaseCorralonTestCase):
    def test_el_gerente_no_asigna_el_rol_admin(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.post(
            '/api/empleados-roles/',
            {
                'empleado': self.emp_sin_rol.id,
                'rol': self.roles['AD'].id,
                'estado': 'AC',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('rol', respuesta.data)
        self.assertFalse(
            EmpleadoXRol.objects.filter(
                empleado=self.emp_sin_rol,
                rol=self.roles['AD'],
            ).exists()
        )

    def test_el_gerente_no_crea_un_empleado_admin(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.post(
            '/api/empleados/',
            {
                'dni': '30999999999',
                'legajo': '0099',
                'nombre': 'Nuevo',
                'apellido': 'Admin',
                'roles': [self.roles['AD'].id],
                'sucursales': [self.sucursal.id],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('roles', respuesta.data)

    def test_el_gerente_no_edita_el_rol_admin(self):
        self.autenticar(self.user_gerente)

        cambiar_codigo = self.client.patch(
            f'/api/roles/{self.roles["VE"].id}/',
            {'codigo': 'AD'},
            format='json',
        )
        editar_admin = self.client.patch(
            f'/api/roles/{self.roles["AD"].id}/',
            {'descripcion': 'Cambio del gerente'},
            format='json',
        )

        self.assertEqual(cambiar_codigo.status_code, 400)
        self.assertEqual(editar_admin.status_code, 400)

    def test_el_gerente_no_modifica_a_un_administrador(self):
        asignacion = EmpleadoXRol.objects.create(
            empleado=self.emp_sin_rol,
            rol=self.roles['AD'],
            estado='AC',
        )
        self.autenticar(self.user_gerente)

        editar = self.client.patch(
            f'/api/empleados/{self.emp_sin_rol.id}/',
            {'telefono': '3415559999'},
            format='json',
        )
        eliminar = self.client.delete(
            f'/api/empleados/{self.emp_sin_rol.id}/'
        )
        quitar_rol = self.client.delete(
            f'/api/empleados-roles/{asignacion.id}/'
        )

        self.assertEqual(editar.status_code, 400)
        self.assertEqual(eliminar.status_code, 403)
        self.assertEqual(quitar_rol.status_code, 403)

    def test_el_admin_si_asigna_el_rol_admin(self):
        self.autenticar(self.admin)

        respuesta = self.client.post(
            '/api/empleados-roles/',
            {
                'empleado': self.emp_sin_rol.id,
                'rol': self.roles['AD'].id,
                'estado': 'AC',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)

    def test_is_staff_no_se_puede_cambiar_desde_la_api(self):
        personal = Usuario.objects.create_user(
            username='personal',
            password=self.PASSWORD,
            is_staff=True,
        )
        self.autenticar(personal)

        respuesta = self.client.patch(
            f'/api/usuarios/{self.user_cajero.id}/',
            {'is_staff': True},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.user_cajero.refresh_from_db()
        self.assertFalse(self.user_cajero.is_staff)


class CambioDePasswordTests(BaseCorralonTestCase):
    def _cambiar(self, empleado, datos, user):
        self.autenticar(user)
        return self.client.post(
            f'/api/empleados/{empleado.id}/cambiar-password/',
            datos,
            format='json',
        )

    def test_el_gerente_no_cambia_la_password_de_otro(self):
        respuesta = self._cambiar(
            self.emp_cajero,
            {
                'password': 'NuevaClave123!',
                'password_confirmacion': 'NuevaClave123!',
                'password_admin': self.PASSWORD,
            },
            self.user_gerente,
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_cada_usuario_cambia_su_password_con_la_actual(self):
        respuesta = self._cambiar(
            self.emp_cajero,
            {
                'password': 'NuevaClave123!',
                'password_confirmacion': 'NuevaClave123!',
                'password_actual': self.PASSWORD,
            },
            self.user_cajero,
        )

        self.assertEqual(respuesta.status_code, 200)
        self.user_cajero.refresh_from_db()
        self.assertTrue(self.user_cajero.check_password('NuevaClave123!'))

    def test_la_password_actual_incorrecta_se_rechaza(self):
        respuesta = self._cambiar(
            self.emp_vendedor,
            {
                'password': 'NuevaClave123!',
                'password_confirmacion': 'NuevaClave123!',
                'password_actual': 'incorrecta',
            },
            self.user_vendedor,
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password_actual', respuesta.data)

    def test_el_admin_cambia_la_password_de_otro(self):
        respuesta = self._cambiar(
            self.emp_vendedor,
            {
                'password': 'NuevaClave123!',
                'password_confirmacion': 'NuevaClave123!',
                'password_admin': self.PASSWORD,
            },
            self.admin,
        )

        self.assertEqual(respuesta.status_code, 200)


class CajaPausadaTests(BaseCorralonTestCase):
    def test_una_caja_en_pausa_no_cobra_ventas(self):
        venta = self.crear_venta(user=self.user_cajero)
        self.seccion.estado = MovimientoCaja.EstadoMovimiento.PAUSADA
        self.seccion.save(update_fields=['estado'])

        self.autenticar(self.user_cajero)
        respuesta = self.client.post(
            f'/api/ventas/{venta.data["id"]}/cobrar/',
            {
                'pagos': [
                    {
                        'metodo_pago': self.efectivo.id,
                        'monto_pagado': '200.00',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pausa', respuesta.data['detail'])

    def test_una_caja_en_pausa_no_paga_compras(self):
        compra = self.crear_compra(user=self.user_gerente)
        self.seccion.estado = MovimientoCaja.EstadoMovimiento.PAUSADA
        self.seccion.save(update_fields=['estado'])

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/compras/{compra.data["id"]}/pagar/',
            {
                'pagos': [
                    {
                        'metodo_pago': self.efectivo.id,
                        'monto_pagado': '100.00',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pausa', respuesta.data['detail'])


class AlcanceSucursalTests(BaseCorralonTestCase):
    def _sucursal_y_movimiento_ajenos(self):
        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )
        caja = Caja.objects.create(sucursal=otra, numero_caja=1)
        movimiento = MovimientoCaja.objects.create(
            caja=caja,
            empleado=self.emp_deposito,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('100.00'),
        )
        return otra, movimiento

    def test_no_se_puede_vender_con_la_caja_de_otra_sucursal(self):
        _, movimiento = self._sucursal_y_movimiento_ajenos()

        self.autenticar(self.user_cajero)
        respuesta = self.client.post(
            '/api/ventas/',
            self.payload_venta(movimiento_caja=movimiento.id),
            format='json',
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_el_listado_no_muestra_ventas_de_otra_sucursal(self):
        _, movimiento = self._sucursal_y_movimiento_ajenos()
        ajena = Venta.objects.create(
            movimiento_caja=movimiento,
            cliente=self.cliente,
            estado=Venta.EstadoVenta.PENDIENTE,
            monto_venta=Decimal('10.00'),
        )

        self.autenticar(self.user_cajero)
        respuesta = self.client.get('/api/ventas/')

        self.assertEqual(respuesta.status_code, 200)
        ids = [item['id'] for item in respuesta.data['results']]
        self.assertNotIn(ajena.id, ids)

        self.autenticar(self.admin)
        respuesta = self.client.get('/api/ventas/')
        ids = [item['id'] for item in respuesta.data['results']]
        self.assertIn(ajena.id, ids)

    def test_no_se_puede_filtrar_por_una_sucursal_ajena(self):
        otra, _ = self._sucursal_y_movimiento_ajenos()

        self.autenticar(self.user_cajero)
        respuesta = self.client.get('/api/ventas/', {'sucursal': otra.id})

        self.assertEqual(respuesta.status_code, 403)

    def test_una_sucursal_invalida_devuelve_400(self):
        self.autenticar(self.user_cajero)

        respuesta = self.client.get('/api/ventas/', {'sucursal': 'xyz'})

        self.assertEqual(respuesta.status_code, 400)

    def test_el_stock_se_limita_a_la_sucursal_asignada(self):
        _, _ = self._sucursal_y_movimiento_ajenos()

        self.autenticar(self.user_cajero)
        respuesta = self.client.get('/api/stocks/')

        self.assertEqual(respuesta.status_code, 200)
        for item in respuesta.data['results']:
            self.assertEqual(item['sucursal'], self.sucursal.id)


class SugerenciaYCajasAbiertasTests(BaseCorralonTestCase):
    def test_el_vendedor_no_ve_la_sugerencia_de_apertura(self):
        self.autenticar(self.user_vendedor)

        respuesta = self.client.get(
            f'/api/movimientos-caja/sugerencia/?caja={self.caja.id}'
            f'&sucursal={self.sucursal.id}'
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_el_vendedor_ve_las_cajas_abiertas_de_su_sucursal(self):
        self.autenticar(self.user_vendedor)

        respuesta = self.client.get('/api/movimientos-caja/abiertas/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.data), 1)
        self.assertEqual(respuesta.data[0]['id'], self.seccion.id)
