"""Solicitudes de pago y anulacion de compras.

Las crea quien opera en el corralon (CA/VE/ED) y las resuelven AD/GE.
"""

from .base import BaseCorralonTestCase


class SolicitudCompraTests(BaseCorralonTestCase):
    def _compra(self, user=None):
        respuesta = self.crear_compra(user=user or self.user_cajero)
        self.assertEqual(respuesta.status_code, 201)
        return respuesta.data['id']

    def _solicitar(self, compra_id, user=None, tipo='PG', motivo='Falta pagar al proveedor'):
        self.autenticar(user or self.user_cajero)
        return self.client.post(
            f'/api/compras/{compra_id}/solicitar/',
            {'tipo': tipo, 'motivo': motivo},
            format='json',
        )

    def _pago(self, monto='1000.00'):
        return {
            'pagos': [
                {
                    'metodo_pago': self.efectivo.id,
                    'monto_pagado': monto,
                }
            ]
        }

    def test_cajero_solicita_el_pago_de_una_compra(self):
        compra_id = self._compra()

        respuesta = self._solicitar(compra_id)

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['estado'], 'PE')
        self.assertEqual(respuesta.data['tipo'], 'PG')
        self.assertEqual(respuesta.data['compra'], compra_id)
        self.assertEqual(
            respuesta.data['solicitante_detalle']['username'],
            self.user_cajero.username,
        )

    def test_la_solicitud_exige_un_motivo(self):
        compra_id = self._compra()

        respuesta = self._solicitar(compra_id, motivo='porque')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('motivo', respuesta.data)

    def test_no_se_pueden_hacer_dos_solicitudes_pendientes(self):
        compra_id = self._compra()
        self.assertEqual(self._solicitar(compra_id).status_code, 201)

        segunda = self._solicitar(compra_id)

        self.assertEqual(segunda.status_code, 400)
        self.assertIn('pendiente', segunda.data['detail'])

    def test_la_compra_queda_bloqueada_para_pagar_directo(self):
        compra_id = self._compra()
        self.assertEqual(self._solicitar(compra_id).status_code, 201)

        self.autenticar(self.user_gerente)
        pago = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            self._pago(),
            format='json',
        )

        self.assertEqual(pago.status_code, 400)
        self.assertIn('pendiente', pago.data['detail'])

    def test_solo_admin_y_gerente_resuelven(self):
        compra_id = self._compra()
        solicitud = self._solicitar(compra_id).data['id']

        self.autenticar(self.user_cajero)
        respuesta = self.client.post(
            f'/api/solicitudes-compras/{solicitud}/resolver/',
            {'accion': 'PAGAR', **self._pago()},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 403)

    def test_gerente_resuelve_la_solicitud_pagando(self):
        compra_id = self._compra()
        solicitud = self._solicitar(compra_id).data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/solicitudes-compras/{solicitud}/resolver/',
            {'accion': 'PAGAR', **self._pago()},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'RS')
        self.assertEqual(
            respuesta.data['resuelto_por_detalle']['username'],
            self.user_gerente.username,
        )

        compra = self.client.get(f'/api/compras/{compra_id}/').data
        self.assertEqual(compra['estado'], 'PA')
        self.assertEqual(len(compra['pagos']), 1)
        self.assertIsNone(compra['solicitud_pendiente'])

    def test_si_el_pago_falla_la_solicitud_sigue_pendiente(self):
        compra_id = self._compra()
        solicitud = self._solicitar(compra_id).data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/solicitudes-compras/{solicitud}/resolver/',
            {'accion': 'PAGAR', **self._pago('5000.00')},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)

        estado = self.client.get(
            f'/api/solicitudes-compras/{solicitud}/'
        ).data
        self.assertEqual(estado['estado'], 'PE')
        self.assertIsNone(estado['resuelto_por_detalle'])

    def test_rechazar_deja_la_compra_como_estaba_y_libera_el_pago(self):
        compra_id = self._compra()
        solicitud = self._solicitar(compra_id).data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/solicitudes-compras/{solicitud}/resolver/',
            {
                'accion': 'RECHAZAR',
                'motivo': 'El proveedor lo cobra por transferencia',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'RJ')

        compra = self.client.get(f'/api/compras/{compra_id}/').data
        self.assertEqual(compra['estado'], 'PE')
        self.assertIsNone(compra['solicitud_pendiente'])

        pago = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            self._pago(),
            format='json',
        )
        self.assertEqual(pago.status_code, 200)

    def test_la_compra_muestra_la_solicitud_pendiente(self):
        compra_id = self._compra()
        self._solicitar(compra_id)

        compra = self.client.get(f'/api/compras/{compra_id}/').data

        self.assertIsNotNone(compra['solicitud_pendiente'])
        self.assertEqual(compra['solicitud_pendiente']['tipo'], 'PG')

    def test_no_se_solicita_anulacion_de_una_compra_pagada(self):
        compra_id = self._compra()

        self.autenticar(self.user_gerente)
        pago = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            self._pago(),
            format='json',
        )
        self.assertEqual(pago.status_code, 200)

        respuesta = self._solicitar(
            compra_id,
            tipo='AN',
            motivo='Se compro de mas y hay que anular',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pagos', respuesta.data['detail'])

    def test_la_solicitud_de_anulacion_anula_la_compra(self):
        compra_id = self._compra()
        solicitud = self._solicitar(
            compra_id,
            tipo='AN',
            motivo='Se compro de mas y hay que anular',
        ).data['id']

        self.autenticar(self.user_gerente)
        respuesta = self.client.post(
            f'/api/solicitudes-compras/{solicitud}/resolver/',
            {'accion': 'ANULAR'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'RS')

        compra = self.client.get(f'/api/compras/{compra_id}/').data
        self.assertEqual(compra['estado'], 'AN')

    def test_cada_rol_solo_ve_sus_solicitudes(self):
        compra_cajero = self._compra(self.user_cajero)
        self._solicitar(compra_cajero, user=self.user_cajero)

        compra_venta = self._compra(self.user_vendedor)
        self._solicitar(compra_venta, user=self.user_vendedor)

        self.autenticar(self.user_cajero)
        propias = self.client.get('/api/solicitudes-compras/').data
        self.assertEqual(propias['count'], 1)

        self.autenticar(self.user_gerente)
        todas = self.client.get('/api/solicitudes-compras/').data
        self.assertEqual(todas['count'], 2)

    def test_no_se_puede_resolver_dos_veces(self):
        compra_id = self._compra()
        solicitud = self._solicitar(compra_id).data['id']

        self.autenticar(self.user_gerente)
        primera = self.client.post(
            f'/api/solicitudes-compras/{solicitud}/resolver/',
            {'accion': 'PAGAR', **self._pago()},
            format='json',
        )
        self.assertEqual(primera.status_code, 200)

        segunda = self.client.post(
            f'/api/solicitudes-compras/{solicitud}/resolver/',
            {'accion': 'PAGAR', **self._pago()},
            format='json',
        )

        self.assertEqual(segunda.status_code, 400)
        self.assertIn('resuelta', segunda.data['detail'])
