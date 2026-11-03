from decimal import Decimal

from app.models import Caja, DetalleCierreCaja, SeccionCaja

from .base import BaseCorralonTestCase


class CajaApiTests(BaseCorralonTestCase):
    def test_abrir_seccion_toma_el_empleado_del_usuario(self):
        caja = Caja.objects.create(sucursal=self.sucursal)

        respuesta = self.client.post(
            '/api/secciones-caja/',
            {'caja': caja.id, 'monto_inicial': '500.00'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['empleado'], self.emp_cajero.id)
        self.assertEqual(respuesta.data['estado'], 'AB')

    def test_no_se_puede_abrir_dos_veces_la_misma_caja(self):
        respuesta = self.client.post(
            '/api/secciones-caja/',
            {'caja': self.caja.id, 'monto_inicial': '500.00'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya tiene una seccion abierta', respuesta.data['detail'])

    def test_solo_admin_abre_a_nombre_de_otro_empleado(self):
        caja = Caja.objects.create(sucursal=self.sucursal)
        datos = {
            'caja': caja.id,
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
