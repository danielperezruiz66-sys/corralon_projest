from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from app.models import (
    Caja,
    MovimientoCaja,
    ProductoXSucursal,
    Stock,
    Sucursal,
    Venta,
)

from .base import BaseCorralonTestCase


class DashboardApiTests(BaseCorralonTestCase):
    def test_dashboard_devuelve_resumen(self):
        self.crear_venta()
        self.stock_poco.cant_min = Decimal('10.000')
        self.stock_poco.save(update_fields=['cant_min'])
        # El dashboard muestra las cajas del rol: el dueño de la sección.
        self.autenticar(self.user_cajero2)

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['ventas']['hoy']['cantidad'], 1)
        self.assertEqual(
            Decimal(respuesta.data['ventas']['hoy']['monto']),
            Decimal('200.00'),
        )
        self.assertEqual(respuesta.data['ventas']['semana']['cantidad'], 1)
        self.assertEqual(
            Decimal(respuesta.data['ventas']['semana']['monto']),
            Decimal('200.00'),
        )
        self.assertEqual(respuesta.data['ventas']['pendientes']['cantidad'], 1)
        self.assertEqual(respuesta.data['ventas']['parciales']['cantidad'], 0)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)
        self.assertEqual(respuesta.data['caja']['pausadas'], 0)
        self.assertEqual(respuesta.data['caja']['en_curso'], 1)
        self.assertEqual(respuesta.data['catalogo']['productos'], 2)
        self.assertEqual(respuesta.data['stock']['bajo'], 1)
        self.assertEqual(respuesta.data['stock']['critico'], 1)
        self.assertEqual(respuesta.data['alertas']['stock_critico'], 1)
        self.assertEqual(len(respuesta.data['ventas_por_dia']), 7)
        self.assertEqual(
            Decimal(respuesta.data['ventas']['ultimos_7_dias']['monto']),
            Decimal('200.00'),
        )
        self.assertEqual(respuesta.data['ventas_recientes'][0]['cliente'], 'Cliente Test')
        self.assertEqual(respuesta.data['stock_critico'][0]['alerta'], 'MINIMO')
        self.assertEqual(len(respuesta.data['cajas_abiertas']), 1)
        self.assertIsNone(respuesta.data['filtros']['sucursal'])

    def test_dashboard_no_marca_stock_cero_sin_minimo(self):
        self.stock.cantidad = Decimal('0.000')
        self.stock.save(update_fields=['cantidad'])

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['stock']['bajo'], 0)
        self.assertEqual(respuesta.data['stock']['critico'], 0)
        self.assertEqual(respuesta.data['stock_critico'], [])
        self.assertEqual(respuesta.data['alertas']['stock_bajo'], 0)
        self.assertEqual(respuesta.data['alertas']['stock_critico'], 0)

    def test_dashboard_separa_stock_negativo_de_bajo_minimo(self):
        self.stock_poco.cant_min = Decimal('10.000')
        self.stock_poco.save(update_fields=['cant_min'])
        self.stock.cantidad = Decimal('-1.000')
        self.stock.save(update_fields=['cantidad'])

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['stock']['negativo'], 1)
        self.assertEqual(respuesta.data['stock']['bajo'], 1)
        self.assertEqual(respuesta.data['stock']['critico'], 2)
        self.assertEqual(respuesta.data['alertas']['stock_negativo'], 1)
        self.assertEqual(respuesta.data['alertas']['stock_bajo'], 1)
        self.assertEqual(respuesta.data['alertas']['stock_critico'], 2)
        self.assertEqual(len(respuesta.data['stock_critico']), 2)

    def test_dashboard_incluye_compras_por_recibir(self):
        fecha_llegada = (timezone.localdate() + timedelta(days=7)).isoformat()
        self.crear_compra(
            user=self.user_gerente,
            estado_entrega='EC',
            fecha_estimada_llegada=fecha_llegada,
        )
        self.autenticar(self.user_deposito)

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertIs(respuesta.data['bloques']['compras'], True)
        self.assertEqual(respuesta.data['compras']['pendientes_recepcion'], 1)
        self.assertEqual(len(respuesta.data['compras_por_recibir']), 1)
        self.assertEqual(
            respuesta.data['compras_por_recibir'][0]['proveedor'],
            'Proveedor SA',
        )
        self.assertEqual(
            respuesta.data['compras_por_recibir'][0]['estado_entrega'],
            'EC',
        )

    def test_dashboard_separa_ventas_por_vencer_y_vencidas(self):
        por_vencer = self.crear_venta().data['id']
        vencida = self.crear_venta().data['id']
        Venta.objects.filter(pk=por_vencer).update(
            fecha_venta=timezone.now() - timedelta(minutes=25)
        )
        Venta.objects.filter(pk=vencida).update(
            fecha_venta=timezone.now() - timedelta(minutes=35)
        )

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['alertas']['ventas_por_vencer'], 1)
        self.assertEqual(respuesta.data['alertas']['ventas_vencidas'], 1)
        self.assertEqual(len(respuesta.data['ventas_por_vencer']), 1)
        self.assertEqual(
            respuesta.data['ventas_por_vencer'][0]['id'],
            por_vencer,
        )

    def test_dashboard_no_avisa_ventas_por_vencer_con_pagos(self):
        venta_id = self.crear_venta().data['id']
        Venta.objects.filter(pk=venta_id).update(
            fecha_venta=timezone.now() - timedelta(minutes=25)
        )
        self.client.post(
            '/api/metodos-pago-ventas/',
            {
                'venta': venta_id,
                'metodo_pago': self.efectivo.id,
                'monto_pagado': '50.00',
            },
            format='json',
        )

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['alertas']['ventas_por_vencer'], 0)
        self.assertEqual(respuesta.data['alertas']['ventas_vencidas'], 0)
        self.assertEqual(respuesta.data['ventas_por_vencer'], [])
        self.assertEqual(respuesta.data['ventas']['pendientes']['cantidad'], 0)
        self.assertEqual(respuesta.data['ventas']['parciales']['cantidad'], 1)
        self.assertEqual(
            Decimal(
                respuesta.data['ventas']['parciales']['saldo_pendiente']
            ),
            Decimal('150.00'),
        )

    def test_dashboard_compara_semana_con_misma_porcion(self):
        self.crear_venta()
        self.crear_venta()
        anterior = self.crear_venta().data['id']
        Venta.objects.filter(pk=anterior).update(
            fecha_venta=timezone.now() - timedelta(days=7)
        )

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(
            Decimal(respuesta.data['ventas']['semana']['monto']),
            Decimal('400.00'),
        )
        self.assertEqual(
            Decimal(
                respuesta.data['ventas']['semana']['comparacion'][
                    'monto_anterior'
                ]
            ),
            Decimal('200.00'),
        )
        self.assertEqual(
            respuesta.data['ventas']['semana']['comparacion'][
                'variacion_porcentaje'
            ],
            100.0,
        )

    def test_dashboard_ultimos_7_dias_compara_contra_los_7_previos(self):
        self.crear_venta()
        self.crear_venta()
        seis = self.crear_venta().data['id']
        siete = self.crear_venta().data['id']
        Venta.objects.filter(pk=seis).update(
            fecha_venta=timezone.now() - timedelta(days=6)
        )
        Venta.objects.filter(pk=siete).update(
            fecha_venta=timezone.now() - timedelta(days=7)
        )

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(
            Decimal(respuesta.data['ventas']['ultimos_7_dias']['monto']),
            Decimal('600.00'),
        )
        self.assertEqual(
            Decimal(
                respuesta.data['ventas']['ultimos_7_dias']['comparacion'][
                    'monto_anterior'
                ]
            ),
            Decimal('200.00'),
        )
        self.assertEqual(
            respuesta.data['ventas']['ultimos_7_dias']['comparacion'][
                'variacion_porcentaje'
            ],
            200.0,
        )

    def test_dashboard_cajas_separa_abiertas_y_pausadas(self):
        otra_caja = Caja.objects.create(
            sucursal=self.sucursal,
            numero_caja=2,
        )
        MovimientoCaja.objects.create(
            caja=otra_caja,
            empleado=self.emp_vendedor,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('500.00'),
            estado=MovimientoCaja.EstadoMovimiento.PAUSADA,
        )
        self.autenticar(self.admin)

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)
        self.assertEqual(respuesta.data['caja']['pausadas'], 1)
        self.assertEqual(respuesta.data['caja']['en_curso'], 2)
        self.assertEqual(len(respuesta.data['cajas_abiertas']), 2)
        self.assertEqual(respuesta.data['alertas']['cajas_abiertas'], 1)
        self.assertEqual(respuesta.data['alertas']['cajas_pausadas'], 1)
        self.assertEqual(respuesta.data['alertas']['cajas_en_curso'], 2)

    def test_dashboard_catalogo_por_sucursal(self):
        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )
        ProductoXSucursal.objects.create(
            producto=self.producto,
            sucursal=self.sucursal,
            estado=True,
        )
        ProductoXSucursal.objects.create(
            producto=self.producto_poco_stock,
            sucursal=otra,
            estado=True,
        )
        self.autenticar(self.admin)

        respuesta = self.client.get(
            '/api/dashboard/',
            {'sucursal': self.sucursal.id},
        )
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['catalogo']['productos'], 1)

        respuesta = self.client.get(
            '/api/dashboard/',
            {'sucursal': otra.id},
        )
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['catalogo']['productos'], 1)

    def test_dashboard_filtra_por_sucursal(self):
        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )
        self.autenticar(self.admin)

        respuesta = self.client.get('/api/dashboard/', {'sucursal': self.sucursal.id})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)

        respuesta = self.client.get('/api/dashboard/', {'sucursal': otra.id})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 0)
        self.assertEqual(respuesta.data['ventas']['hoy']['cantidad'], 0)

    def test_dashboard_bloques_por_rol(self):
        casos = [
            (
                self.admin,
                'gestion',
                {
                    'ventas': True,
                    'alertas_ventas': True,
                    'compras': True,
                    'caja': True,
                    'equipo': True,
                    'stock': True,
                    'actividad': True,
                },
            ),
            (
                self.user_gerente,
                'gestion',
                {
                    'ventas': True,
                    'alertas_ventas': True,
                    'compras': True,
                    'caja': True,
                    'equipo': True,
                    'stock': True,
                    'actividad': True,
                },
            ),
            (
                self.user_cajero,
                'caja',
                {
                    'ventas': True,
                    'alertas_ventas': True,
                    'compras': True,
                    'caja': True,
                    'equipo': False,
                    'stock': True,
                    'actividad': False,
                },
            ),
            (
                self.user_vendedor,
                'ventas',
                {
                    'ventas': True,
                    'alertas_ventas': False,
                    'compras': True,
                    'caja': False,
                    'equipo': False,
                    'stock': True,
                    'actividad': False,
                },
            ),
            (
                self.user_deposito,
                'deposito',
                {
                    'ventas': False,
                    'alertas_ventas': False,
                    'compras': True,
                    'caja': False,
                    'equipo': False,
                    'stock': True,
                    'actividad': False,
                },
            ),
            (
                self.user_sin_rol,
                'lectura',
                {
                    'ventas': False,
                    'alertas_ventas': False,
                    'compras': False,
                    'caja': False,
                    'equipo': False,
                    'stock': False,
                    'actividad': False,
                },
            ),
        ]

        for user, vista, esperado in casos:
            with self.subTest(vista=vista):
                self.autenticar(user)
                respuesta = self.client.get('/api/dashboard/')

                self.assertEqual(respuesta.status_code, 200)
                self.assertEqual(respuesta.data['vista'], vista)
                for bloque, valor in esperado.items():
                    self.assertIs(respuesta.data['bloques'][bloque], valor)

    def test_dashboard_rechaza_sucursal_ajena(self):
        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )
        self.autenticar(self.user_cajero)

        respuesta = self.client.get('/api/dashboard/', {'sucursal': otra.id})

        self.assertEqual(respuesta.status_code, 403)

    def test_dashboard_sin_sucursal_limita_a_las_asignadas(self):
        otra = Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Norte',
        )
        # Una sección del cajero en su sucursal...
        caja_salta = Caja.objects.create(
            sucursal=self.sucursal,
            numero_caja=2,
        )
        MovimientoCaja.objects.create(
            caja=caja_salta,
            empleado=self.emp_cajero,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('500.00'),
        )
        # ...y una de otro empleado en una sucursal que no le corresponde.
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

        self.autenticar(self.user_cajero)
        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 1)
        self.assertEqual(
            {item['id'] for item in respuesta.data['filtros']['sucursales']},
            {self.sucursal.id},
        )

        self.autenticar(self.admin)
        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['caja']['abiertas'], 3)
        self.assertEqual(
            {item['id'] for item in respuesta.data['filtros']['sucursales']},
            {self.sucursal.id, otra.id},
        )

    def test_dashboard_rechaza_sucursal_inexistente(self):
        respuesta = self.client.get('/api/dashboard/', {'sucursal': 999999})

        self.assertEqual(respuesta.status_code, 400)

    def test_dashboard_periodo_mes(self):
        respuesta = self.client.get('/api/dashboard/', {'periodo': 'mes'})

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['filtros']['periodo'], 'mes')
        self.assertEqual(len(respuesta.data['ventas_por_dia']), timezone.localdate().day)
        self.assertEqual(respuesta.data['serie_etiqueta'], 'Mes actual')

    def test_dashboard_exige_autenticacion(self):
        self.client.force_authenticate(user=None)

        respuesta = self.client.get('/api/dashboard/')

        self.assertEqual(respuesta.status_code, 401)
