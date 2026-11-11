"""El seed tiene que dejar un libro de stock coherente.

Los tests crean la base vacia y corren el comando completo, para verificar que
las ventas y las compras historicas generen sus `MovimientoStock` y que el
stock siga cuadrando con la suma de sus detalles.
"""

from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from app.models import (
    Compra,
    DetalleStock,
    MovimientoStock,
    Stock,
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

    def test_genera_movimientos_de_compra_y_venta(self):
        tipos = set(
            MovimientoStock.objects.values_list('tipo', flat=True).distinct()
        )

        self.assertEqual(
            tipos,
            {
                MovimientoStock.TipoMovimiento.COMPRA,
                MovimientoStock.TipoMovimiento.VENTA,
            },
        )

    def test_cada_venta_tiene_sus_movimientos(self):
        for venta in Venta.objects.prefetch_related('detalles'):
            movimientos = venta.movimientos_stock.filter(
                tipo=MovimientoStock.TipoMovimiento.VENTA
            )
            self.assertTrue(
                movimientos.exists(),
                f'La venta {venta.pk} no genero movimientos de stock.',
            )
            cantidad = sum(
                (detalle.cantidad_venta for detalle in venta.detalles.all()),
                Decimal('0.000'),
            )
            total_movido = sum(
                (movimiento.cantidad for movimiento in movimientos),
                Decimal('0.000'),
            )
            self.assertEqual(total_movido, -cantidad)

    def test_cada_compra_tiene_sus_movimientos(self):
        for compra in Compra.objects.prefetch_related('detalles'):
            movimientos = compra.movimientos_stock.filter(
                tipo=MovimientoStock.TipoMovimiento.COMPRA
            )
            self.assertTrue(
                movimientos.exists(),
                f'La compra {compra.pk} no genero movimientos de stock.',
            )
            cantidad = sum(
                (detalle.cantidad_compra for detalle in compra.detalles.all()),
                Decimal('0.000'),
            )
            total_movido = sum(
                (movimiento.cantidad for movimiento in movimientos),
                Decimal('0.000'),
            )
            self.assertEqual(total_movido, cantidad)

    def test_movimientos_quedan_con_la_fecha_del_documento(self):
        for venta in Venta.objects.all():
            for movimiento in venta.movimientos_stock.all():
                self.assertEqual(movimiento.fecha, venta.fecha_venta)

        for compra in Compra.objects.all():
            for movimiento in compra.movimientos_stock.all():
                self.assertEqual(movimiento.fecha, compra.fecha_recepcion)

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
            sucursal=venta.seccion_caja.caja.sucursal,
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
        self.assertTrue(
            MovimientoStock.objects.filter(
                venta=venta,
                tipo=MovimientoStock.TipoMovimiento.CANCELACION,
            ).exists()
        )

    def test_no_genera_detalles_negativos(self):
        self.assertFalse(DetalleStock.objects.filter(cantidad__lt=0).exists())
