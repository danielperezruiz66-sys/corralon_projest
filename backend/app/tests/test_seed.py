"""El seed tiene que dejar un libro de stock coherente.

Los tests crean la base vacia y corren el comando completo, para verificar que
las ventas descuenten stock con sus consumos registrados y que el stock
siga cuadrando con la suma de sus detalles.
"""

from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app.models import (
    Caja,
    Compra,
    DetalleCompra,
    DetalleStock,
    DetalleVenta,
    Empleado,
    EmpleadoXRol,
    Producto,
    ProductoXProveedor,
    Stock,
    Sucursal,
    Venta,
)
from app.services.ventas import cancelar_venta


class SeedStockTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command(
            'seed_data',
            '--ventas', '50',
            '--compras', '20',
            verbosity=0,
            stdout=StringIO(),
        )

    def test_cada_venta_registra_los_lotes_consumidos(self):
        for venta in Venta.objects.prefetch_related('detalles'):
            for detalle in venta.detalles.all():
                self.assertTrue(
                    detalle.consumos,
                    f'La venta {venta.pk} no registro los lotes consumidos.',
                )

    def test_cada_compra_tiene_deposito(self):
        for compra in Compra.objects.all():
            self.assertIsNotNone(
                compra.deposito_id,
                f'La compra {compra.pk} no tiene deposito.',
            )

    def test_stock_coincide_con_la_suma_de_sus_detalles(self):
        for stock in Stock.objects.prefetch_related('detalles'):
            total = sum(
                (detalle.cantidad for detalle in stock.detalles.all()),
                Decimal('0.000'),
            )
            self.assertEqual(
                stock.cantidad,
                total,
                f'El stock {stock.pk} no coincide con sus detalles.',
            )

    def test_toda_venta_tiene_al_menos_un_detalle(self):
        self.assertFalse(Venta.objects.filter(detalles__isnull=True).exists())

    def test_cancelar_venta_pendiente_restaura_stock(self):
        venta = Venta.objects.filter(
            estado=Venta.EstadoVenta.PENDIENTE,
            pagos__isnull=True,
        ).first()
        self.assertIsNotNone(venta, 'El seed no genero ventas pendientes sin pagos.')

        detalle = venta.detalles.first()
        stock = Stock.objects.get(
            producto=detalle.producto,
            sucursal=venta.movimiento_caja.caja.sucursal,
        )
        cantidad_antes = stock.cantidad

        cancelar_venta(venta, motivo='prueba del seed')

        venta.refresh_from_db()
        stock.refresh_from_db()
        self.assertEqual(venta.estado, Venta.EstadoVenta.ANULADA)
        self.assertEqual(
            stock.cantidad,
            cantidad_antes + detalle.cantidad_venta,
        )


    def test_no_genera_detalles_negativos(self):
        self.assertFalse(DetalleStock.objects.filter(cantidad__lt=0).exists())

    def test_dos_sucursales_en_salta(self):
        sucursales = list(
            Sucursal.objects.select_related(
                'ubicacion__localidad__provincia'
            )
        )

        self.assertEqual(len(sucursales), 2)
        self.assertEqual(
            {sucursal.nombre for sucursal in sucursales},
            {'Salta Capital', 'Campo Quijano'},
        )
        for sucursal in sucursales:
            self.assertEqual(
                sucursal.ubicacion.localidad.provincia.nombre,
                'Salta',
            )
            self.assertEqual(
                sucursal.ubicacion.localidad.nombre,
                sucursal.nombre,
            )

    def test_cada_sucursal_tiene_dos_depositos_y_dos_cajas(self):
        for sucursal in Sucursal.objects.all():
            self.assertEqual(sucursal.depositos.count(), 2)
            self.assertEqual(
                sucursal.depositos.filter(es_predeterminado=True).count(),
                1,
            )
            self.assertEqual(sucursal.cajas.count(), 2)
            self.assertEqual(
                set(sucursal.cajas.values_list('numero_caja', flat=True)),
                {1, 2},
            )
        self.assertEqual(Caja.objects.count(), 4)

    def test_cada_sucursal_tiene_empleados_con_roles(self):
        for sucursal in Sucursal.objects.all():
            empleados = Empleado.objects.filter(
                sucursales_asignadas__sucursal=sucursal,
                sucursales_asignadas__estado=True,
            ).distinct()

            codigos = set(
                EmpleadoXRol.objects.filter(
                    empleado__in=empleados,
                    estado='AC',
                ).values_list('rol__codigo', flat=True)
            )
            self.assertTrue({'AD', 'CA', 'VE', 'ED'}.issubset(codigos))

        # Salta Capital suma un gerente de prueba.
        self.assertEqual(Empleado.objects.count(), 9)
        gerente = Empleado.objects.get(legajo='0009')
        self.assertEqual(
            set(
                gerente.roles_asignados.filter(estado='AC').values_list(
                    'rol__codigo',
                    flat=True,
                )
            ),
            {'GE'},
        )

    def test_productos_tienen_catalogo_costo_y_stock(self):
        self.assertEqual(Producto.objects.count(), 30)
        self.assertEqual(Stock.objects.count(), 60)

        for producto in Producto.objects.select_related(
            'categoria',
            'marca',
            'unidad',
        ):
            self.assertIsNotNone(producto.categoria_id)
            self.assertIsNotNone(producto.marca_id)
            self.assertIsNotNone(producto.unidad_id)
            self.assertGreater(producto.precio_unidad, 0)

            costos = ProductoXProveedor.objects.filter(
                producto=producto,
                estado=True,
            )
            self.assertTrue(
                costos.exists(),
                f'El producto {producto.codigo} no tiene costo de proveedor.',
            )
            for costo in costos:
                self.assertGreater(costo.precio_lista, 0)
                self.assertLess(costo.precio_lista, producto.precio_unidad)

        for stock in Stock.objects.prefetch_related('detalles__deposito'):
            self.assertTrue(stock.detalles.exists())
            self.assertEqual(
                stock.detalles.values('deposito').distinct().count(),
                2,
            )
            for detalle in stock.detalles.all():
                self.assertGreaterEqual(detalle.cantidad, 0)
                self.assertEqual(
                    detalle.deposito.sucursal_id,
                    stock.sucursal_id,
                )

    def test_historial_cubre_seis_meses_y_ambas_sucursales(self):
        ahora = timezone.now()

        for modelo, campo in (
            (Venta, 'fecha_venta'),
            (Compra, 'fecha_compra'),
        ):
            self.assertTrue(modelo.objects.exists())
            mas_vieja = modelo.objects.order_by(campo).first()
            self.assertGreaterEqual(
                (ahora - getattr(mas_vieja, campo)).days,
                150,
            )

        for sucursal in Sucursal.objects.all():
            self.assertTrue(
                Venta.objects.filter(
                    movimiento_caja__caja__sucursal=sucursal,
                ).exists()
            )
            self.assertTrue(
                Compra.objects.filter(
                    movimiento_caja__caja__sucursal=sucursal,
                ).exists()
            )

    def test_precios_de_venta_y_compra_coinciden_con_el_catalogo(self):
        costos = {
            asociacion.producto_id: asociacion.precio_lista
            for asociacion in ProductoXProveedor.objects.filter(estado=True)
        }

        for detalle in DetalleVenta.objects.select_related('producto'):
            self.assertEqual(
                detalle.precio_venta,
                detalle.producto.precio_unidad,
            )
            self.assertEqual(
                detalle.subtotal,
                (detalle.cantidad_venta * detalle.precio_venta).quantize(
                    Decimal('0.01')
                ),
            )

        for detalle in DetalleCompra.objects.all():
            self.assertEqual(detalle.precio_compra, costos[detalle.producto_id])
            self.assertEqual(
                detalle.subtotal,
                (detalle.cantidad_compra * detalle.precio_compra).quantize(
                    Decimal('0.01')
                ),
            )
