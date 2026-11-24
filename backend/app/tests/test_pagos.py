from decimal import Decimal

from django.utils import timezone

from app.models import (
    Caja,
    Compra,
    MetodoPago,
    MetodoPagoXCompra,
    MetodoPagoXVenta,
    MovimientoCaja,
    Venta,
)
from app.services import caja as caja_service

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

    def test_cobro_con_dos_metodos_confirma_al_cubrir_el_total(self):
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
        # Pagada y confirmada son el mismo estado.
        self.assertEqual(respuesta.data['estado'], 'CO')
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
        self.assertEqual(respuesta.data['estado'], 'PC')
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
        # Un pago parcial deja la venta en Parcial.
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PC')

        no_confirma = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(no_confirma.status_code, 400)
        self.assertIn('totalmente paga', no_confirma.data['detail'])

        total = self._pagar(venta_id, '60.00')
        self.assertEqual(total.status_code, 201)
        # Al cubrir el total queda confirmada automaticamente.
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'CO')

        confirmada = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(confirmada.status_code, 200)
        self.assertEqual(confirmada.data['estado'], 'CO')

    def test_pago_total_y_confirmacion(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self.assertEqual(Decimal(venta.data['monto_venta']), Decimal('100.00'))

        total = self._pagar(venta_id, '100.00')
        self.assertEqual(total.status_code, 201)
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'CO')

        confirmada = self.client.post(f'/api/ventas/{venta_id}/confirmar/')
        self.assertEqual(confirmada.status_code, 200)
        self.assertEqual(confirmada.data['estado'], 'CO')

    def test_no_permite_anular_venta_parcial(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self._pagar(venta_id, '40.00')

        respuesta = self.client.post(
            f'/api/ventas/{venta_id}/cancelar/',
            {'motivo': 'prueba'},
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('pendiente sin pagos', respuesta.data['detail'])
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, 'PC')

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
        # Pagar compras es de administracion (AD/GE).
        self.autenticar(self.user_gerente)

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


class PagoDespuesDelCierreTests(BaseCorralonTestCase):
    """Un saldo parcial se cobra/paga en la caja abierta actual.

    Antes el pago quedaba atado a la caja original del documento: si esa caja
    ya se habia cerrado, el arqueo recibia la plata en una caja cerrada.
    """

    def _cerrar_movimiento(self, movimiento):
        movimiento.estado = MovimientoCaja.EstadoMovimiento.CERRADA
        movimiento.save(update_fields=['estado'])

    def _abrir_movimiento(self, empleado, monto='500.00'):
        return MovimientoCaja.objects.create(
            caja=self.caja,
            empleado=empleado,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal(monto),
        )

    def _teorico(self, movimiento, metodo):
        filas = caja_service.calcular_teorico(movimiento)
        return next(
            (
                fila['monto_sistema']
                for fila in filas
                if fila['metodo_pago'].id == metodo.id
            ),
            Decimal('0.00'),
        )

    def test_venta_parcial_se_cobra_en_la_caja_abierta_actual(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self.autenticar(self.user_cajero)
        self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
            {
                'pagos': [
                    {'metodo_pago': self.efectivo.id, 'monto_pagado': '40.00'}
                ]
            },
            format='json',
        )
        self._cerrar_movimiento(self.seccion)
        nueva = self._abrir_movimiento(self.emp_cajero)

        respuesta = self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
            {
                'pagos': [
                    {'metodo_pago': self.efectivo.id, 'monto_pagado': '60.00'}
                ]
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['estado'], 'CO')
        ultimo = MetodoPagoXVenta.objects.filter(venta_id=venta_id).order_by('-id').first()
        self.assertEqual(ultimo.movimiento_caja_id, nueva.id)
        self.assertEqual(self._teorico(nueva, self.efectivo), Decimal('560.00'))
        self.assertEqual(
            self._teorico(self.seccion, self.efectivo),
            Decimal('1040.00'),
        )

    def test_compra_parcial_se_paga_en_la_caja_abierta_actual(self):
        compra = self.crear_compra(cantidad='10.000')
        compra_id = compra.data['id']
        self.autenticar(self.user_gerente)
        self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            {
                'pagos': [
                    {'metodo_pago': self.efectivo.id, 'monto_pagado': '300.00'}
                ]
            },
            format='json',
        )
        self._cerrar_movimiento(self.seccion)
        nueva = self._abrir_movimiento(self.emp_gerente)

        respuesta = self.client.post(
            f'/api/compras/{compra_id}/pagar/',
            {
                'pagos': [
                    {'metodo_pago': self.efectivo.id, 'monto_pagado': '700.00'}
                ]
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 200)
        ultimo = MetodoPagoXCompra.objects.filter(compra_id=compra_id).order_by('-id').first()
        self.assertEqual(ultimo.movimiento_caja_id, nueva.id)
        # La compra resta del teorico: inicial 500 - 700 pagados.
        self.assertEqual(self._teorico(nueva, self.efectivo), Decimal('-200.00'))
        # La caja vieja conserva solo los 300 pagados antes del cierre.
        self.assertEqual(self._teorico(self.seccion, self.efectivo), Decimal('700.00'))

    def test_sin_caja_abierta_no_se_cobra(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self._cerrar_movimiento(self.seccion)

        self.autenticar(self.user_cajero)
        respuesta = self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
            {
                'pagos': [
                    {'metodo_pago': self.efectivo.id, 'monto_pagado': '100.00'}
                ]
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('caja abierta', str(respuesta.data['movimiento_caja']))

    def test_se_puede_indicar_otra_caja_de_la_misma_sucursal(self):
        venta = self.crear_venta(cantidad='1.000')
        venta_id = venta.data['id']
        self._cerrar_movimiento(self.seccion)
        otra_caja = Caja.objects.create(sucursal=self.sucursal, numero_caja=2)
        otra = MovimientoCaja.objects.create(
            caja=otra_caja,
            empleado=self.emp_cajero2,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('200.00'),
        )

        self.autenticar(self.user_cajero)
        respuesta = self.client.post(
            f'/api/ventas/{venta_id}/cobrar/',
            {
                'movimiento_caja': otra.id,
                'pagos': [
                    {'metodo_pago': self.efectivo.id, 'monto_pagado': '100.00'}
                ],
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 200)
        ultimo = MetodoPagoXVenta.objects.filter(venta_id=venta_id).order_by('-id').first()
        self.assertEqual(ultimo.movimiento_caja_id, otra.id)

    def test_pago_historico_sin_movimiento_sigue_en_la_caja_del_documento(self):
        venta = Venta.objects.create(
            movimiento_caja=self.seccion,
            cliente=self.cliente,
            estado=Venta.EstadoVenta.PARCIAL,
            monto_venta=Decimal('100.00'),
        )
        MetodoPagoXVenta.objects.create(
            venta=venta,
            metodo_pago=self.efectivo,
            monto_pagado=Decimal('25.00'),
        )

        self.assertEqual(
            self._teorico(self.seccion, self.efectivo),
            Decimal('1025.00'),
        )
