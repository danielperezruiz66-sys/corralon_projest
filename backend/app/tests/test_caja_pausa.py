"""Estado "En pausa" de la seccion de caja.

- El dueno puede pausar la seccion con un motivo (queda auditado).
- Solo el dueno puede reanudarla, y para eso tiene que poner su contraseña.
"""

from .base import BaseCorralonTestCase
from app.models import MovimientoCaja


class PausaCajaTests(BaseCorralonTestCase):
    """La seccion del fixture (`self.seccion`) es de `emp_cajero2`."""

    MOTIVO = 'Salgo a cargar mercaderia al deposito'

    def _pausar(self, user=None, motivo=None):
        self.autenticar(user or self.user_cajero2)
        return self.client.post(
            f'/api/movimientos-caja/{self.seccion.id}/pausar/',
            {'motivo': motivo or self.MOTIVO},
            format='json',
        )

    def _reanudar(self, user=None, clave=None):
        self.autenticar(user or self.user_cajero2)
        return self.client.post(
            f'/api/movimientos-caja/{self.seccion.id}/reanudar/',
            {'clave': clave if clave is not None else self.PASSWORD},
            format='json',
        )

    def test_el_dueno_pausa_la_seccion_con_motivo(self):
        respuesta = self._pausar()

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'PA')
        self.assertEqual(respuesta.data['estado_detalle'], 'Pausada')
        self.assertEqual(respuesta.data['motivo_pausa'], self.MOTIVO)

    def test_la_pausa_exige_un_motivo(self):
        respuesta = self._pausar(motivo='porque')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('motivo', respuesta.data)

    def test_la_pausa_queda_auditada_en_el_historial(self):
        self._pausar()

        registro = (
            MovimientoCaja.objects.get(pk=self.seccion.pk)
            .history.filter(history_change_reason__startswith='Pausa')
            .first()
        )

        self.assertIsNotNone(registro)
        self.assertIn(self.MOTIVO, registro.history_change_reason)

    def test_otro_empleado_no_puede_pausar_la_seccion(self):
        respuesta = self._pausar(user=self.user_cajero)

        # La sección no es visible para otro empleado: no existe para él.
        self.assertEqual(respuesta.status_code, 404)

    def test_el_gerente_puede_pausar_la_seccion_de_otro(self):
        respuesta = self._pausar(user=self.user_gerente)

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'PA')

    def test_reanudar_requiere_la_contrasena_del_dueno(self):
        self._pausar()

        respuesta = self._reanudar(clave='clave-incorrecta')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('contraseña', respuesta.data['detail'])
        self.assertEqual(
            MovimientoCaja.objects.get(pk=self.seccion.pk).estado,
            'PA',
        )

    def test_el_dueno_reanuda_con_su_contrasena(self):
        self._pausar()

        respuesta = self._reanudar()

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'AB')
        self.assertEqual(respuesta.data['motivo_pausa'], '')

    def test_otro_empleado_no_puede_reanudar(self):
        self._pausar()

        respuesta = self._reanudar(user=self.user_cajero)

        self.assertEqual(respuesta.status_code, 404)

    def test_el_gerente_reanuda_con_la_contrasena_del_dueno(self):
        self._pausar()

        incorrecta = self._reanudar(user=self.user_gerente, clave='incorrecta')
        self.assertEqual(incorrecta.status_code, 400)
        self.assertIn('contraseña', incorrecta.data['detail'])

        respuesta = self._reanudar(user=self.user_gerente)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'AB')
        self.assertEqual(respuesta.data['motivo_pausa'], '')

    def test_el_gerente_reanuda_con_su_propia_contrasena(self):
        self._pausar()
        self.user_gerente.set_password('clave-gestion-distinta')
        self.user_gerente.save(update_fields=['password'])
        self.addCleanup(self._restablecer_password_gerente)

        respuesta = self._reanudar(
            user=self.user_gerente,
            clave='clave-gestion-distinta',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'AB')

    def _restablecer_password_gerente(self):
        self.user_gerente.set_password(self.PASSWORD)
        self.user_gerente.save(update_fields=['password'])

    def test_no_se_puede_cerrar_una_seccion_pausada(self):
        self._pausar()

        respuesta = self.client.post(
            f'/api/movimientos-caja/{self.seccion.id}/cerrar/',
            {
                'montos_reales': {str(self.efectivo.id): '1000.00'},
                'password': self.PASSWORD,
                'observaciones': 'Cierre de prueba con arqueo',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pausa', respuesta.data['detail'])

    def test_no_se_pueden_registrar_ventas_sobre_una_seccion_pausada(self):
        self._pausar()

        respuesta = self.crear_venta(user=self.user_cajero2)

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pausa', respuesta.data['detail'])

    def test_con_la_seccion_pausada_no_se_puede_abrir_otra(self):
        self._pausar()

        self.autenticar(self.user_cajero2)
        respuesta = self.client.post(
            '/api/movimientos-caja/',
            {
                'caja': self.caja.id,
                'sucursal': self.sucursal.id,
                'monto_inicial': '100.00',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
