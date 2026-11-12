from decimal import Decimal

from app.models import Compra, MetodoPago, Venta

from .base import BaseCorralonTestCase


class PagoVentaTests(BaseCorralonTestCase):
    def _pagar(self, venta_id, monto, metodo=None):
        return self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta_id,
                'metodo_pago': (metodo or self.efectivo).id,
                'monto_pagado': monto,
            },
            format='json',
        )

    def _cobrar(self, venta_id, pagos, confirmar=False):
        return self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
            {'pagos': pagos, 'confirmar': confirmar},
            format='json',
        )

    def test_cobro_con_dos_metodos_queda_pendiente(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']

        respuesta = self._cobrar(
            venta_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '40.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '60.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'PE')
        self.assertEqual(len(respuesta.data['pagos']), 2)
        self.assertEqual(
            sum(
                Decimal(pago['monto_pagado'])
                for pago in respuesta.data['pagos']
            ),
            Decimal('100.00'),
        )

    def test_cobro_con_dos_metodos_y_confirmacion(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']

        respuesta = self._cobrar(
            venta_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '30.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '70.00'},
            ],
            confirmar=True,
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'CO')
        self.assertEqual(len(respuesta.data['pagos']), 2)

    def test_cobro_parcial_con_dos_metodos(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']

        respuesta = self._cobrar(
            venta_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '20.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '30.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'PE')
        self.assertEqual(len(respuesta.data['pagos']), 2)
        self.assertEqual(
            sum(
                Decimal(pago['monto_pagado'])
                for pago in respuesta.data['pagos']
            ),
            Decimal('50.00'),
        )

    def test_cobro_no_guarda_nada_si_supera_el_saldo(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']

        respuesta = self._cobrar(
            venta_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '60.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '50.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('superan', respuesta.data['detail'])
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PE')
        self.assertEqual(
            Venta.objects.get(pk=venta_id).pagos.count(),
            0,
        )

    def test_cobro_no_guarda_nada_con_metodo_inactivo(self):
        self.tarjeta.estado = False
        self.tarjeta.save(update_fields=['estado'])
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']

        respuesta = self._cobrar(
            venta_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '50.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '50.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('inactivo', respuesta.data['detail'])
        self.assertEqual(Venta.objects.get(pk=venta_id).pagos.count(), 0)

    def test_confirmar_con_saldo_pendiente_devuelve_400(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']

        respuesta = self._cobrar(
            venta_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '40.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '20.00'},
            ],
            confirmar=True,
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('cubrir el total', respuesta.data['detail'])
        self.assertEqual(Venta.objects.get(pk=venta_id).pagos.count(), 0)
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PE')

    def test_pago_parcial_y_total(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self.assertEqual(Decimal(venta.data['monto_venta']), Decimal('100.00'))

        parcial = self._pagar(venta_id, '40.00')
        self.assertEqual(parcial.status_code, 201)
        # La venta sigue pendiente y no se confirma con saldo.
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PE')

        no_confirma = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(no_confirma.status_code, 400)
        self.assertIn('totalmente paga', no_confirma.data['detail'])

        total = self._pagar(venta_id, '60.00')
        self.assertEqual(total.status_code, 201)
        # El pago no confirma la venta: lo hace el cajero manualmente.
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PE')

        confirmada = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(confirmada.status_code, 200)
        self.assertEqual(confirmada.data['estado'], 'CO')

    def test_pago_total_y_confirmacion(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self.assertEqual(Decimal(venta.data['monto_venta']), Decimal('100.00'))

        total = self._pagar(venta_id, '100.00')
        self.assertEqual(total.status_code, 201)
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PE')

        confirmada = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(confirmada.status_code, 200)
        self.assertEqual(confirmada.data['estado'], 'CO')

    def test_no_permite_anular_venta_pendiente_con_pago_parcial(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self._pagar(venta_id, '40.00')

        respuesta = self.client.post(
            f'/api/ventas/{venta_id}/cancelar/',
            {'motivo': 'prueba'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pagos registrados', respuesta.data['detail'])
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PE')

    def test_no_permite_pagar_de_mas(self):
        venta = self.crear_venta(cantidad='1.000')

        respuesta = self._pagar(venta.data['id'], '150.00')

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data['codigo'], 'error_de_negocio')
        self.assertIn('supera', respuesta.data['detail'])

    def test_no_permite_pagar_una_venta_anulada(self):
        venta = self.crear_venta(cantidad='1.000')
        self.client.post(
            f'/api/ventas/{venta.data["id"]}/cancelar/',
            {'motivo': 'prueba'},
            format='json',
        )

        respuesta = self._pagar(venta.data['id'], '10.00')

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('anulada', respuesta.data['detail'])

    def test_no_permite_pagar_una_venta_inexistente(self):
        respuesta = self._pagar(999999, '10.00')

        self.assertEqual(respuesta.status_code, 400)


class PagoCompraTests(BaseCorralonTestCase):
    def _pagar(self, compra_id, pagos):
        return self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            {'pagos': pagos},
            format='json',
        )

    def test_pago_parcial_y_total_de_compra(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']
        self.assertEqual(Decimal(compra.data['monto_compra']), Decimal('1000.00'))

        parcial = self.client.post(
            '/api/metodos-pago-compras/',
            {
                'compra': compra_id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '300.00',
            },
            format='json',
        )
        self.assertEqual(parcial.status_code, 201)
        self.assertEqual(Compra.objects.get(pk=compra_id).estado, 'PC')

        total = self.client.post(
            '/api/metodos-pago-compras/',
            {
                'compra': compra_id,
                'metodo_pago': self.tarjeta.id,
                'monto_pagado': '700.00',
            },
            format='json',
        )
        self.assertEqual(total.status_code, 201)
        self.assertEqual(Compra.objects.get(pk=compra_id).estado, 'PA')

    def test_pago_con_dos_metodos_deja_la_compra_parcial(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']

        self.autenticar(self.user_gerente)
        respuesta = self._pagar(
            compra_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '400.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '250.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'PC')
        self.assertEqual(len(respuesta.data['pagos']), 2)
        self.assertEqual(
            sum(
                Decimal(pago['monto_pagado'])
                for pago in respuesta.data['pagos']
            ),
            Decimal('650.00'),
        )

    def test_pago_con_dos_metodos_cubre_el_total(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']

        self.autenticar(self.user_gerente)
        respuesta = self._pagar(
            compra_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '600.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '400.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'PA')
        self.assertEqual(len(respuesta.data['pagos']), 2)

    def test_pago_no_guarda_nada_si_supera_el_saldo(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']

        self.autenticar(self.user_gerente)
        respuesta = self._pagar(
            compra_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '900.00'},
                {'metodo_pago': self.tarjeta.id, 'monto_pagado': '200.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('superan el saldo', respuesta.data['detail'])
        self.assertFalse(
            Compra.objects.get(pk=compra_id).pagos.exists()
        )
        self.assertEqual(Compra.objects.get(pk=compra_id).estado, 'PE')

    def test_pago_no_guarda_nada_con_metodo_inactivo(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']
        inactivo = MetodoPago.objects.create(
            metodo_pago='Inactivo',
            estado=False,
        )

        self.autenticar(self.user_gerente)
        respuesta = self._pagar(
            compra_id,
            [
                {'metodo_pago': self.efectivo.id, 'monto_pagado': '100.00'},
                {'metodo_pago': inactivo.id, 'monto_pagado': '100.00'},
            ],
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('inactivo', respuesta.data['detail'])
        self.assertFalse(
            Compra.objects.get(pk=compra_id).pagos.exists()
        )

    def test_no_permite_pagar_una_compra_anulada(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']
        Compra.objects.filter(pk=compra_id).update(estado='AN')

        self.autenticar(self.user_gerente)
        respuesta = self._pagar(
            compra_id,
            [{'metodo_pago': self.efectivo.id, 'monto_pagado': '100.00'}],
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('anulada', respuesta.data['detail'])

    def test_no_permite_pagar_una_compra_ya_pagada(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']
        self.autenticar(self.user_gerente)
        self._pagar(
            compra_id,
            [{'metodo_pago': self.efectivo.id, 'monto_pagado': '1000.00'}],
        )

        respuesta = self._pagar(
            compra_id,
            [{'metodo_pago': self.tarjeta.id, 'monto_pagado': '100.00'}],
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya está pagada', respuesta.data['detail'])
