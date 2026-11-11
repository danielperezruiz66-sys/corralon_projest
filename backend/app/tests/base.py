"""Datos compartidos por los tests de la API."""

from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from app.models import (
    Caja,
    Categoria,
    Cliente,
    Deposito,
    DetalleStock,
    Empleado,
    EmpleadoXRol,
    Empresa,
    Localidad,
    Marca,
    MetodoPago,
    Pais,
    Producto,
    ProductoXProveedor,
    Provincia,
    Proveedor,
    Rol,
    SeccionCaja,
    Stock,
    Sucursal,
    Ubicacion,
    Unidad,
    Usuario,
)

ROLES = [
    ('AD', 'Admin'),
    ('GE', 'Gerente'),
    ('CA', 'Cajero'),
    ('VE', 'Vendedor'),
    ('ED', 'Encargado de deposito'),
]


class BaseCorralonTestCase(APITestCase):
    PASSWORD = 'test1234'

    @classmethod
    def setUpTestData(cls):
        cls.pais = Pais.objects.create(nombre='Argentina')
        cls.provincia = Provincia.objects.create(pais=cls.pais, nombre='Santa Fe')
        cls.localidad = Localidad.objects.create(
            provincia=cls.provincia,
            nombre='Rosario',
            codigo_postal='2000',
        )
        cls.ubicacion = Ubicacion.objects.create(
            localidad=cls.localidad,
            calle='San Martin',
            nro_calle=100,
        )
        cls.empresa = Empresa.objects.create(
            cuit='30111111111',
            nombre='Corralon',
            razon_social='Corralon SA',
        )
        cls.sucursal = Sucursal.objects.create(
            empresa=cls.empresa,
            ubicacion=cls.ubicacion,
            nombre='Central',
        )
        cls.caja = Caja.objects.create(sucursal=cls.sucursal)
        cls.deposito = Deposito.objects.create(
            sucursal=cls.sucursal,
            nombre='Deposito central',
            es_predeterminado=True,
        )

        cls.roles = {
            codigo: Rol.objects.get_or_create(
                codigo=codigo,
                defaults={'ocupacion': nombre},
            )[0]
            for codigo, nombre in ROLES
        }

        cls.admin = Usuario.objects.create_superuser(
            username='admin',
            email='admin@corralon.com',
            password=cls.PASSWORD,
        )
        cls.user_gerente, cls.emp_gerente = cls._crear_usuario(
            'gerente', '0001', 'GE'
        )
        cls.user_cajero, cls.emp_cajero = cls._crear_usuario('cajero', '0002', 'CA')
        cls.user_vendedor, cls.emp_vendedor = cls._crear_usuario(
            'vendedor', '0003', 'VE'
        )
        cls.user_deposito, cls.emp_deposito = cls._crear_usuario(
            'deposito', '0004', 'ED'
        )
        cls.user_sin_rol, cls.emp_sin_rol = cls._crear_usuario('sinrol', '0005', None)

        cls.categoria = Categoria.objects.create(categorias='Materiales')
        cls.marca = Marca.objects.create(marcas='Generica')
        cls.unidad = Unidad.objects.create(unidades='Unidad')
        cls.producto = Producto.objects.create(
            codigo='P001',
            categoria=cls.categoria,
            marca=cls.marca,
            unidad=cls.unidad,
            nombre='Cemento 50kg',
            precio_unidad=Decimal('100.00'),
        )
        cls.producto_poco_stock = Producto.objects.create(
            codigo='P002',
            categoria=cls.categoria,
            marca=cls.marca,
            unidad=cls.unidad,
            nombre='Cal 25kg',
            precio_unidad=Decimal('50.00'),
        )

        cls.stock = Stock.objects.create(
            producto=cls.producto,
            sucursal=cls.sucursal,
            cantidad=Decimal('100.000'),
            cant_negativa_max=Decimal('-10.000'),
        )
        DetalleStock.objects.create(
            stock=cls.stock,
            deposito=cls.deposito,
            cantidad=Decimal('100.000'),
        )
        cls.stock_poco = Stock.objects.create(
            producto=cls.producto_poco_stock,
            sucursal=cls.sucursal,
            cantidad=Decimal('5.000'),
            cant_negativa_max=Decimal('-10.000'),
        )
        DetalleStock.objects.create(
            stock=cls.stock_poco,
            deposito=cls.deposito,
            cantidad=Decimal('5.000'),
        )

        cls.cliente = Cliente.objects.create(razon_social='Cliente Test')
        cls.proveedor = Proveedor.objects.create(
            cuit='30711111111',
            nombre='Proveedor',
            razon_social='Proveedor SA',
        )
        cls.efectivo = MetodoPago.objects.create(
            metodo_pago='Efectivo',
            es_efectivo=True,
        )
        cls.tarjeta = MetodoPago.objects.create(metodo_pago='Tarjeta')

        cls.seccion = SeccionCaja.objects.create(
            caja=cls.caja,
            empleado=cls.emp_cajero,
            fecha_hora_apertura=timezone.now(),
            monto_inicial=Decimal('1000.00'),
        )

    @classmethod
    def _crear_usuario(cls, username, legajo, codigo):
        user = Usuario.objects.create_user(
            username=username,
            password=cls.PASSWORD,
        )
        empleado = Empleado.objects.create(
            usuario=user,
            dni=f'30{legajo}',
            legajo=legajo,
            nombre=username.capitalize(),
            apellido='Test',
        )
        if codigo is not None:
            EmpleadoXRol.objects.create(
                empleado=empleado,
                rol=cls.roles[codigo],
                estado='AC',
            )
        return user, empleado

    def autenticar(self, user=None):
        self.client.force_authenticate(user or self.user_cajero)
        return self.client

    def setUp(self):
        super().setUp()
        # La mayoria de los tests opera como cajero; el que necesite otro rol
        # llama a `autenticar()`.
        self.autenticar(self.user_cajero)

    def payload_venta(self, producto=None, cantidad='2.000', **extra):
        payload = {
            'seccion_caja': self.seccion.id,
            'cliente': self.cliente.id,
            'items': [
                {
                    'producto': (producto or self.producto).id,
                    'cantidad': cantidad,
                }
            ],
        }
        payload.update(extra)
        return payload

    def crear_venta(self, user=None, **extra):
        self.autenticar(user or self.user_cajero)
        return self.client.post(
            '/api/ventas/',
            self.payload_venta(**extra),
            format='json',
        )

    def crear_compra(
        self,
        user=None,
        cantidad='10.000',
        precio='100.00',
        producto=None,
        proveedor=None,
        **extra,
    ):
        producto = producto or self.producto
        proveedor = proveedor or self.proveedor
        ProductoXProveedor.objects.get_or_create(
            producto=producto,
            proveedor=proveedor,
            defaults={'precio_lista': Decimal('80.00')},
        )
        self.autenticar(user or self.user_deposito)
        payload = {
            'seccion_caja': self.seccion.id,
            'proveedor': proveedor.id,
            'items': [
                {
                    'producto': producto.id,
                    'cantidad': cantidad,
                    'precio': precio,
                }
            ],
        }
        payload.update(extra)
        return self.client.post(
            '/api/compras/',
            payload,
            format='json',
        )
