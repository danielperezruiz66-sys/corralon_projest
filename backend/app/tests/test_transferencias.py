from decimal import Decimal

from app.models import (
    Deposito,
    DetalleStock,
    Stock,
    Sucursal,
    TransferenciaStock,
)

from .base import BaseCorralonTestCase


class TransferenciaStockTests(BaseCorralonTestCase):
    def _deposito_secundario(self):
        return Deposito.objects.create(
            sucursal=self.sucursal,
            nombre='Deposito Anexo',
            es_predeterminado=False,
        )

    def _sucursal_secundaria(self):
        return Sucursal.objects.create(
            empresa=self.empresa,
            ubicacion=self.ubicacion,
            nombre='Sucursal Secundaria',
        )

    def test_transferencia_en_transito_y_recepcion(self):
        anexo = self._deposito_secundario()
        self.autenticar(self.user_deposito)

        creada = self.client.post(
            '/api/transferencias-stock/',
            {
                'producto': self.producto.id,
                'deposito_origen': self.deposito.id,
                'deposito_destino': anexo.id,
                'cantidad': '30.000',
                'motivo': 'Reposicion interna',
            },
            format='json',
        )

        self.assertEqual(creada.status_code, 201)
        self.assertEqual(creada.data['estado'], 'ET')
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('70.000'))
        self.assertFalse(
            DetalleStock.objects.filter(
                stock=self.stock,
                deposito=anexo,
            ).exists()
        )

        recibida = self.client.post(
            f'/api/transferencias-stock/{creada.data["id"]}/recibir/',
        )

        self.assertEqual(recibida.status_code, 200)
        self.assertEqual(recibida.data['estado'], 'RE')
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))
        self.assertTrue(
            DetalleStock.objects.filter(
                stock=self.stock,
                deposito=anexo,
                cantidad=Decimal('30.000'),
            ).exists()
        )

    def test_transferencia_entre_sucursales(self):
        sucursal_destino = self._sucursal_secundaria()
        deposito_destino = Deposito.objects.create(
            sucursal=sucursal_destino,
            nombre='Deposito Destino',
            es_predeterminado=True,
        )
        self.autenticar(self.user_deposito)

        creada = self.client.post(
            '/api/transferencias-stock/',
            {
                'producto': self.producto.id,
                'deposito_origen': self.deposito.id,
                'deposito_destino': deposito_destino.id,
                'cantidad': '20.000',
            },
            format='json',
        )
        self.assertEqual(creada.status_code, 201)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('80.000'))

        recibida = self.client.post(
            f'/api/transferencias-stock/{creada.data["id"]}/recibir/',
        )
        self.assertEqual(recibida.status_code, 200)

        stock_destino = Stock.objects.get(
            producto=self.producto,
            sucursal=sucursal_destino,
        )
        self.assertEqual(stock_destino.cantidad, Decimal('20.000'))

    def test_cancelar_transferencia_restaura_origen(self):
        anexo = self._deposito_secundario()
        self.autenticar(self.user_deposito)
        creada = self.client.post(
            '/api/transferencias-stock/',
            {
                'producto': self.producto.id,
                'deposito_origen': self.deposito.id,
                'deposito_destino': anexo.id,
                'cantidad': '15.000',
            },
            format='json',
        )

        cancelada = self.client.post(
            f'/api/transferencias-stock/{creada.data["id"]}/cancelar/',
        )

        self.assertEqual(cancelada.status_code, 200)
        self.assertEqual(cancelada.data['estado'], 'CA')
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.000'))
        self.assertEqual(
            TransferenciaStock.objects.get(pk=creada.data['id']).estado,
            'CA',
        )

    def test_transferencia_sin_stock_suficiente(self):
        anexo = self._deposito_secundario()
        self.autenticar(self.user_deposito)

        respuesta = self.client.post(
            '/api/transferencias-stock/',
            {
                'producto': self.producto.id,
                'deposito_origen': self.deposito.id,
                'deposito_destino': anexo.id,
                'cantidad': '200.000',
            },
            format='json',
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('suficiente', respuesta.data['detail'])
