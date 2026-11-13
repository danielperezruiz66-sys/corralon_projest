from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError
from django.utils import timezone

from app.models import (
    Caja,
    DetalleCierreCaja,
    HistoricalSeccionCaja,
    SeccionCaja,
    Sucursal,
    SucursalXCaja,
    SucursalXEmpleado,
)
from app.services import caja as caja_service

from .base import BaseCorralonTestCase


class CajaApiTests(BaseCorralonTestCase):
    def _caja_asignada(self, nombre='Caja 2', sucursal=None):
        sucursal = sucursal or self.sucursal
        caja = Caja.objects.create(nombre=nombre)
        SucursalXCaja.objects.create(sucursal=sucursal, caja=caja)
        return caja

    def _sucursal_extra(self, nombre='Sucursal 2'):
        return Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre=nombre,
        )

    def test_abrir_seccion_toma_el_empleado_del_usuario(self):
        caja = self._caja_asignada()

        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '500.00',
                'observaciones_apertura': 'Carga inicial de prueba',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['empleado'], self.emp_cajero.id)
        self.assertEqual(respuesta.data['estado'], 'AB')
        self.assertEqual(respuesta.data['abierta_por'], 'cajero')
        self.assertIsNone(respuesta.data['motivo_apertura'])
        self.assertEqual(
            respuesta.data['observaciones_apertura'],
            'Carga inicial de prueba',
        )

    def test_no_se_puede_abrir_dos_veces_la_misma_caja_en_la_sucursal(self):
        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': self.caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '500.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya tiene una seccion abierta', respuesta.data['detail'])

    def test_solo_gestion_abre_a_nombre_de_otro_empleado(self):
        caja = self._caja_asignada()
        datos = {
            'caja': caja.id,
            'sucursal': self.sucursal.id,
            'monto_inicial': '500.00',
            'empleado': self.emp_cajero.id,
            'observaciones_apertura': 'Carga inicial de prueba',
        }

        como_cajero = self.client.post('/api/secciones-caja/', datos, format='json')
        self.assertEqual(como_cajero.status_code, 400)
        self.assertIn('empleado', como_cajero.data)

        self.autenticar(self.user_gerente)
        como_gerente = self.client.post('/api/secciones-caja/', datos, format='json')
        self.assertEqual(como_gerente.status_code, 201)
        self.assertEqual(como_gerente.data['empleado'], self.emp_cajero.id)
        self.assertEqual(como_gerente.data['abierta_por'], 'gerente')
        self.assertEqual(
            como_gerente.data['motivo_apertura'],
            f'Apertura a nombre de {self.emp_cajero}',
        )
        entrada = HistoricalSeccionCaja.objects.get(
            id=como_gerente.data['id'],
            history_type='+',
        )
        self.assertEqual(entrada.history_user.username, 'gerente')
        self.assertEqual(
            entrada.history_change_reason,
            f'Apertura a nombre de {self.emp_cajero}',
        )

    def test_admin_abre_a_nombre_de_otro_y_queda_en_historial(self):
        caja = self._caja_asignada()

        self.autenticar(self.admin)
        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '500.00',
                'empleado': self.emp_vendedor.id,
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('permisos', respuesta.data['detail'])

        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '500.00',
                'empleado': self.emp_cajero.id,
                'observaciones_apertura': 'Carga inicial de prueba',
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['abierta_por'], 'admin')

    def test_superuser_sin_empleado_debe_elegir_empleado(self):
        caja = self._caja_asignada()
        self.autenticar(self.admin)

        sin_empleado = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '100.00',
            },
            format='json',
        )
        self.assertEqual(sin_empleado.status_code, 400)
        self.assertIn('no tiene un empleado asociado', sin_empleado.data['detail'])

        con_empleado = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '100.00',
                'empleado': self.emp_gerente.id,
                'observaciones_apertura': 'Carga inicial de prueba',
            },
            format='json',
        )
        self.assertEqual(con_empleado.status_code, 201)
        self.assertEqual(con_empleado.data['empleado'], self.emp_gerente.id)

    def test_apertura_a_nombre_de_empleado_no_asignado_rechaza(self):
        caja = self._caja_asignada()
        SucursalXEmpleado.objects.filter(
            empleado=self.emp_cajero,
            sucursal=self.sucursal,
        ).update(estado=False)

        self.autenticar(self.admin)
        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '100.00',
                'empleado': self.emp_cajero.id,
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('no esta asignado', respuesta.data['detail'])

    def test_empleado_con_seccion_abierta_no_abre_otra(self):
        # `self.emp_cajero2` ya tiene la seccion abierta del fixture.
        self.autenticar(self.user_cajero2)
        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': self.caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya tiene una seccion de caja abierta', respuesta.data['detail'])

    def test_apertura_a_nombre_de_empleado_con_seccion_abierta_rechaza(self):
        caja = self._caja_asignada()
        self.autenticar(self.admin)
        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '100.00',
                'empleado': self.emp_cajero2.id,
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya tiene una seccion de caja abierta', respuesta.data['detail'])

    def test_filtro_puede_operar_caja_excluye_a_quien_tiene_seccion_abierta(self):
        respuesta = self.client.get(
            f'/api/empleados/?puede_operar_caja={self.sucursal.id}'
        )

        self.assertEqual(respuesta.status_code, 200)
        ids = {fila['id'] for fila in respuesta.data['results']}
        self.assertNotIn(self.emp_cajero2.id, ids)
        self.assertIn(self.emp_cajero.id, ids)

    def test_una_seccion_abierta_por_empleado_a_nivel_base_de_datos(self):
        with self.assertRaises(IntegrityError):
            SeccionCaja.objects.create(
                sucursal_caja=self.sucursal_caja,
                empleado=self.emp_cajero2,
                fecha_hora_apertura=timezone.now(),
                monto_inicial=Decimal('10.00'),
            )

    def test_filtro_puede_operar_caja_expone_solo_elegibles(self):
        respuesta = self.client.get(
            f'/api/empleados/?puede_operar_caja={self.sucursal.id}'
        )

        self.assertEqual(respuesta.status_code, 200)
        ids = {fila['id'] for fila in respuesta.data['results']}
        self.assertIn(self.emp_cajero.id, ids)
        self.assertIn(self.emp_gerente.id, ids)
        self.assertNotIn(self.emp_vendedor.id, ids)
        self.assertNotIn(self.emp_deposito.id, ids)
        self.assertNotIn(self.emp_sin_rol.id, ids)

    def test_filtro_puede_operar_caja_cajero_no_asignado_quedo_fuera(self):
        SucursalXEmpleado.objects.filter(
            empleado=self.emp_cajero,
            sucursal=self.sucursal,
        ).update(estado=False)

        respuesta = self.client.get(
            f'/api/empleados/?puede_operar_caja={self.sucursal.id}'
        )

        self.assertEqual(respuesta.status_code, 200)
        ids = {fila['id'] for fila in respuesta.data['results']}
        self.assertNotIn(self.emp_cajero.id, ids)
        self.assertIn(self.emp_gerente.id, ids)

    def test_filtro_puede_operar_caja_invalido_devuelve_400(self):
        respuesta = self.client.get('/api/empleados/?puede_operar_caja=abc')

        self.assertEqual(respuesta.status_code, 400)

    def test_sugerencia_y_apertura_con_monto_modificado(self):
        caja = self._caja_asignada()

        # En la primera apertura de una caja nueva, sumar dinero exige motivo.
        caja_nueva = self._caja_asignada(nombre='Caja 3')
        sin_motivo = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja_nueva.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '150.00',
            },
            format='json',
        )
        self.assertEqual(sin_motivo.status_code, 400)
        self.assertIn('motivo', sin_motivo.data['detail'])

        # Primera apertura de la caja: sin historial, el monto por defecto
        # (0) abre sin motivo.
        primera = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '0.00',
            },
            format='json',
        )
        self.assertEqual(primera.status_code, 201)

        # Sugerencia antes de cerrar: no hay historial.
        sugerencia = self.client.get(
            f'/api/secciones-caja/sugerencia/?caja={caja.id}&sucursal={self.sucursal.id}'
        )
        self.assertEqual(sugerencia.status_code, 200)
        self.assertEqual(sugerencia.data['monto_sugerido'], '0.00')
        self.assertFalse(sugerencia.data['encontrado'])

        # Se cierra la caja con efectivo contado y se consulta la sugerencia.
        self.client.post(
            f'/api/secciones-caja/{primera.data["id"]}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '250.00'}},
            format='json',
        )

        sugerencia = self.client.get(
            f'/api/secciones-caja/sugerencia/?caja={caja.id}&sucursal={self.sucursal.id}'
        )
        self.assertEqual(sugerencia.status_code, 200)
        self.assertEqual(sugerencia.data['monto_sugerido'], '250.00')
        self.assertTrue(sugerencia.data['encontrado'])
        self.assertEqual(sugerencia.data['seccion_id'], primera.data['id'])

        # Con el monto sugerido se abre sin motivo.
        como_sugerido = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '250.00',
            },
            format='json',
        )
        self.assertEqual(como_sugerido.status_code, 201)
        self.assertIsNone(como_sugerido.data['observaciones_apertura'])

        # Si difiere de la sugerencia, el motivo es obligatorio.
        self.client.post(
            f'/api/secciones-caja/{como_sugerido.data["id"]}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '250.00'}},
            format='json',
        )
        sin_motivo = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '200.00',
            },
            format='json',
        )
        self.assertEqual(sin_motivo.status_code, 400)
        self.assertIn('motivo', sin_motivo.data['detail'])

        con_motivo = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '200.00',
                'observaciones_apertura': 'Se retiro cambio para la otra caja',
            },
            format='json',
        )
        self.assertEqual(con_motivo.status_code, 201)
        self.assertEqual(
            con_motivo.data['observaciones_apertura'],
            'Se retiro cambio para la otra caja',
        )

    def test_sugerencia_requiere_caja_y_sucursal(self):
        respuesta = self.client.get('/api/secciones-caja/sugerencia/')
        respuesta_invalida = self.client.get('/api/secciones-caja/sugerencia/?caja=x&sucursal=1')

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta_invalida.status_code, 400)

    def test_misma_caja_se_puede_abrir_en_dos_sucursales_por_api(self):
        sucursal_extra = self._sucursal_extra()
        user_gerente2, emp_gerente2 = self._crear_usuario('gerente2', '0007', 'GE')
        SucursalXEmpleado.objects.create(
            sucursal=sucursal_extra,
            empleado=self.emp_gerente,
            estado=True,
        )
        caja = Caja.objects.create(nombre='Caja compartida')
        SucursalXCaja.objects.create(sucursal=self.sucursal, caja=caja)
        SucursalXCaja.objects.create(sucursal=sucursal_extra, caja=caja)

        self.autenticar(self.user_gerente)
        primera = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '100.00',
                'observaciones_apertura': 'Carga inicial de prueba',
            },
            format='json',
        )
        # El mismo empleado no puede abrir dos secciones a la vez.
        repetida = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': sucursal_extra.id,
                'monto_inicial': '200.00',
                'observaciones_apertura': 'Carga inicial de prueba',
            },
            format='json',
        )
        self.assertEqual(repetida.status_code, 400)
        self.assertIn('ya tiene una seccion de caja abierta', repetida.data['detail'])

        self.autenticar(user_gerente2)
        segunda = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': sucursal_extra.id,
                'monto_inicial': '200.00',
                'observaciones_apertura': 'Carga inicial de prueba',
            },
            format='json',
        )

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(primera.data['caja'], caja.id)
        self.assertEqual(segunda.data['caja'], caja.id)
        self.assertNotEqual(primera.data['sucursal'], segunda.data['sucursal'])

    def test_cajero_no_abre_en_sucursal_no_asignada(self):
        sucursal_extra = self._sucursal_extra()
        caja = Caja.objects.create(nombre='Caja externa')
        SucursalXCaja.objects.create(sucursal=sucursal_extra, caja=caja)

        respuesta = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': sucursal_extra.id,
                'monto_inicial': '0.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('no esta asignado', respuesta.data['detail'])

    def test_listado_de_secciones_filtra_por_caja_y_sucursal(self):
        respuesta = self.client.get(
            f'/api/secciones-caja/?caja={self.caja.id}&sucursal={self.sucursal.id}'
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['caja'], self.caja.id)

    def test_teorico_devuelve_desglose_por_metodo(self):
        venta = self.crear_venta(cantidad='1.000')
        self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta.data['id'],
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '100.00',
            },
            format='json',
        )

        respuesta = self.client.get(
            f'/api/secciones-caja/{self.seccion.id}/teorico/'
        )

        self.assertEqual(respuesta.status_code, 200)
        fila = next(
            item
            for item in respuesta.data
            if item['metodo_pago'] == self.efectivo.id
        )
        self.assertEqual(Decimal(fila['monto_sistema']), Decimal('1100.00'))
        self.assertTrue(fila['es_efectivo'])

    def test_teorico_rechaza_seccion_cerrada(self):
        self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '1000.00'}},
            format='json',
        )

        respuesta = self.client.get(
            f'/api/secciones-caja/{self.seccion.id}/teorico/'
        )

        self.assertEqual(respuesta.status_code, 400)

    def test_cajas_fisicas_solo_las_gestiona_la_gerencia(self):
        self.autenticar(self.user_cajero)
        como_cajero = self.client.post(
            '/api/cajas/',
            {'nombre': 'Caja nueva'},
            format='json',
        )
        self.assertEqual(como_cajero.status_code, 403)

        self.autenticar(self.user_gerente)
        como_gerente = self.client.post(
            '/api/cajas/',
            {'nombre': 'Caja nueva'},
            format='json',
        )
        self.assertEqual(como_gerente.status_code, 201)

    def test_asignacion_sucursal_caja_solo_la_gestiona_la_gerencia(self):
        caja = Caja.objects.create(nombre='Caja asignable')
        datos = {
            'sucursal': self.sucursal.id,
            'caja': caja.id,
            'habilitada': True,
        }

        self.autenticar(self.user_cajero)
        como_cajero = self.client.post(
            '/api/sucursales-cajas/',
            datos,
            format='json',
        )
        self.assertEqual(como_cajero.status_code, 403)

        self.autenticar(self.user_gerente)
        como_gerente = self.client.post(
            '/api/sucursales-cajas/',
            datos,
            format='json',
        )
        self.assertEqual(como_gerente.status_code, 201)

    def test_cerrar_seccion_calcula_teorico_y_real(self):
        venta = self.crear_venta(cantidad='1.000')
        self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta.data['id'],
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '100.00',
            },
            format='json',
        )

        respuesta = self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '1100.00'}},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'CE')
        self.assertEqual(Decimal(respuesta.data['monto_teorico']), Decimal('1100.00'))
        self.assertEqual(Decimal(respuesta.data['monto_final']), Decimal('1100.00'))
        self.assertEqual(self.seccion.detalles_cierre.count(), 1)
        self.assertEqual(
            self.seccion.detalles_cierre.first().diferencia,
            Decimal('0.00'),
        )

    def test_cerrar_seccion_guarda_la_diferencia(self):
        respuesta = self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {
                'montos_reales': {str(self.efectivo.id): '990.00'},
                'observaciones': 'Faltante',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        detalle = DetalleCierreCaja.objects.get(seccion_caja=self.seccion)
        self.assertEqual(detalle.monto_sistema, Decimal('1000.00'))
        self.assertEqual(detalle.monto_real, Decimal('990.00'))
        self.assertEqual(detalle.diferencia, Decimal('-10.00'))
        self.assertEqual(
            respuesta.data['observaciones'],
            'Diferencia de arqueo: -$10.00 (faltante).\nObservación: Faltante',
        )

    def test_cerrar_seccion_con_diferencia_sin_observaciones_lleva_nota_del_sistema(self):
        respuesta = self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '990.00'}},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(
            respuesta.data['observaciones'],
            'Diferencia de arqueo: -$10.00 (faltante).',
        )

    def test_cerrar_seccion_con_sobrante_lleva_nota_del_sistema(self):
        respuesta = self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '1100.00'}},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(
            respuesta.data['observaciones'],
            'Diferencia de arqueo: +$100.00 (sobrante).',
        )

    def test_no_se_puede_cerrar_dos_veces(self):
        self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '1000.00'}},
            format='json',
        )

        respuesta = self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '1000.00'}},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)

    def test_auditar_solo_secciones_cerradas(self):
        self.autenticar(self.user_gerente)
        abierta = self.client.post(f'/api/secciones-caja/{self.seccion.id}/auditar/')
        self.assertEqual(abierta.status_code, 400)

        self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {str(self.efectivo.id): '1000.00'}},
            format='json',
        )
        cerrada = self.client.post(f'/api/secciones-caja/{self.seccion.id}/auditar/')

        self.assertEqual(cerrada.status_code, 200)
        self.assertEqual(cerrada.data['estado'], 'AU')

    def test_montos_reales_invalidos_devuelven_400(self):
        respuesta = self.client.post(
            f'/api/secciones-caja/{self.seccion.id}/cerrar/',
            {'montos_reales': {'9999': '1000.00'}},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(
            SeccionCaja.objects.get(pk=self.seccion.pk).estado
            == SeccionCaja.EstadoSeccion.CERRADA
        )


class CajaServicioTests(BaseCorralonTestCase):
    def _asignacion(self, nombre='Caja 2', sucursal=None):
        sucursal = sucursal or self.sucursal
        caja = Caja.objects.create(nombre=nombre)
        return SucursalXCaja.objects.create(sucursal=sucursal, caja=caja)

    def _sucursal_extra(self, nombre='Sucursal 2'):
        return Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre=nombre,
        )

    def test_abrir_seccion_valida_asignacion(self):
        asignacion = self._asignacion()

        seccion = caja_service.abrir_seccion(
            asignacion.caja,
            self.sucursal,
            self.emp_cajero,
            '500.00',
            observaciones_apertura='Carga inicial de prueba',
        )

        self.assertEqual(seccion.sucursal_caja, asignacion)
        self.assertEqual(seccion.estado, SeccionCaja.EstadoSeccion.ABIERTA)
        self.assertEqual(seccion.monto_inicial, Decimal('500.00'))

    def test_caja_no_asignada_a_la_sucursal_rechaza(self):
        caja = Caja.objects.create(nombre='Caja suelta')

        with self.assertRaisesMessage(ValueError, 'no esta asignada'):
            caja_service.abrir_seccion(caja, self.sucursal, self.emp_cajero, '0.00')

    def test_asignacion_deshabilitada_rechaza(self):
        asignacion = self._asignacion()
        asignacion.habilitada = False
        asignacion.save(update_fields=['habilitada'])

        with self.assertRaisesMessage(ValueError, 'no esta habilitada'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_cajero,
                '0.00',
            )

    def test_caja_inactiva_rechaza(self):
        asignacion = self._asignacion()
        asignacion.caja.estado = Caja.EstadoCaja.INACTIVA
        asignacion.caja.save(update_fields=['estado'])

        with self.assertRaisesMessage(ValueError, 'no esta activa'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_cajero,
                '0.00',
            )

    def test_no_permite_dos_abiertas_en_la_misma_asignacion(self):
        # La seccion de `setUpTestData` ya esta abierta en (Caja 1, Central).
        with self.assertRaisesMessage(ValueError, 'ya tiene una seccion abierta'):
            caja_service.abrir_seccion(
                self.caja,
                self.sucursal,
                self.emp_cajero,
                '0.00',
            )

    def test_misma_caja_puede_abrirse_en_dos_sucursales(self):
        sucursal_extra = self._sucursal_extra()
        SucursalXEmpleado.objects.create(
            sucursal=sucursal_extra,
            empleado=self.emp_gerente,
            estado=True,
        )
        SucursalXCaja.objects.create(
            sucursal=sucursal_extra,
            caja=self.caja,
        )

        seccion = caja_service.abrir_seccion(
            self.caja,
            sucursal_extra,
            self.emp_gerente,
            '0.00',
        )

        self.assertEqual(
            self.seccion.sucursal_caja.sucursal,
            self.sucursal,
        )
        self.assertEqual(seccion.sucursal_caja.sucursal, sucursal_extra)
        self.assertEqual(
            SeccionCaja.objects.filter(
                sucursal_caja__caja=self.caja,
                estado=SeccionCaja.EstadoSeccion.ABIERTA,
            ).count(),
            2,
        )

    def test_empleado_no_asignado_a_la_sucursal_rechaza(self):
        SucursalXEmpleado.objects.filter(
            empleado=self.emp_cajero,
            sucursal=self.sucursal,
        ).update(estado=False)
        asignacion = self._asignacion()

        with self.assertRaisesMessage(ValueError, 'no esta asignado a la sucursal'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_cajero,
                '0.00',
            )

    def test_gerente_opera_en_cualquier_sucursal(self):
        sucursal_extra = self._sucursal_extra()
        asignacion = self._asignacion(
            nombre='Caja 9',
            sucursal=sucursal_extra,
        )

        seccion = caja_service.abrir_seccion(
            asignacion.caja,
            sucursal_extra,
            self.emp_gerente,
            '0.00',
        )

        self.assertEqual(seccion.estado, SeccionCaja.EstadoSeccion.ABIERTA)
        self.assertEqual(seccion.sucursal_caja.sucursal, sucursal_extra)

    def test_monto_inicial_negativo_rechaza(self):
        asignacion = self._asignacion()

        with self.assertRaisesMessage(ValueError, 'no puede ser negativo'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_cajero,
                '-1.00',
            )

    def test_vendedor_no_tiene_permisos_para_abrir_caja(self):
        asignacion = self._asignacion()

        with self.assertRaisesMessage(ValueError, 'no tiene permisos'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_vendedor,
                '0.00',
            )

    def test_empleado_inactivo_no_abre_caja(self):
        asignacion = self._asignacion()
        self.emp_cajero.estado = self.emp_cajero.EstadoEmpleado.INACTIVO
        self.emp_cajero.save(update_fields=['estado'])

        with self.assertRaisesMessage(ValueError, 'no esta activo'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_cajero,
                '0.00',
            )

    def test_apertura_guarda_motivo_y_usuario_en_el_historial(self):
        asignacion = self._asignacion()

        seccion = caja_service.abrir_seccion(
            asignacion.caja,
            self.sucursal,
            self.emp_cajero,
            '0.00',
            historial_motivo='Apertura a nombre de Test, cajero',
            historial_usuario=self.user_gerente,
        )

        entrada = HistoricalSeccionCaja.objects.get(
            id=seccion.id,
            history_type='+',
        )
        self.assertEqual(
            entrada.history_change_reason,
            'Apertura a nombre de Test, cajero',
        )
        self.assertEqual(entrada.history_user, self.user_gerente)

    def test_sugerir_apertura_sin_historial_devuelve_cero(self):
        asignacion = self._asignacion()

        sugerencia = caja_service.sugerir_apertura(
            asignacion.caja,
            self.sucursal,
        )

        self.assertEqual(sugerencia['monto_sugerido'], Decimal('0.00'))
        self.assertFalse(sugerencia['encontrado'])

    def test_sugerir_apertura_solo_mira_la_misma_sucursal(self):
        sucursal_extra = self._sucursal_extra()
        SucursalXCaja.objects.create(sucursal=sucursal_extra, caja=self.caja)
        extra_asignacion = SucursalXCaja.objects.get(
            sucursal=sucursal_extra,
            caja=self.caja,
        )
        seccion_extra = SeccionCaja.objects.create(
            sucursal_caja=extra_asignacion,
            empleado=self.emp_gerente,
            fecha_hora_apertura=timezone.now() - timedelta(days=1),
            fecha_hora_cierre=timezone.now() - timedelta(hours=23),
            monto_inicial=Decimal('10.00'),
            monto_final=Decimal('777.00'),
            estado=SeccionCaja.EstadoSeccion.CERRADA,
        )
        DetalleCierreCaja.objects.create(
            seccion_caja=seccion_extra,
            metodo_pago=self.efectivo,
            monto_sistema=Decimal('777.00'),
            monto_real=Decimal('777.00'),
        )

        sugerencia_extra = caja_service.sugerir_apertura(
            self.caja,
            sucursal_extra,
        )
        sugerencia_central = caja_service.sugerir_apertura(
            self.caja,
            self.sucursal,
        )

        self.assertEqual(sugerencia_extra['monto_sugerido'], Decimal('777.00'))
        self.assertTrue(sugerencia_extra['encontrado'])
        self.assertEqual(sugerencia_extra['seccion_id'], seccion_extra.id)
        self.assertEqual(sugerencia_central['monto_sugerido'], Decimal('0.00'))
        self.assertFalse(sugerencia_central['encontrado'])

    def test_sugerir_apertura_durante_la_misma_sesion_ignora_abiertas(self):
        # La seccion de setUpTestData sigue abierta: no cuenta como cierre.
        sugerencia = caja_service.sugerir_apertura(self.caja, self.sucursal)

        self.assertEqual(sugerencia['monto_sugerido'], Decimal('0.00'))
        self.assertFalse(sugerencia['encontrado'])

    def test_abrir_seccion_difiere_de_la_sugerencia_exige_motivo(self):
        asignacion = self._asignacion()
        seccion = caja_service.abrir_seccion(
            asignacion.caja,
            self.sucursal,
            self.emp_cajero,
            '0.00',
        )
        caja_service.cerrar_seccion(
            seccion,
            {str(self.efectivo.id): '400.00'},
        )

        with self.assertRaisesMessage(ValueError, 'motivo'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_cajero,
                '300.00',
            )

        # Con el monto sugerido no exige motivo.
        seccion = caja_service.abrir_seccion(
            asignacion.caja,
            self.sucursal,
            self.emp_cajero,
            '400.00',
        )
        self.assertEqual(seccion.monto_inicial, Decimal('400.00'))

    def test_empleado_con_seccion_abierta_no_abre_otra_seccion(self):
        # `self.emp_cajero2` ya tiene la seccion abierta del fixture.
        asignacion = self._asignacion()

        with self.assertRaisesMessage(ValueError, 'ya tiene una seccion'):
            caja_service.abrir_seccion(
                asignacion.caja,
                self.sucursal,
                self.emp_cajero2,
                '0.00',
            )
