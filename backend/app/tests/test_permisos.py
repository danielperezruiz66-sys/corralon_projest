from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from app.models import Caja, MovimientoCaja, Sucursal

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


class AlcanceCajaTests(BaseCorralonTestCase):
    """Cada rol ve solo las secciones de caja que le corresponden."""

    def _seccion_de_un_colega(self):
        """Otra sección abierta en la misma sucursal, de otro empleado."""
        otra_caja = Caja.objects.create(
            sucursal=self.sucursal,
            numero_caja=2,
        )
        MovimientoCaja.objects.create(
            caja=otra_caja,
            empleado=self.emp_cajero,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('500.00'),
        )

    def _seccion_en_otra_sucursal(self):
        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )
        otra_caja = Caja.objects.create(
            sucursal=otra,
            numero_caja=1,
        )
        MovimientoCaja.objects.create(
            caja=otra_caja,
            empleado=self.emp_vendedor,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('500.00'),
        )
        return otra

    def test_el_cajero_solo_ve_sus_propias_secciones(self):
        self.autenticar(self.user_cajero2)

        respuesta = self.client.get('/api/movimientos-caja/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(
            respuesta.data['results'][0]['empleado'],
            self.emp_cajero2.id,
        )

    def test_el_cajero_no_ve_las_secciones_de_sus_colegas(self):
        self._seccion_de_un_colega()
        self.autenticar(self.user_cajero2)

        respuesta = self.client.get('/api/movimientos-caja/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(
            respuesta.data['results'][0]['empleado'],
            self.emp_cajero2.id,
        )

    def test_el_cajero_no_puede_consultar_otra_sucursal(self):
        otra = self._seccion_en_otra_sucursal()
        self.autenticar(self.user_cajero)

        respuesta = self.client.get(
            '/api/movimientos-caja/',
            {'sucursal': otra.id},
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_el_gerente_ve_las_secciones_de_su_sucursal(self):
        self._seccion_en_otra_sucursal()
        self.autenticar(self.user_gerente)

        respuesta = self.client.get('/api/movimientos-caja/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)

    def test_el_admin_ve_todas_las_secciones(self):
        self._seccion_en_otra_sucursal()
        self.autenticar(self.admin)

        respuesta = self.client.get('/api/movimientos-caja/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 2)

    def test_el_dashboard_del_cajero_solo_muestra_sus_cajas(self):
        self._seccion_de_un_colega()
        self.autenticar(self.user_cajero2)

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)
        self.assertEqual(len(respuesta.data['cajas_abiertas']), 1)
        self.assertEqual(
            respuesta.data['cajas_abiertas'][0]['empleado'],
            str(self.emp_cajero2),
        )

    def test_empleados_se_pueden_filtrar_por_rol(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.get('/api/empleados/', {'rol': 'CA'})

        self.assertEqual(respuesta.status_code, 200)
        self.assertGreaterEqual(respuesta.data['count'], 1)
        for empleado in respuesta.data['results']:
            self.assertIn('CA', empleado['roles_detalle'])

    def test_el_filtro_por_rol_devuelve_lista_vacia_si_no_hay_coincidencias(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.get('/api/empleados/', {'rol': 'ZZ'})

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 0)


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
            {
                'razon_social': 'Cliente vendedor',
                'tipo_documento': 'CUIT',
                'dni': '30700000001',
                'telefono': '3415550001',
            },
            format='json',
        )
        self.assertEqual(vendedor.status_code, 201)

        self.autenticar(self.user_deposito)
        deposito = self.client.post(
            '/api/clientes/',
            {
                'razon_social': 'Cliente deposito',
                'tipo_documento': 'CUIT',
                'dni': '30700000002',
                'telefono': '3415550002',
            },
            format='json',
        )
        self.assertEqual(deposito.status_code, 403)

    def test_cajero_puede_editar_un_cliente(self):
        self.autenticar(self.user_cajero)
        creado = self.client.post(
            '/api/clientes/',
            {
                'razon_social': 'Cliente editable',
                'tipo_documento': 'CUIT',
                'dni': '30700000003',
                'telefono': '3415550003',
            },
            format='json',
        )

        respuesta = self.client.patch(
            f'/api/clientes/{creado.data["id"]}/',
            {'telefono': '3415555555'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['telefono'], '3415555555')

        self.autenticar(self.user_deposito)
        denegado = self.client.patch(
            f'/api/clientes/{creado.data["id"]}/',
            {'telefono': '3415555556'},
            format='json',
        )
        self.assertEqual(denegado.status_code, 403)

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
        self.assertEqual(self.crear_compra(user=self.user_cajero).status_code, 201)
        self.assertEqual(self.crear_compra(user=self.user_vendedor).status_code, 201)
        self.assertEqual(self.crear_compra(user=self.user_sin_rol).status_code, 403)

    def test_cajero_y_vendedor_operan_compras_pero_no_las_gestionan(self):
        for user in (self.user_cajero, self.user_vendedor):
            with self.subTest(rol=user.username):
                compra = self.crear_compra(user=user)
                self.assertEqual(compra.status_code, 201)
                compra_id = compra.data['id']

                self.autenticar(user)
                en_camino = self.client.post(
                    f'/api/compras/{compra_id}/en-camino/',
                    {'fecha_estimada_llegada': '2026-12-01'},
                    format='json',
                )
                self.assertEqual(en_camino.status_code, 200)

                recibir = self.client.post(f'/api/compras/{compra_id}/recibir/')
                self.assertEqual(recibir.status_code, 200)

                pago = self.client.post(
                    f'/api/compras/{compra_id}/pagar/',
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
                self.assertEqual(pago.status_code, 403)

                anular = self.client.post(
                    f'/api/compras/{compra_id}/anular/',
                    {'motivo': 'Compra de prueba'},
                    format='json',
                )
                self.assertEqual(anular.status_code, 403)

    def test_cajero_y_vendedor_consultan_proveedores_pero_no_los_editan(self):
        for user in (self.user_cajero, self.user_vendedor):
            with self.subTest(rol=user.username):
                self.autenticar(user)
                lectura = self.client.get('/api/proveedores/')
                self.assertEqual(lectura.status_code, 200)

                escritura = self.client.post(
                    '/api/proveedores/',
                    {
                        'cuit': '30722222222',
                        'nombre': 'Proveedor sin permiso',
                        'razon_social': 'Proveedor sin permiso SA',
                        'sucursales': [self.sucursal.id],
                    },
                    format='json',
                )
                self.assertEqual(escritura.status_code, 403)

    def test_cancelar_venta_no_lo_puede_hacer_un_vendedor(self):
        venta = self.crear_venta(user=self.user_vendedor)

        self.autenticar(self.user_vendedor)
        respuesta = self.client.post(f'/api/ventas/{venta.data["id"]}/cancelar/')

        self.assertEqual(respuesta.status_code, 403)

    def test_el_vendedor_no_cobra_ni_confirma_la_venta(self):
        venta = self.crear_venta(user=self.user_vendedor)
        venta_id = venta.data['id']

        self.autenticar(self.user_vendedor)
        pago = self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta_id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '200.00',
            },
            format='json',
        )
        self.assertEqual(pago.status_code, 403)

        confirmar = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(confirmar.status_code, 403)

        cobro = self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
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
        self.assertEqual(cobro.status_code, 403)

        self.autenticar(self.user_cajero)
        pago = self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta_id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '200.00',
            },
            format='json',
        )
        self.assertEqual(pago.status_code, 201)

        confirmar = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(confirmar.status_code, 200)

    def test_caja_la_operan_admin_gerente_y_cajero(self):
        self.assertEqual(
            self.crear_venta(user=self.user_cajero).status_code,
            201,
        )
        self.autenticar(self.user_vendedor)
        respuesta = self.client.post(
            '/api/movimientos-caja/',
            {'caja': self.caja.id, 'sucursal': self.sucursal.id, 'monto_inicial': '100.00'},
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

    def test_compras_las_crea_pero_no_las_gestiona_el_encargado_de_deposito(self):
        compra = self.crear_compra(user=self.user_deposito)
        self.assertEqual(compra.status_code, 201)
        compra_id = compra.data['id']

        self.autenticar(self.user_deposito)
        pago = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
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
        self.assertEqual(pago.status_code, 403)

        otra = self.crear_compra(user=self.user_deposito)
        self.autenticar(self.user_deposito)
        anular = self.client.post(
            f'/api/compras/{otra.data["id"]}/anular/',
            {'motivo': 'Compra de prueba'},
            format='json',
        )
        self.assertEqual(anular.status_code, 403)

    def test_el_vendedor_no_paga_ni_anula_compras(self):
        compra = self.crear_compra(user=self.user_deposito)
        compra_id = compra.data['id']

        self.autenticar(self.user_vendedor)
        pago = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
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
        self.assertEqual(pago.status_code, 403)

        anular = self.client.post(
            f'/api/compras/{compra_id}/anular/',
            {'motivo': 'Compra de prueba'},
            format='json',
        )
        self.assertEqual(anular.status_code, 403)
