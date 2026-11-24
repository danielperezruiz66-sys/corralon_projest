"""Caja: apertura, cierre, pausa, auditoria y restricciones.

Cada caja fisica pertenece a una sucursal y cada sesion de trabajo es un
`MovimientoCaja`. Para cerrar se exige la contraseña del usuario autenticado.
"""

from decimal import Decimal

from django.utils import timezone

from app.models import (
    Caja,
    DetalleCierreCaja,
    HistoricalMovimientoCaja,
    MovimientoCaja,
    Sucursal,
    SucursalXEmpleado,
)

from .base import BaseCorralonTestCase

APERTURA = '/api/movimientos-caja/'
CIERRE = '/api/movimientos-caja/{}/cerrar/'
SUGERENCIA = '/api/movimientos-caja/sugerencia/'


class CajaApiTests(BaseCorralonTestCase):
    def _sucursal_extra(self, nombre='Sucursal 2'):
        return Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre=nombre,
        )

    def _caja(self, numero=2, sucursal=None):
        return Caja.objects.create(
            sucursal=sucursal or self.sucursal,
            numero_caja=numero,
        )

    def _abrir(self, caja, user=None, **extra):
        self.autenticar(user or self.user_cajero)
        datos = {
            'caja': caja.id,
            'sucursal': caja.sucursal_id,
            'monto_inicial': '0.00',
        }
        datos.update(extra)
        return self.client.post(APERTURA, datos, format='json')

    def _cerrar(self, movimiento, user=None, password=None, montos=None):
        user = user or movimiento.empleado.usuario
        self.autenticar(user)
        return self.client.post(
            CIERRE.format(movimiento.id),
            {
                'montos_reales': (
                    montos
                    if montos is not None
                    else {str(self.efectivo.id): '1000.00'}
                ),
                'password': self.PASSWORD if password is None else password,
            },
            format='json',
        )

    def test_abrir_toma_el_empleado_del_usuario(self):
        caja = self._caja()

        respuesta = self._abrir(caja)

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['empleado'], self.emp_cajero.id)
        self.assertEqual(respuesta.data['estado'], 'AB')
        self.assertEqual(respuesta.data['abierta_por'], 'cajero')
        self.assertIsNone(respuesta.data['motivo_apertura'])
        self.assertEqual(respuesta.data['caja'], caja.id)
        self.assertEqual(respuesta.data['sucursal'], self.sucursal.id)

    def test_no_se_puede_abrir_dos_veces_la_misma_caja(self):
        respuesta = self._abrir(self.caja)

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya tiene un movimiento', respuesta.data['detail'])

    def test_rechaza_sucursal_que_no_coincide_con_la_caja(self):
        otra = self._sucursal_extra()
        caja = self._caja()

        respuesta = self._abrir(caja, sucursal=otra.id)

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('sucursal', respuesta.data)

    def test_solo_gestion_abre_a_nombre_de_otro_empleado(self):
        caja = self._caja()
        datos = {
            'empleado': self.emp_cajero.id,
            'observaciones_apertura': 'Carga inicial de prueba',
        }

        como_cajero = self._abrir(caja, **datos)
        self.assertEqual(como_cajero.status_code, 400)
        self.assertIn('empleado', como_cajero.data)

        como_gerente = self._abrir(caja, user=self.user_gerente, **datos)
        self.assertEqual(como_gerente.status_code, 201)
        self.assertEqual(como_gerente.data['empleado'], self.emp_cajero.id)
        self.assertEqual(como_gerente.data['abierta_por'], 'gerente')
        self.assertEqual(
            como_gerente.data['motivo_apertura'],
            f'Apertura a nombre de {self.emp_cajero}',
        )
        entrada = HistoricalMovimientoCaja.objects.get(
            id=como_gerente.data['id'],
            history_type='+',
        )
        self.assertEqual(entrada.history_user.username, 'gerente')
        self.assertEqual(
            entrada.history_change_reason,
            f'Apertura a nombre de {self.emp_cajero}',
        )

    def test_admin_abre_a_nombre_de_otro_y_queda_en_historial(self):
        caja = self._caja()
        self.autenticar(self.admin)

        invalido = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
                'empleado': self.emp_vendedor.id,
            },
            format='json',
        )
        self.assertEqual(invalido.status_code, 400)
        self.assertIn('permisos', invalido.data['detail'])

        valido = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
                'empleado': self.emp_cajero.id,
            },
            format='json',
        )
        self.assertEqual(valido.status_code, 201)
        self.assertEqual(valido.data['abierta_por'], 'admin')

    def test_superuser_sin_empleado_debe_elegir_empleado(self):
        caja = self._caja()
        self.autenticar(self.admin)

        sin_empleado = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
            },
            format='json',
        )
        self.assertEqual(sin_empleado.status_code, 400)
        self.assertIn('no tiene un empleado asociado', sin_empleado.data['detail'])

        con_empleado = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
                'empleado': self.emp_gerente.id,
            },
            format='json',
        )
        self.assertEqual(con_empleado.status_code, 201)

    def test_empleado_con_movimiento_abierto_no_abre_otro(self):
        caja = self._caja()

        respuesta = self._abrir(caja, user=self.user_cajero2)

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya tiene un movimiento', respuesta.data['detail'])

    def test_filtro_puede_operar_caja_excluye_a_quien_tiene_movimiento(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.get(
            '/api/empleados/',
            {'puede_operar_caja': self.sucursal.id},
        )

        self.assertEqual(respuesta.status_code, 200)
        ids = {item['id'] for item in respuesta.data['results']}
        self.assertNotIn(self.emp_cajero2.id, ids)
        self.assertIn(self.emp_cajero.id, ids)

    def test_filtro_puede_operar_caja_invalido_devuelve_400(self):
        self.autenticar(self.user_gerente)

        respuesta = self.client.get(
            '/api/empleados/',
            {'puede_operar_caja': 'x'},
        )

        self.assertEqual(respuesta.status_code, 400)

    def test_sugerencia_y_apertura_con_monto_modificado(self):
        caja = self._caja()

        sin_motivo = self._abrir(caja, monto_inicial='150.00')
        self.assertEqual(sin_motivo.status_code, 400)
        self.assertIn('motivo', sin_motivo.data['detail'])

        primera = self._abrir(caja, monto_inicial='0.00')
        self.assertEqual(primera.status_code, 201)

        sugerencia = self.client.get(
            f'{SUGERENCIA}?caja={caja.id}&sucursal={self.sucursal.id}'
        )
        self.assertEqual(sugerencia.data['monto_sugerido'], '0.00')
        self.assertFalse(sugerencia.data['encontrado'])

        self._cerrar(
            MovimientoCaja.objects.get(pk=primera.data['id']),
            montos={str(self.efectivo.id): '250.00'},
        )

        sugerencia = self.client.get(
            f'{SUGERENCIA}?caja={caja.id}&sucursal={self.sucursal.id}'
        )
        self.assertEqual(sugerencia.data['monto_sugerido'], '250.00')
        self.assertTrue(sugerencia.data['encontrado'])

        como_sugerido = self._abrir(caja, monto_inicial='250.00')
        self.assertEqual(como_sugerido.status_code, 201)
        self.assertIsNone(como_sugerido.data['observaciones_apertura'])

        self._cerrar(
            MovimientoCaja.objects.get(pk=como_sugerido.data['id']),
            montos={str(self.efectivo.id): '250.00'},
        )

        sin_motivo = self._abrir(caja, monto_inicial='200.00')
        self.assertEqual(sin_motivo.status_code, 400)
        self.assertIn('motivo', sin_motivo.data['detail'])

        con_motivo = self._abrir(
            caja,
            monto_inicial='200.00',
            observaciones_apertura='Se retiro cambio para la otra caja',
        )
        self.assertEqual(con_motivo.status_code, 201)
        self.assertEqual(
            con_motivo.data['observaciones_apertura'],
            'Se retiro cambio para la otra caja',
        )

    def test_sugerencia_requiere_caja_y_sucursal(self):
        respuesta = self.client.get(SUGERENCIA)
        invalida = self.client.get(f'{SUGERENCIA}?caja=x&sucursal=1')

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(invalida.status_code, 400)

    def test_cajero_no_abre_en_sucursal_no_asignada(self):
        otra = self._sucursal_extra()
        caja = self._caja(sucursal=otra)

        respuesta = self._abrir(caja)

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('no esta asignado', respuesta.data['detail'])

    def test_gerente_opera_en_cualquier_sucursal(self):
        otra = self._sucursal_extra()
        SucursalXEmpleado.objects.create(
            sucursal=otra,
            empleado=self.emp_gerente,
            estado=True,
        )
        caja = self._caja(sucursal=otra)

        respuesta = self._abrir(caja, user=self.user_gerente)

        self.assertEqual(respuesta.status_code, 201)

    def test_listado_filtra_por_caja_y_sucursal(self):
        self.autenticar(self.admin)

        por_caja = self.client.get('/api/movimientos-caja/', {'caja': self.caja.id})
        self.assertEqual(por_caja.status_code, 200)
        self.assertEqual(por_caja.data['count'], 1)

        otra = self._sucursal_extra()
        caja_otra = self._caja(sucursal=otra)
        MovimientoCaja.objects.create(
            caja=caja_otra,
            empleado=self.emp_vendedor,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('100.00'),
        )
        por_sucursal = self.client.get(
            '/api/movimientos-caja/',
            {'sucursal': otra.id},
        )
        self.assertEqual(por_sucursal.data['count'], 1)
        self.assertEqual(por_sucursal.data['results'][0]['sucursal'], otra.id)

    def test_teorico_devuelve_desglose_por_metodo(self):
        self.autenticar(self.user_cajero2)
        self.crear_venta(user=self.user_cajero2, cantidad='2.000')
        venta = self.client.get('/api/ventas/').data['results'][0]
        self.client.post(
            f'/api/ventas/{venta["id"]}/cobrar/',
            {
                'pagos': [
                    {'metodo_pago': self.efectivo.id, 'monto_pagado': '200.00'}
                ]
            },
            format='json',
        )

        respuesta = self.client.get(
            f'/api/movimientos-caja/{self.seccion.id}/teorico/'
        )

        self.assertEqual(respuesta.status_code, 200)
        efectivo = next(
            item for item in respuesta.data if item['metodo_pago'] == self.efectivo.id
        )
        self.assertEqual(Decimal(efectivo['monto_sistema']), Decimal('1200.00'))

    def test_teorico_rechaza_movimiento_cerrado(self):
        self._cerrar(self.seccion)

        respuesta = self.client.get(
            f'/api/movimientos-caja/{self.seccion.id}/teorico/'
        )

        self.assertEqual(respuesta.status_code, 400)

    def test_cajas_fisicas_solo_las_gestiona_la_gerencia(self):
        self.autenticar(self.user_cajero)
        como_cajero = self.client.post(
            '/api/cajas/',
            {'sucursal': self.sucursal.id, 'numero_caja': 3},
            format='json',
        )
        self.assertEqual(como_cajero.status_code, 403)

        self.autenticar(self.user_gerente)
        como_gerente = self.client.post(
            '/api/cajas/',
            {'sucursal': self.sucursal.id, 'numero_caja': 3},
            format='json',
        )
        self.assertEqual(como_gerente.status_code, 201)

    def test_numero_de_caja_unico_por_sucursal(self):
        self.autenticar(self.user_gerente)

        repetida = self.client.post(
            '/api/cajas/',
            {'sucursal': self.sucursal.id, 'numero_caja': 1},
            format='json',
        )
        self.assertEqual(repetida.status_code, 400)
        self.assertEqual(
            repetida.data['numero_caja'],
            ['Ya existe una caja con ese número.'],
        )

        otra = self._sucursal_extra()
        permitida = self.client.post(
            '/api/cajas/',
            {'sucursal': otra.id, 'numero_caja': 1},
            format='json',
        )
        self.assertEqual(permitida.status_code, 201)

    def test_estado_de_caja_con_movimiento_abierto_o_pausado(self):
        self.autenticar(self.user_gerente)
        url = f'/api/cajas/{self.caja.id}/'

        abierta = self.client.patch(url, {'estado': 'IN'}, format='json')
        self.assertEqual(abierta.status_code, 400)
        self.assertIn(
            'movimiento abierto o en pausa',
            abierta.data['estado'][0],
        )

        self.seccion.estado = 'PA'
        self.seccion.save(update_fields=['estado'])
        listado = self.client.get(
            '/api/cajas/',
            {'sucursal': self.sucursal.id},
        )
        self.assertTrue(listado.data['results'][0]['movimiento_abierto'])

        pausada = self.client.patch(url, {'estado': 'MT'}, format='json')
        self.assertEqual(pausada.status_code, 400)

        mismo_estado = self.client.patch(url, {'estado': 'AC'}, format='json')
        self.assertEqual(mismo_estado.status_code, 200)

        self.seccion.estado = 'CE'
        self.seccion.save(update_fields=['estado'])
        cerrada = self.client.patch(url, {'estado': 'IN'}, format='json')
        self.assertEqual(cerrada.status_code, 200)
        self.assertEqual(cerrada.data['estado'], 'IN')
        self.assertFalse(cerrada.data['movimiento_abierto'])

    def test_busqueda_encuentra_por_caja_y_empleado(self):
        self.autenticar(self.admin)
        caja2 = self._caja(numero=2)
        movimiento = MovimientoCaja.objects.create(
            caja=caja2,
            empleado=self.emp_vendedor,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('100.00'),
        )

        por_nombre = self.client.get(
            '/api/movimientos-caja/',
            {'search': 'Caja 2'},
        )
        self.assertEqual(por_nombre.status_code, 200)
        self.assertEqual(por_nombre.data['count'], 1)
        self.assertEqual(por_nombre.data['results'][0]['id'], movimiento.id)

        por_numero = self.client.get(
            '/api/movimientos-caja/',
            {'search': '2'},
        )
        self.assertEqual(por_numero.data['count'], 1)
        self.assertEqual(por_numero.data['results'][0]['id'], movimiento.id)

        por_empleado = self.client.get(
            '/api/movimientos-caja/',
            {'search': 'Cajero2'},
        )
        self.assertEqual(por_empleado.data['count'], 1)
        self.assertEqual(por_empleado.data['results'][0]['id'], self.seccion.id)

        todas = self.client.get('/api/movimientos-caja/', {'search': 'Caja'})
        self.assertEqual(todas.data['count'], 2)

        cerradas = self.client.get(
            '/api/movimientos-caja/',
            {'search': 'Caja 2', 'estado': 'CE'},
        )
        self.assertEqual(cerradas.data['count'], 0)

    def test_apertura_con_monto_invalido_devuelve_mensajes_en_espanol(self):
        self.autenticar(self.user_cajero)
        caja = self._caja()

        sin_monto = self.client.post(
            APERTURA,
            {'caja': caja.id, 'sucursal': self.sucursal.id},
            format='json',
        )
        self.assertEqual(sin_monto.status_code, 400)
        self.assertEqual(
            sin_monto.data['monto_inicial'],
            ['Ingresá el monto inicial.'],
        )

        for monto in ('', 'abc'):
            respuesta = self.client.post(
                APERTURA,
                {
                    'caja': caja.id,
                    'sucursal': self.sucursal.id,
                    'monto_inicial': monto,
                },
                format='json',
            )
            self.assertEqual(respuesta.status_code, 400)
            self.assertEqual(
                respuesta.data['monto_inicial'],
                ['El monto inicial debe ser un número.'],
            )

        negativo = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '-1.00',
            },
            format='json',
        )
        self.assertEqual(negativo.status_code, 400)
        self.assertEqual(
            negativo.data['monto_inicial'],
            ['El monto inicial no puede ser negativo.'],
        )

    def test_cerrar_calcula_teorico_y_real(self):
        respuesta = self._cerrar(
            self.seccion,
            montos={str(self.efectivo.id): '1000.00'},
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'CE')
        self.assertEqual(Decimal(respuesta.data['monto_teorico']), Decimal('1000.00'))
        self.assertEqual(Decimal(respuesta.data['monto_final']), Decimal('1000.00'))
        detalle = DetalleCierreCaja.objects.get(movimiento_caja=self.seccion)
        self.assertEqual(detalle.monto_sistema, Decimal('1000.00'))
        self.assertEqual(detalle.monto_real, Decimal('1000.00'))

    def test_cerrar_exige_la_contrasena_del_usuario(self):
        sin_password = self.client.post(
            CIERRE.format(self.seccion.id),
            {'montos_reales': {str(self.efectivo.id): '1000.00'}},
            format='json',
        )
        self.assertEqual(sin_password.status_code, 400)
        self.assertEqual(
            sin_password.data['password'],
            ['Ingresá tu contraseña para cerrar el movimiento.'],
        )

        incorrecta = self._cerrar(self.seccion, password='incorrecta')
        self.assertEqual(incorrecta.status_code, 400)
        self.assertIn('contraseña', incorrecta.data['detail'])
        self.seccion.refresh_from_db()
        self.assertEqual(self.seccion.estado, 'AB')

    def test_cerrar_guarda_la_diferencia(self):
        respuesta = self._cerrar(
            self.seccion,
            montos={str(self.efectivo.id): '900.00'},
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(Decimal(respuesta.data['monto_final']), Decimal('900.00'))
        self.assertIn(
            'Diferencia de arqueo',
            respuesta.data['observaciones'],
        )

    def test_no_se_puede_cerrar_dos_veces(self):
        self._cerrar(self.seccion)

        respuesta = self._cerrar(self.seccion)

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('no está abierto', respuesta.data['detail'])

    def test_auditar_solo_movimientos_cerrados(self):
        self.autenticar(self.user_gerente)
        abierta = self.client.post(
            f'/api/movimientos-caja/{self.seccion.id}/auditar/'
        )
        self.assertEqual(abierta.status_code, 400)

        self._cerrar(self.seccion)
        self.autenticar(self.user_gerente)
        cerrada = self.client.post(
            f'/api/movimientos-caja/{self.seccion.id}/auditar/'
        )
        self.assertEqual(cerrada.status_code, 200)
        self.assertEqual(cerrada.data['estado'], 'AU')

    def test_montos_reales_invalidos_devuelven_400(self):
        self.autenticar(self.user_cajero2)

        respuesta = self.client.post(
            CIERRE.format(self.seccion.id),
            {
                'montos_reales': {'no-es-id': '100.00'},
                'password': self.PASSWORD,
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)


class CajaServicioTests(BaseCorralonTestCase):
    def _caja(self, numero=2):
        return Caja.objects.create(
            sucursal=self.sucursal,
            numero_caja=numero,
        )

    def test_caja_inactiva_rechaza(self):
        caja = self._caja()
        caja.estado = Caja.EstadoCaja.INACTIVA
        caja.save(update_fields=['estado'])

        respuesta = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('no esta activa', respuesta.data['detail'])

    def test_monto_inicial_negativo_rechaza(self):
        caja = self._caja()

        respuesta = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '-1.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)

    def test_vendedor_no_tiene_permisos_para_abrir_caja(self):
        self.autenticar(self.user_vendedor)

        respuesta = self.client.post(
            APERTURA,
            {
                'caja': self._caja().id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_empleado_inactivo_no_abre_caja(self):
        from app.services import caja as caja_service

        caja = self._caja()
        self.emp_cajero.estado = 'IN'
        self.emp_cajero.save(update_fields=['estado'])

        with self.assertRaisesMessage(ValueError, 'no esta activo'):
            caja_service.abrir_seccion(caja, self.emp_cajero, '0.00')

    def test_apertura_guarda_motivo_y_usuario_en_el_historial(self):
        caja = self._caja()
        self.autenticar(self.user_gerente)

        respuesta = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
                'empleado': self.emp_cajero.id,
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)
        entrada = HistoricalMovimientoCaja.objects.get(
            id=respuesta.data['id'],
            history_type='+',
        )
        self.assertEqual(entrada.history_user.username, 'gerente')
        self.assertEqual(
            entrada.history_change_reason,
            f'Apertura a nombre de {self.emp_cajero}',
        )

    def test_sugerir_apertura_sin_historial_devuelve_cero(self):
        from app.services import caja as caja_service

        caja = self._caja()

        sugerencia = caja_service.sugerir_apertura(caja)

        self.assertEqual(sugerencia['monto_sugerido'], Decimal('0.00'))
        self.assertFalse(sugerencia['encontrado'])
        self.assertIsNone(sugerencia['seccion_id'])

    def test_sugerir_apertura_ignora_movimientos_abiertos(self):
        from app.services import caja as caja_service

        sugerencia = caja_service.sugerir_apertura(self.caja)

        self.assertEqual(sugerencia['monto_sugerido'], Decimal('0.00'))
        self.assertFalse(sugerencia['encontrado'])

    def test_abrir_difiere_de_la_sugerencia_exige_motivo(self):
        caja = self._caja()

        respuesta = self.client.post(
            APERTURA,
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '10.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('motivo', respuesta.data['detail'])
