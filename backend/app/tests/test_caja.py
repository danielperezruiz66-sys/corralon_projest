from decimal import Decimal

from app.models import (
    Caja,
    DetalleCierreCaja,
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
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['empleado'], self.emp_cajero.id)
        self.assertEqual(respuesta.data['estado'], 'AB')

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

    def test_solo_admin_abre_a_nombre_de_otro_empleado(self):
        caja = self._caja_asignada()
        datos = {
            'caja': caja.id,
            'sucursal': self.sucursal.id,
            'monto_inicial': '500.00',
            'empleado': self.emp_vendedor.id,
        }

        como_cajero = self.client.post('/api/secciones-caja/', datos, format='json')
        self.assertEqual(como_cajero.status_code, 400)
        self.assertIn('empleado', como_cajero.data)

        self.autenticar(self.admin)
        como_admin = self.client.post('/api/secciones-caja/', datos, format='json')
        self.assertEqual(como_admin.status_code, 201)
        self.assertEqual(como_admin.data['empleado'], self.emp_vendedor.id)

    def test_misma_caja_se_puede_abrir_en_dos_sucursales_por_api(self):
        self.autenticar(self.user_gerente)
        sucursal_extra = self._sucursal_extra()
        SucursalXEmpleado.objects.create(
            sucursal=sucursal_extra,
            empleado=self.emp_gerente,
            estado=True,
        )
        caja = Caja.objects.create(nombre='Caja compartida')
        SucursalXCaja.objects.create(sucursal=self.sucursal, caja=caja)
        SucursalXCaja.objects.create(sucursal=sucursal_extra, caja=caja)

        primera = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '100.00',
            },
            format='json',
        )
        segunda = self.client.post(
            '/api/secciones-caja/',
            {
                'caja': caja.id,
                'sucursal': sucursal_extra.id,
                'monto_inicial': '200.00',
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
        self.assertEqual(respuesta.data['observaciones'], 'Faltante')

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
