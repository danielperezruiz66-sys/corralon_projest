import random
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from app.models import (
    Caja,
    Categoria,
    Cliente,
    Compra,
    Deposito,
    DetalleCierreCaja,
    DetalleCompra,
    DetalleStock,
    DetalleVenta,
    Empleado,
    EmpleadoXRol,
    Empresa,
    Factura,
    Localidad,
    Marca,
    MetodoPago,
    MetodoPagoXCompra,
    MetodoPagoXVenta,
    MovimientoStock,
    Pais,
    Producto,
    ProductoXProveedor,
    ProductoXSucursal,
    Proveedor,
    ProveedorXSucursal,
    Provincia,
    Rol,
    SeccionCaja,
    Stock,
    Sucursal,
    SucursalXEmpleado,
    TransferenciaStock,
    Ubicacion,
    Unidad,
    Venta,
)
from app.services import caja as caja_service
from app.services import stock as stock_service

Usuario = get_user_model()

PASSWORD_DEMO = 'test1234'
PASSWORD_ADMIN = 'admin1234'
DIAS_HISTORIAL = 180
DIAS_STOCK_INICIAL = DIAS_HISTORIAL + 30

METODOS_PAGO = [
    'Efectivo',
    'Debito',
    'Credito',
    'Transferencia',
    'QR',
]

CATEGORIAS = [
    'Cemento y Mampostería',
    'Hierros',
    'Áridos',
    'Sanitarios',
    'Pinturas',
    'Electricidad',
    'Herramientas',
    'Techos',
]

MARCAS = [
    'Acindar',
    'Loma Negra',
    'Weber',
    'Sika',
    'Klaukol',
    'Ferrum',
    'Tigre',
    'Ladrillera del Norte',
    'Áridos del Valle',
    'Schneider Electric',
    'Stanley',
    'Bosch',
    'Ternium',
    'Prysmian',
]

UNIDADES = ['bolsa', 'kg', 'm3', 'unidad', 'metro', 'litro', 'rollo']

SUCURSALES = [
    {
        'nombre': 'Salta Capital',
        'codigo': 'SLT',
        'localidad': 'Salta Capital',
        'codigo_postal': '4400',
        'calle': 'Av. Paraguay',
        'nro_calle': 1450,
        'latitud': Decimal('-24.782127'),
        'longitud': Decimal('-65.423198'),
        'hora_ap': '08:00:00',
        'hora_c': '18:00:00',
        'contacto': '3875551001',
        'email_suc': 'salta@fer-cons.com.ar',
        'es_central': True,
    },
    {
        'nombre': 'Campo Quijano',
        'codigo': 'CQJ',
        'localidad': 'Campo Quijano',
        'codigo_postal': '4407',
        'calle': 'Ruta Nacional 51',
        'nro_calle': 12,
        'latitud': Decimal('-24.916667'),
        'longitud': Decimal('-65.633333'),
        'hora_ap': '08:00:00',
        'hora_c': '17:00:00',
        'contacto': '3875551002',
        'email_suc': 'campoquijano@fer-cons.com.ar',
        'es_central': False,
    },
]

DEPOSITOS = {
    'Salta Capital': [
        ('Depósito Principal Salta', True),
        ('Depósito Anexo Salta', False),
    ],
    'Campo Quijano': [
        ('Depósito Principal Campo Quijano', True),
        ('Depósito Anexo Campo Quijano', False),
    ],
}

ROLES = [
    ('AD', 'Administrador', 'Acceso total al sistema'),
    ('GE', 'Gerente', 'Supervision general y gestion de catalogos'),
    ('CA', 'Cajero', 'Manejo de caja y cobros'),
    ('VE', 'Vendedor', 'Atencion al publico y carga de ventas'),
    ('ED', 'Encargado de deposito', 'Compras, recepcion y depositos'),
]

EMPLEADOS = [
    (
        '28456789',
        '0001',
        'Martín',
        'Salvatierra',
        'AD',
        'Salta Capital',
        'admin.salta',
    ),
    (
        '31567890',
        '0002',
        'Lucía',
        'González',
        'CA',
        'Salta Capital',
        'cajero.salta',
    ),
    (
        '33789012',
        '0003',
        'Nicolás',
        'Flores',
        'VE',
        'Salta Capital',
        'vendedor.salta',
    ),
    (
        '26901234',
        '0004',
        'Ramón',
        'Cruz',
        'ED',
        'Salta Capital',
        'deposito.salta',
    ),
    (
        '30123456',
        '0005',
        'Ana',
        'Alderete',
        'AD',
        'Campo Quijano',
        'admin.quijano',
    ),
    (
        '32456789',
        '0006',
        'José',
        'Vega',
        'CA',
        'Campo Quijano',
        'cajero.quijano',
    ),
    (
        '34678901',
        '0007',
        'Camila',
        'Rodríguez',
        'VE',
        'Campo Quijano',
        'vendedor.quijano',
    ),
    (
        '27890123',
        '0008',
        'Miguel Ángel',
        'Quispe',
        'ED',
        'Campo Quijano',
        'deposito.quijano',
    ),
]

PROVEEDORES = [
    ('Acindar', '30500026785', '3875552001'),
    ('Loma Negra', '30500010912', '3875552002'),
    ('Weber', '30712345671', '3875552003'),
    ('Sika', '30500012345', '3875552004'),
    ('Klaukol', '30765432109', '3875552005'),
    ('Ferrum', '30500098765', '3875552006'),
    ('Tigre', '30500054321', '3875552007'),
    ('Ladrillera del Norte', '30711223344', '3875552008'),
    ('Áridos del Valle', '30722334455', '3875552009'),
    ('Schneider Electric', '30733445566', '3875552010'),
    ('Stanley', '30744556677', '3875552011'),
    ('Bosch', '30755667788', '3875552012'),
    ('Ternium', '30766778899', '3875552013'),
    ('Prysmian', '30777889900', '3875552014'),
]

PRODUCTOS = [
    {
        'codigo': 'P0001',
        'nombre': 'Cemento Loma Negra 50 kg',
        'categoria': 'Cemento y Mampostería',
        'marca': 'Loma Negra',
        'unidad': 'bolsa',
        'precio_venta': '13500.00',
        'precio_costo': '10800.00',
        'stock': (300, 800),
        'venta': (5, 30),
        'perecedero': True,
    },
    {
        'codigo': 'P0002',
        'nombre': 'Cemento Avellaneda 50 kg',
        'categoria': 'Cemento y Mampostería',
        'marca': 'Loma Negra',
        'unidad': 'bolsa',
        'precio_venta': '12900.00',
        'precio_costo': '10300.00',
        'stock': (250, 700),
        'venta': (5, 30),
        'perecedero': True,
    },
    {
        'codigo': 'P0003',
        'nombre': 'Cal Hidratada 25 kg',
        'categoria': 'Cemento y Mampostería',
        'marca': 'Loma Negra',
        'unidad': 'bolsa',
        'precio_venta': '6800.00',
        'precio_costo': '5200.00',
        'stock': (120, 350),
        'venta': (3, 20),
        'perecedero': True,
    },
    {
        'codigo': 'P0004',
        'nombre': 'Ladrillo Hueco 12x18x33',
        'categoria': 'Cemento y Mampostería',
        'marca': 'Ladrillera del Norte',
        'unidad': 'unidad',
        'precio_venta': '1150.00',
        'precio_costo': '820.00',
        'stock': (3000, 9000),
        'venta': (100, 800),
        'perecedero': False,
    },
    {
        'codigo': 'P0005',
        'nombre': 'Ladrillo Común',
        'categoria': 'Cemento y Mampostería',
        'marca': 'Ladrillera del Norte',
        'unidad': 'unidad',
        'precio_venta': '520.00',
        'precio_costo': '360.00',
        'stock': (5000, 15000),
        'venta': (200, 1500),
        'perecedero': False,
    },
    {
        'codigo': 'P0006',
        'nombre': 'Hierro 8 mm x 12 m',
        'categoria': 'Hierros',
        'marca': 'Acindar',
        'unidad': 'unidad',
        'precio_venta': '18900.00',
        'precio_costo': '15100.00',
        'stock': (150, 400),
        'venta': (5, 25),
        'perecedero': False,
    },
    {
        'codigo': 'P0007',
        'nombre': 'Hierro 10 mm x 12 m',
        'categoria': 'Hierros',
        'marca': 'Acindar',
        'unidad': 'unidad',
        'precio_venta': '28500.00',
        'precio_costo': '22800.00',
        'stock': (120, 300),
        'venta': (5, 20),
        'perecedero': False,
    },
    {
        'codigo': 'P0008',
        'nombre': 'Hierro 12 mm x 12 m',
        'categoria': 'Hierros',
        'marca': 'Acindar',
        'unidad': 'unidad',
        'precio_venta': '41000.00',
        'precio_costo': '32800.00',
        'stock': (80, 220),
        'venta': (3, 15),
        'perecedero': False,
    },
    {
        'codigo': 'P0009',
        'nombre': 'Malla Sima 15x15',
        'categoria': 'Hierros',
        'marca': 'Acindar',
        'unidad': 'unidad',
        'precio_venta': '58000.00',
        'precio_costo': '46400.00',
        'stock': (40, 120),
        'venta': (2, 8),
        'perecedero': False,
    },
    {
        'codigo': 'P0010',
        'nombre': 'Arena Fina',
        'categoria': 'Áridos',
        'marca': 'Áridos del Valle',
        'unidad': 'm3',
        'precio_venta': '24000.00',
        'precio_costo': '18000.00',
        'stock': (40, 100),
        'venta': (2, 8),
        'perecedero': False,
    },
    {
        'codigo': 'P0011',
        'nombre': 'Arena Gruesa',
        'categoria': 'Áridos',
        'marca': 'Áridos del Valle',
        'unidad': 'm3',
        'precio_venta': '22500.00',
        'precio_costo': '16800.00',
        'stock': (40, 100),
        'venta': (2, 8),
        'perecedero': False,
    },
    {
        'codigo': 'P0012',
        'nombre': 'Piedra Partida 6/20',
        'categoria': 'Áridos',
        'marca': 'Áridos del Valle',
        'unidad': 'm3',
        'precio_venta': '29000.00',
        'precio_costo': '22000.00',
        'stock': (30, 80),
        'venta': (2, 7),
        'perecedero': False,
    },
    {
        'codigo': 'P0013',
        'nombre': 'Inodoro Largo',
        'categoria': 'Sanitarios',
        'marca': 'Ferrum',
        'unidad': 'unidad',
        'precio_venta': '145000.00',
        'precio_costo': '112000.00',
        'stock': (10, 30),
        'venta': (1, 3),
        'perecedero': False,
    },
    {
        'codigo': 'P0014',
        'nombre': 'Lavatorio',
        'categoria': 'Sanitarios',
        'marca': 'Ferrum',
        'unidad': 'unidad',
        'precio_venta': '92000.00',
        'precio_costo': '71000.00',
        'stock': (12, 35),
        'venta': (1, 3),
        'perecedero': False,
    },
    {
        'codigo': 'P0015',
        'nombre': 'Bacha de Cocina',
        'categoria': 'Sanitarios',
        'marca': 'Ferrum',
        'unidad': 'unidad',
        'precio_venta': '118000.00',
        'precio_costo': '91000.00',
        'stock': (10, 25),
        'venta': (1, 3),
        'perecedero': False,
    },
    {
        'codigo': 'P0016',
        'nombre': 'Pintura Látex Interior 20 L',
        'categoria': 'Pinturas',
        'marca': 'Tigre',
        'unidad': 'unidad',
        'precio_venta': '78000.00',
        'precio_costo': '58500.00',
        'stock': (40, 120),
        'venta': (2, 8),
        'perecedero': True,
    },
    {
        'codigo': 'P0017',
        'nombre': 'Pintura Látex Exterior 20 L',
        'categoria': 'Pinturas',
        'marca': 'Tigre',
        'unidad': 'unidad',
        'precio_venta': '96000.00',
        'precio_costo': '72000.00',
        'stock': (30, 90),
        'venta': (2, 6),
        'perecedero': True,
    },
    {
        'codigo': 'P0018',
        'nombre': 'Esmalte Sintético 4 L',
        'categoria': 'Pinturas',
        'marca': 'Tigre',
        'unidad': 'unidad',
        'precio_venta': '39000.00',
        'precio_costo': '29500.00',
        'stock': (40, 100),
        'venta': (2, 8),
        'perecedero': True,
    },
    {
        'codigo': 'P0019',
        'nombre': 'Cable Unipolar 2.5 mm',
        'categoria': 'Electricidad',
        'marca': 'Prysmian',
        'unidad': 'rollo',
        'precio_venta': '68000.00',
        'precio_costo': '52000.00',
        'stock': (25, 80),
        'venta': (1, 5),
        'perecedero': False,
    },
    {
        'codigo': 'P0020',
        'nombre': 'Cable Unipolar 4 mm',
        'categoria': 'Electricidad',
        'marca': 'Prysmian',
        'unidad': 'rollo',
        'precio_venta': '98000.00',
        'precio_costo': '76000.00',
        'stock': (20, 60),
        'venta': (1, 4),
        'perecedero': False,
    },
    {
        'codigo': 'P0021',
        'nombre': 'Llave Térmica 20 A',
        'categoria': 'Electricidad',
        'marca': 'Schneider Electric',
        'unidad': 'unidad',
        'precio_venta': '18500.00',
        'precio_costo': '13800.00',
        'stock': (60, 180),
        'venta': (2, 10),
        'perecedero': False,
    },
    {
        'codigo': 'P0022',
        'nombre': 'Tablero Eléctrico 12 Bocas',
        'categoria': 'Electricidad',
        'marca': 'Schneider Electric',
        'unidad': 'unidad',
        'precio_venta': '52000.00',
        'precio_costo': '40000.00',
        'stock': (15, 45),
        'venta': (1, 3),
        'perecedero': False,
    },
    {
        'codigo': 'P0023',
        'nombre': 'Martillo Galponero',
        'categoria': 'Herramientas',
        'marca': 'Stanley',
        'unidad': 'unidad',
        'precio_venta': '24000.00',
        'precio_costo': '17500.00',
        'stock': (20, 60),
        'venta': (1, 3),
        'perecedero': False,
    },
    {
        'codigo': 'P0024',
        'nombre': 'Taladro Percutor 650 W',
        'categoria': 'Herramientas',
        'marca': 'Bosch',
        'unidad': 'unidad',
        'precio_venta': '165000.00',
        'precio_costo': '128000.00',
        'stock': (8, 25),
        'venta': (1, 2),
        'perecedero': False,
    },
    {
        'codigo': 'P0025',
        'nombre': 'Amoladora Angular 900 W',
        'categoria': 'Herramientas',
        'marca': 'Bosch',
        'unidad': 'unidad',
        'precio_venta': '185000.00',
        'precio_costo': '145000.00',
        'stock': (8, 25),
        'venta': (1, 2),
        'perecedero': False,
    },
    {
        'codigo': 'P0026',
        'nombre': 'Chapa Zinc 12 x 3 m',
        'categoria': 'Techos',
        'marca': 'Ternium',
        'unidad': 'unidad',
        'precio_venta': '72000.00',
        'precio_costo': '56000.00',
        'stock': (30, 90),
        'venta': (1, 5),
        'perecedero': False,
    },
    {
        'codigo': 'P0027',
        'nombre': 'Membrana Asfáltica 4 mm',
        'categoria': 'Techos',
        'marca': 'Sika',
        'unidad': 'rollo',
        'precio_venta': '95000.00',
        'precio_costo': '74000.00',
        'stock': (30, 90),
        'venta': (1, 5),
        'perecedero': True,
    },
    {
        'codigo': 'P0028',
        'nombre': 'Teja Colonial',
        'categoria': 'Techos',
        'marca': 'Ladrillera del Norte',
        'unidad': 'unidad',
        'precio_venta': '3200.00',
        'precio_costo': '2400.00',
        'stock': (1500, 5000),
        'venta': (50, 300),
        'perecedero': False,
    },
    {
        'codigo': 'P0029',
        'nombre': 'Adhesivo Cerámico 30 kg',
        'categoria': 'Cemento y Mampostería',
        'marca': 'Weber',
        'unidad': 'bolsa',
        'precio_venta': '14500.00',
        'precio_costo': '11000.00',
        'stock': (100, 300),
        'venta': (5, 25),
        'perecedero': True,
    },
    {
        'codigo': 'P0030',
        'nombre': 'Pastina Blanca 2 kg',
        'categoria': 'Cemento y Mampostería',
        'marca': 'Klaukol',
        'unidad': 'bolsa',
        'precio_venta': '5800.00',
        'precio_costo': '4300.00',
        'stock': (80, 250),
        'venta': (5, 30),
        'perecedero': True,
    },
]

CLIENTES = [
    {
        'razon_social': 'Construcciones del Valle SRL',
        'tipo_documento': 'CUIT',
        'documento': '30712345678',
        'condicion_iva': 'RI',
        'telefono': '3875550101',
        'email': 'compras@construccionesdelvalle.com.ar',
        'direccion': 'Av. Bolivia 1450, Salta Capital',
    },
    {
        'razon_social': 'Materiales El Progreso SRL',
        'tipo_documento': 'CUIT',
        'documento': '30798765432',
        'condicion_iva': 'RI',
        'telefono': '3875550102',
        'email': 'administracion@elprogreso.com.ar',
        'direccion': 'Ruta Nacional 51 km 8, Campo Quijano',
    },
    {
        'razon_social': 'Obra Cerro San Bernardo SRL',
        'tipo_documento': 'CUIT',
        'documento': '30733445566',
        'condicion_iva': 'RI',
        'telefono': '3875550103',
        'email': 'obras@cerrosanbernardo.com.ar',
        'direccion': 'Los Alamos 320, Salta Capital',
    },
    {
        'razon_social': 'María Quispe',
        'tipo_documento': 'DNI',
        'documento': '30111222',
        'condicion_iva': 'CF',
        'telefono': '3875550104',
        'email': 'maria.quispe@mail.com',
        'direccion': 'Barrio San José, Campo Quijano',
    },
    {
        'razon_social': 'Juan Alderete',
        'tipo_documento': 'DNI',
        'documento': '28444555',
        'condicion_iva': 'CF',
        'telefono': '3875550105',
        'email': 'juan.alderete@mail.com',
        'direccion': 'Av. Ex Combatientes 780, Salta Capital',
    },
    {
        'razon_social': 'Corralón de Obra San José',
        'tipo_documento': 'CUIT',
        'documento': '30655443322',
        'condicion_iva': 'MT',
        'telefono': '3875550106',
        'email': 'sanjose@mail.com',
        'direccion': 'Ruta 51 km 3, Campo Quijano',
    },
    {
        'razon_social': 'Constructora Salta Norte SRL',
        'tipo_documento': 'CUIT',
        'documento': '30888776655',
        'condicion_iva': 'RI',
        'telefono': '3875550107',
        'email': 'compras@saltanorte.com.ar',
        'direccion': 'Av. Juan B. Justo 2100, Salta Capital',
    },
    {
        'razon_social': 'Plomería Integral Salta',
        'tipo_documento': 'CUIT',
        'documento': '30555667788',
        'condicion_iva': 'MT',
        'telefono': '3875550108',
        'email': 'plomeria.integral@mail.com',
        'direccion': 'Zuviría 890, Salta Capital',
    },
    {
        'razon_social': 'Consumidor Final',
        'tipo_documento': None,
        'documento': None,
        'condicion_iva': 'CF',
        'telefono': None,
        'email': None,
        'direccion': None,
    },
    {
        'razon_social': 'Vecinos del Barrio',
        'tipo_documento': None,
        'documento': None,
        'condicion_iva': 'CF',
        'telefono': '3875550109',
        'email': 'vecinos@mail.com',
        'direccion': 'Barrio El Mirador, Campo Quijano',
    },
]


class Command(BaseCommand):
    help = 'Carga datos de prueba coherentes y relacionados en la base de datos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Borra las tablas de negocio antes de poblar.',
        )
        parser.add_argument('--ventas', type=int, default=240)
        parser.add_argument('--compras', type=int, default=72)

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        if options['reset']:
            self._reset()

        self.credenciales = []
        self.empleados_por_sucursal = {}
        self.productos_por_proveedor = {}
        self.productos_por_codigo = {
            datos['codigo']: datos for datos in PRODUCTOS
        }
        self.codigos_sucursal = {
            datos['nombre']: datos['codigo'] for datos in SUCURSALES
        }
        self.secciones_abiertas = {}
        self.secciones_por_dia = {}

        ids = {}
        ids['pais'] = self._paises()
        ids['prov'] = self._provincias(ids['pais'])
        ids['loc'] = self._localidades(ids['prov'])
        ids['ubic'] = self._ubicaciones(ids['loc'])
        ids['empresa'] = self._empresas()
        ids['sucursal'] = self._sucursales(ids['empresa'], ids['ubic'])
        ids['usuario'] = self._usuarios()
        ids['empleado'] = self._empleados(ids['usuario'])
        ids['rol'] = self._roles()
        self._empleados_x_roles(ids['empleado'], ids['rol'])
        self._sucursales_x_empleados(ids['sucursal'], ids['empleado'])
        ids['cat'] = self._categorias()
        ids['marca'] = self._marcas()
        ids['unidad'] = self._unidades()
        ids['producto'] = self._productos(
            ids['cat'],
            ids['marca'],
            ids['unidad'],
        )
        ids['deposito'] = self._depositos(ids['sucursal'])
        self._productos_x_sucursal(ids['producto'], ids['sucursal'])
        ids['stock'] = self._stocks(ids['producto'], ids['sucursal'])
        ids['proveedor'] = self._proveedores()
        self._proveedores_x_sucursal(ids['proveedor'], ids['sucursal'])
        self._productos_x_proveedor(ids['producto'], ids['proveedor'])
        ids['caja'] = self._cajas(ids['sucursal'])
        ids['metodo'] = self._metodos_pago()
        ids['cliente'] = self._clientes()
        ids['stock_detalle'] = self._detalles_stock(
            ids['stock'],
            ids['deposito'],
        )
        self._secciones(ids['caja'])

        # Compras y ventas se ejecutan en orden cronologico para que el libro
        # de stock quede congruente con las fechas de los documentos.
        self._historial(ids, options['compras'], options['ventas'])
        self._cerrar_secciones()

        self._reporte()

    # ------------------------------------------------------------------ reset
    def _reset(self):
        self.stdout.write('Borrando tablas de negocio...')
        modelos = [
            TransferenciaStock, DetalleCierreCaja, MovimientoStock,
            MetodoPagoXCompra, MetodoPagoXVenta, DetalleCompra, DetalleVenta,
            Factura, Compra, Venta, Cliente, MetodoPago,
            DetalleStock, Stock, ProductoXSucursal, ProductoXProveedor,
            ProveedorXSucursal, Proveedor, Deposito, SeccionCaja, Caja,
            Producto, Unidad, Marca, Categoria,
            SucursalXEmpleado, EmpleadoXRol, Empleado, Rol,
            Usuario, Sucursal, Empresa, Ubicacion, Localidad, Provincia, Pais,
        ]
        for modelo in modelos:
            modelo.objects.all().delete()

    # ------------------------------------------------------------- geografia
    def _paises(self):
        return [Pais.objects.get_or_create(nombre='Argentina')[0]]

    def _provincias(self, paises):
        return [
            Provincia.objects.get_or_create(
                pais=paises[0],
                nombre='Salta',
            )[0]
        ]

    def _localidades(self, provincias):
        return [
            Localidad.objects.update_or_create(
                provincia=provincias[0],
                nombre=datos['localidad'],
                defaults={'codigo_postal': datos['codigo_postal']},
            )[0]
            for datos in SUCURSALES
        ]

    def _ubicaciones(self, localidades):
        return [
            Ubicacion.objects.update_or_create(
                localidad=localidad,
                calle=datos['calle'],
                nro_calle=datos['nro_calle'],
                defaults={
                    'latitud': datos['latitud'],
                    'longitud': datos['longitud'],
                },
            )[0]
            for datos, localidad in zip(SUCURSALES, localidades)
        ]

    # --------------------------------------------------------- organizacion
    def _empresas(self):
        empresa, _ = Empresa.objects.update_or_create(
            cuit='30712345678',
            defaults={
                'nombre': 'Corralón Fer-Cons',
                'razon_social': 'Fer-Cons S.A.',
                'email': 'contacto@fer-cons.com.ar',
                'telefono': '3875551000',
                'ingresos_brutos': '387-123456-7',
                'fecha_inicio_act': timezone.now().date().replace(
                    year=2015,
                    month=3,
                    day=1,
                ),
                'dir_fiscal': 'Av. Paraguay 1450, Salta Capital',
                'condicion_iva': 'RESPONSABLE_INSCRIPTO',
            },
        )
        return [empresa]

    def _sucursales(self, empresas, ubicaciones):
        empresa = empresas[0]
        Sucursal.objects.filter(empresa=empresa).update(es_central=False)
        return [
            Sucursal.objects.update_or_create(
                empresa=empresa,
                nombre=datos['nombre'],
                defaults={
                    'ubicacion': ubicacion,
                    'hora_ap': datos['hora_ap'],
                    'hora_c': datos['hora_c'],
                    'contacto': datos['contacto'],
                    'email_suc': datos['email_suc'],
                    'es_central': datos['es_central'],
                },
            )[0]
            for datos, ubicacion in zip(SUCURSALES, ubicaciones)
        ]

    def _usuarios(self):
        admin = Usuario.objects.filter(username='admin').first()
        if not admin:
            admin = Usuario.objects.create_superuser(
                username='admin',
                email='admin@fer-cons.com.ar',
                password=PASSWORD_ADMIN,
            )
        self.credenciales.append(
            ('admin', PASSWORD_ADMIN, 'admin@fer-cons.com.ar', '-', 'Superuser')
        )

        usuarios = []
        for datos in EMPLEADOS:
            username = datos[6]
            email = f'{username}@fer-cons.com.ar'
            user, creado = Usuario.objects.get_or_create(
                username=username,
                defaults={'email': email},
            )
            if creado:
                user.set_password(PASSWORD_DEMO)
                user.save()
            usuarios.append(user)
            self.credenciales.append(
                (username, PASSWORD_DEMO, email, datos[1], datos[4])
            )
        return usuarios

    def _empleados(self, usuarios):
        empleados = []
        for datos, user in zip(EMPLEADOS, usuarios):
            dni, legajo, nombre, apellido, codigo, sucursal, _ = datos
            empleado, _ = Empleado.objects.update_or_create(
                legajo=legajo,
                defaults={
                    'usuario': user,
                    'dni': dni,
                    'nombre': nombre,
                    'apellido': apellido,
                    'telefono': f'387555{3000 + int(legajo):04d}',
                    'estado': Empleado.EstadoEmpleado.ACTIVO,
                },
            )
            empleados.append(empleado)
            self.empleados_por_sucursal.setdefault(
                sucursal,
                {},
            )[codigo] = empleado
        return empleados

    def _roles(self):
        roles = []
        for codigo, ocupacion, descripcion in ROLES:
            rol, _ = Rol.objects.update_or_create(
                codigo=codigo,
                defaults={
                    'ocupacion': ocupacion,
                    'descripcion': descripcion,
                },
            )
            roles.append(rol)
        return roles

    def _empleados_x_roles(self, empleados, roles):
        roles_por_codigo = {rol.codigo: rol for rol in roles}
        for datos, empleado in zip(EMPLEADOS, empleados):
            EmpleadoXRol.objects.update_or_create(
                empleado=empleado,
                rol=roles_por_codigo[datos[4]],
                defaults={
                    'hora_entrada': '08:00:00',
                    'hora_salida': '17:00:00',
                    'estado': 'AC',
                },
            )

    def _sucursales_x_empleados(self, sucursales, empleados):
        sucursales_por_nombre = {sucursal.nombre: sucursal for sucursal in sucursales}
        for datos, empleado in zip(EMPLEADOS, empleados):
            sucursal = sucursales_por_nombre[datos[5]]
            SucursalXEmpleado.objects.filter(empleado=empleado).exclude(
                sucursal=sucursal
            ).delete()
            SucursalXEmpleado.objects.update_or_create(
                sucursal=sucursal,
                empleado=empleado,
                defaults={
                    'fecha_asociacion': (
                        timezone.now() - timedelta(days=300)
                    ).date(),
                    'estado': True,
                },
            )

    # ---------------------------------------------------------------- catalogo
    def _categorias(self):
        return [
            Categoria.objects.get_or_create(categorias=nombre)[0]
            for nombre in CATEGORIAS
        ]

    def _marcas(self):
        return [
            Marca.objects.get_or_create(marcas=nombre)[0]
            for nombre in MARCAS
        ]

    def _unidades(self):
        return [
            Unidad.objects.get_or_create(unidades=nombre)[0]
            for nombre in UNIDADES
        ]

    def _productos(self, categorias, marcas, unidades):
        categorias_por_nombre = {
            categoria.categorias: categoria for categoria in categorias
        }
        marcas_por_nombre = {marca.marcas: marca for marca in marcas}
        unidades_por_nombre = {unidad.unidades: unidad for unidad in unidades}
        productos = []
        for datos in PRODUCTOS:
            producto, _ = Producto.objects.update_or_create(
                codigo=datos['codigo'],
                defaults={
                    'categoria': categorias_por_nombre[datos['categoria']],
                    'marca': marcas_por_nombre[datos['marca']],
                    'unidad': unidades_por_nombre[datos['unidad']],
                    'nombre': datos['nombre'],
                    'precio_unidad': Decimal(datos['precio_venta']),
                    'descripcion': (
                        f"{datos['categoria']} · {datos['marca']} · "
                        f"{datos['nombre']}"
                    ),
                },
            )
            productos.append(producto)
        return productos

    def _depositos(self, sucursales):
        depositos = []
        for sucursal in sucursales:
            for nombre, predeterminado in DEPOSITOS[sucursal.nombre]:
                deposito, _ = Deposito.objects.update_or_create(
                    nombre=nombre,
                    defaults={
                        'descripcion': f'Depósito de {sucursal.nombre}',
                        'sucursal': sucursal,
                        'es_predeterminado': predeterminado,
                    },
                )
                depositos.append(deposito)
        return depositos

    def _productos_x_sucursal(self, productos, sucursales):
        for producto in productos:
            for sucursal in sucursales:
                ProductoXSucursal.objects.update_or_create(
                    producto=producto,
                    sucursal=sucursal,
                    defaults={'estado': True},
                )

    def _stocks(self, productos, sucursales):
        stocks = []
        for producto, datos in zip(productos, PRODUCTOS):
            stock_minimo = max(1, int(datos['stock'][0] * 0.15))
            for sucursal in sucursales:
                stock, _ = Stock.objects.update_or_create(
                    producto=producto,
                    sucursal=sucursal,
                    defaults={
                        'cantidad': Decimal('0.000'),
                        'cant_min': Decimal(stock_minimo),
                        'cant_negativa_max': Decimal('-10.000'),
                    },
                )
                stocks.append(stock)
        return stocks

    def _detalles_stock(self, stocks, depositos):
        detalles = []
        fecha_inicial = timezone.now() - timedelta(days=DIAS_STOCK_INICIAL)
        for stock in stocks:
            datos = self.productos_por_codigo[stock.producto.codigo]
            depositos_sucursal = [
                deposito
                for deposito in depositos
                if deposito.sucursal_id == stock.sucursal_id
            ] or depositos
            total = Decimal(random.randint(*datos['stock']))
            cantidad_base = (total / len(depositos_sucursal)).quantize(
                Decimal('0.001')
            )
            restante = total
            for indice, deposito in enumerate(depositos_sucursal):
                cantidad = (
                    restante
                    if indice == len(depositos_sucursal) - 1
                    else cantidad_base
                )
                restante -= cantidad
                detalle = DetalleStock.objects.create(
                    stock=stock,
                    deposito=deposito,
                    cantidad=cantidad,
                    fecha_venc=(
                        (
                            timezone.now()
                            + timedelta(days=random.randint(180, 540))
                        ).date()
                        if datos['perecedero']
                        else None
                    ),
                )
                DetalleStock.objects.filter(pk=detalle.pk).update(
                    fecha_ingreso=fecha_inicial
                )
                detalle.fecha_ingreso = fecha_inicial
                detalles.append(detalle)
            stock.cantidad = total
            stock.save(update_fields=['cantidad'])
        return detalles

    # ------------------------------------------------------------- proveedores
    def _proveedores(self):
        proveedores = []
        for nombre, cuit, telefono in PROVEEDORES:
            proveedor, _ = Proveedor.objects.update_or_create(
                cuit=cuit,
                defaults={
                    'nombre': nombre,
                    'razon_social': nombre,
                    'contacto': telefono,
                    'email_prov': f'ventas@prov{cuit}.com.ar',
                    'estado_prov': True,
                },
            )
            proveedores.append(proveedor)
        return proveedores

    def _proveedores_x_sucursal(self, proveedores, sucursales):
        for proveedor in proveedores:
            for sucursal in sucursales:
                ProveedorXSucursal.objects.update_or_create(
                    proveedor=proveedor,
                    sucursal=sucursal,
                    defaults={'estado': True},
                )

    def _productos_x_proveedor(self, productos, proveedores):
        proveedores_por_nombre = {
            proveedor.nombre: proveedor for proveedor in proveedores
        }
        for producto, datos in zip(productos, PRODUCTOS):
            proveedor = proveedores_por_nombre[datos['marca']]
            ProductoXProveedor.objects.filter(producto=producto).exclude(
                proveedor=proveedor
            ).update(estado=False)
            ProductoXProveedor.objects.update_or_create(
                producto=producto,
                proveedor=proveedor,
                defaults={
                    'codigo_producto_proveedor': f"CP-{producto.codigo}",
                    'precio_lista': Decimal(datos['precio_costo']),
                    'estado': True,
                },
            )

        self.productos_por_proveedor = {}
        for asociacion in ProductoXProveedor.objects.filter(
            estado=True
        ).select_related('producto'):
            self.productos_por_proveedor.setdefault(
                asociacion.proveedor_id,
                [],
            ).append(asociacion.producto)

    # ------------------------------------------------------------------- cajas
    def _cajas(self, sucursales):
        cajas = []
        for sucursal in sucursales:
            caja, _ = Caja.objects.update_or_create(
                sucursal=sucursal,
                defaults={'estado': Caja.EstadoCaja.ACTIVA},
            )
            cajas.append(caja)
        return cajas

    def _secciones(self, cajas):
        ahora = timezone.now()
        for caja in cajas:
            cajero = self.empleados_por_sucursal[caja.sucursal.nombre]['CA']
            seccion, _ = SeccionCaja.objects.get_or_create(
                caja=caja,
                estado=SeccionCaja.EstadoSeccion.ABIERTA,
                defaults={
                    'empleado': cajero,
                    'fecha_hora_apertura': ahora - timedelta(hours=2),
                    'monto_inicial': Decimal('25000.00'),
                },
            )
            self.secciones_abiertas[caja.id] = seccion
        return list(self.secciones_abiertas.values())

    def _seccion_para(self, caja, fecha):
        fecha_local = timezone.localtime(fecha)
        if fecha_local.date() == timezone.localdate():
            return self.secciones_abiertas[caja.id]

        clave = (caja.id, fecha_local.date())
        if clave in self.secciones_por_dia:
            return self.secciones_por_dia[clave]

        apertura = timezone.make_aware(
            datetime.combine(fecha_local.date(), time(8, 0))
        )
        cierre = timezone.make_aware(
            datetime.combine(fecha_local.date(), time(18, 0))
        )
        cajero = self.empleados_por_sucursal[caja.sucursal.nombre]['CA']
        seccion, _ = SeccionCaja.objects.get_or_create(
            caja=caja,
            fecha_hora_apertura=apertura,
            defaults={
                'empleado': cajero,
                'fecha_hora_cierre': cierre,
                'monto_inicial': Decimal('25000.00'),
                'monto_final': Decimal('25000.00'),
                'estado': SeccionCaja.EstadoSeccion.CERRADA,
            },
        )
        self.secciones_por_dia[clave] = seccion
        return seccion

    # ---------------------------------------------------------------- pagos
    def _metodos_pago(self):
        return [
            MetodoPago.objects.update_or_create(
                metodo_pago=nombre,
                defaults={
                    'estado': True,
                    'es_efectivo': nombre == 'Efectivo',
                },
            )[0]
            for nombre in METODOS_PAGO
        ]

    def _clientes(self):
        condiciones = {
            'RI': Cliente.CondicionIVA.RESPONSABLE_INSCRIPTO,
            'MT': Cliente.CondicionIVA.MONOTRIBUTISTA,
            'CF': Cliente.CondicionIVA.CONSUMIDOR_FINAL,
        }
        clientes = []
        for datos in CLIENTES:
            cliente, _ = Cliente.objects.update_or_create(
                razon_social=datos['razon_social'],
                defaults={
                    'dni': datos['documento'],
                    'tipo_documento': datos['tipo_documento'],
                    'email': datos['email'],
                    'telefono': datos['telefono'],
                    'direccion': datos['direccion'],
                    'condicion_iva': condiciones[datos['condicion_iva']],
                    'ingresos_brutos': None,
                    'notas': None,
                    'estado': True,
                },
            )
            clientes.append(cliente)
        return clientes

    # --------------------------------------------------------------- historial
    def _historial(self, ids, cantidad_compras, cantidad_ventas):
        cajas = ids['caja']
        ahora = timezone.now()
        eventos = []

        for indice in range(cantidad_compras):
            eventos.append(
                {
                    'tipo': 'compra',
                    'fecha': self._fecha_historial(indice, cantidad_compras),
                    'caja': cajas[indice % len(cajas)],
                }
            )

        pendientes = min(8, max(2, cantidad_ventas // 25))
        for indice in range(cantidad_ventas):
            caja = cajas[indice % len(cajas)]
            if indice < pendientes:
                fecha = ahora - timedelta(minutes=random.randint(2, 25))
                estado = (
                    'PENDIENTE' if indice % 2 == 0 else 'PENDIENTE_CON_PAGO'
                )
            else:
                fecha = self._fecha_historial(
                    indice - pendientes,
                    max(1, cantidad_ventas - pendientes),
                )
                estado = random.choices(
                    ['CONFIRMADA', 'PENDIENTE_CON_PAGO'],
                    weights=[85, 15],
                )[0]
            eventos.append(
                {
                    'tipo': 'venta',
                    'fecha': fecha,
                    'caja': caja,
                    'estado': estado,
                }
            )

        eventos.sort(key=lambda evento: evento['fecha'])
        for evento in eventos:
            if evento['tipo'] == 'compra':
                self._crear_compra(ids, evento['fecha'], evento['caja'])
            else:
                self._crear_venta(
                    ids,
                    evento['fecha'],
                    evento['caja'],
                    evento['estado'],
                )

    def _fecha_historial(self, indice, cantidad):
        dias = DIAS_HISTORIAL - 2
        dias_atras = 2 + int(
            (indice + 0.5) * max(0, dias - 2) / max(1, cantidad)
        )
        fecha = timezone.localtime(timezone.now()) - timedelta(
            days=dias_atras
        )
        return fecha.replace(
            hour=random.randint(9, 17),
            minute=random.choice([0, 15, 30, 45]),
            second=0,
            microsecond=0,
        )

    def _cliente_aleatorio(self, clientes):
        consumidores = [
            cliente
            for cliente in clientes
            if cliente.condicion_iva == Cliente.CondicionIVA.CONSUMIDOR_FINAL
        ]
        if consumidores and random.random() < 0.35:
            return random.choice(consumidores)
        return random.choice(clientes)

    def _crear_venta(self, ids, fecha, caja, estado_pago):
        productos = ids['producto']
        metodos = ids['metodo']
        seccion = self._seccion_para(caja, fecha)
        cliente = self._cliente_aleatorio(ids['cliente'])
        venta = Venta.objects.create(
            seccion_caja=seccion,
            cliente=cliente,
            fecha_venta=fecha,
            monto_venta=Decimal('0.00'),
        )
        Venta.objects.filter(pk=venta.pk).update(fecha_venta=fecha)
        venta.refresh_from_db()

        total = Decimal('0.00')
        vendidos = 0
        cantidad_items = random.randint(1, min(4, len(productos)))
        for producto in random.sample(productos, cantidad_items):
            datos = self.productos_por_codigo[producto.codigo]
            cantidad = Decimal(
                random.randint(datos['venta'][0], datos['venta'][1])
            )
            stock = stock_service.obtener_stock(producto, caja.sucursal)
            if stock.cantidad < cantidad:
                continue

            precio = producto.precio_unidad
            subtotal = (cantidad * precio).quantize(Decimal('0.01'))
            DetalleVenta.objects.create(
                venta=venta,
                producto=producto,
                cantidad_venta=cantidad,
                precio_venta=precio,
                subtotal=subtotal,
            )
            movimientos = stock_service.consumir_stock(
                stock,
                cantidad,
                referencia=f'Venta {venta.pk}',
                venta=venta,
            )
            MovimientoStock.objects.filter(
                pk__in=[movimiento.pk for movimiento in movimientos]
            ).update(fecha=fecha)
            total += subtotal
            vendidos += 1

        if vendidos == 0:
            venta.delete()
            return

        venta.monto_venta = total
        if estado_pago == 'CONFIRMADA':
            venta.estado = Venta.EstadoVenta.CONFIRMADA
            self._pagar(venta, total, metodos, 'venta')
        elif estado_pago == 'PENDIENTE_CON_PAGO':
            venta.estado = Venta.EstadoVenta.PENDIENTE
            porcentaje = Decimal(str(random.uniform(0.3, 0.6)))
            self._pagar(
                venta,
                (total * porcentaje).quantize(Decimal('0.01')),
                metodos,
                'venta',
            )
        else:
            venta.estado = Venta.EstadoVenta.PENDIENTE
        venta.save()

        if venta.estado == Venta.EstadoVenta.CONFIRMADA:
            tipo = (
                'A'
                if cliente.condicion_iva
                == Cliente.CondicionIVA.RESPONSABLE_INSCRIPTO
                else 'B'
            )
            Factura.objects.get_or_create(
                venta=venta,
                defaults={
                    'tipo': tipo,
                    'direccion_pdf': f'/media/facturas/{venta.pk}.pdf',
                },
            )

    def _cantidad_compra(self, datos):
        base = max(1, datos['stock'][0] // 4)
        maximo = max(base + 1, datos['stock'][1] // 2)
        return Decimal(random.randint(base, maximo))

    def _crear_compra(self, ids, fecha, caja):
        metodos = ids['metodo']
        proveedores = [
            proveedor
            for proveedor in ids['proveedor']
            if self.productos_por_proveedor.get(proveedor.id)
        ]
        if not proveedores:
            return

        proveedor = random.choice(proveedores)
        disponibles = self.productos_por_proveedor[proveedor.id]
        seccion = self._seccion_para(caja, fecha)
        fecha_recepcion = fecha + timedelta(hours=random.randint(3, 10))
        if fecha_recepcion > timezone.now():
            fecha_recepcion = timezone.now() - timedelta(hours=1)
        deposito = stock_service.deposito_predeterminado(caja.sucursal)

        compra = Compra.objects.create(
            seccion_caja=seccion,
            proveedor=proveedor,
            fecha_compra=fecha,
            estado_entrega=Compra.EstadoEntrega.RECIBIDA,
            monto_compra=Decimal('0.00'),
        )
        Compra.objects.filter(pk=compra.pk).update(
            fecha_compra=fecha,
            fecha_recepcion=fecha_recepcion,
        )
        compra.refresh_from_db()

        total = Decimal('0.00')
        cantidad_items = random.randint(1, min(3, len(disponibles)))
        for producto in random.sample(disponibles, cantidad_items):
            datos = self.productos_por_codigo[producto.codigo]
            cantidad = self._cantidad_compra(datos)
            precio = Decimal(datos['precio_costo'])
            subtotal = (cantidad * precio).quantize(Decimal('0.01'))
            DetalleCompra.objects.create(
                compra=compra,
                producto=producto,
                cantidad_compra=cantidad,
                precio_compra=precio,
                subtotal=subtotal,
            )

            stock = stock_service.obtener_stock(producto, caja.sucursal)
            detalle_stock, movimiento = stock_service.reponer_stock(
                stock,
                cantidad,
                deposito,
                fecha_venc=(
                    (
                        fecha_recepcion
                        + timedelta(days=random.randint(180, 720))
                    ).date()
                    if datos['perecedero']
                    else None
                ),
                referencia=f'Compra {compra.pk}',
                compra=compra,
            )
            DetalleStock.objects.filter(pk=detalle_stock.pk).update(
                fecha_ingreso=fecha_recepcion
            )
            MovimientoStock.objects.filter(pk=movimiento.pk).update(
                fecha=fecha_recepcion
            )
            total += subtotal

        compra.monto_compra = total
        estado = random.choices(
            ['PAGADA', 'PARCIAL', 'PENDIENTE'],
            weights=[65, 20, 15],
        )[0]
        if estado == 'PAGADA':
            compra.estado = Compra.EstadoCompra.PAGADA
            self._pagar(compra, total, metodos, 'compra')
        elif estado == 'PARCIAL':
            compra.estado = Compra.EstadoCompra.PARCIAL
            porcentaje = Decimal(str(random.uniform(0.3, 0.6)))
            self._pagar(
                compra,
                (total * porcentaje).quantize(Decimal('0.01')),
                metodos,
                'compra',
            )
        else:
            compra.estado = Compra.EstadoCompra.PENDIENTE
        compra.save()

    def _pagar(self, obj, monto, metodos, tipo):
        restante = monto
        elegidos = random.sample(metodos, random.randint(1, 2))
        for indice, metodo in enumerate(elegidos):
            if indice == len(elegidos) - 1:
                parcial = restante
            else:
                parcial = (restante * Decimal('0.5')).quantize(Decimal('0.01'))
                restante -= parcial
            if tipo == 'venta':
                MetodoPagoXVenta.objects.create(
                    metodo_pago=metodo,
                    venta=obj,
                    monto_pagado=parcial,
                )
            else:
                MetodoPagoXCompra.objects.create(
                    metodo_pago=metodo,
                    compra=obj,
                    monto_pagado=parcial,
                )

    def _cerrar_secciones(self):
        secciones = SeccionCaja.objects.filter(
            estado=SeccionCaja.EstadoSeccion.CERRADA,
            monto_teorico__isnull=True,
        )
        for seccion in secciones:
            detalles = []
            for item in caja_service.calcular_teorico(seccion):
                sistema = item['monto_sistema']
                real = sistema
                if item['metodo_pago'].es_efectivo:
                    diferencia = Decimal(
                        random.choice([0, 0, 0, 500, -300, 1200, -800])
                    )
                    real = max(Decimal('0.00'), sistema + diferencia)
                detalles.append(
                    DetalleCierreCaja.objects.create(
                        seccion_caja=seccion,
                        metodo_pago=item['metodo_pago'],
                        monto_sistema=sistema,
                        monto_real=real,
                    )
                )
            seccion.monto_teorico = sum(
                (detalle.monto_sistema for detalle in detalles),
                Decimal('0.00'),
            )
            seccion.monto_final = sum(
                (detalle.monto_real for detalle in detalles),
                Decimal('0.00'),
            )
            seccion.save(update_fields=['monto_teorico', 'monto_final'])

    # ----------------------------------------------------------------- reporte
    def _reporte(self):
        self.stdout.write(
            self.style.SUCCESS('\nDatos cargados correctamente.\n')
        )
        self.stdout.write('Sucursales: Salta Capital y Campo Quijano')
        self.stdout.write(
            f'Productos: {Producto.objects.count()} | '
            f'Stocks: {Stock.objects.count()} | '
            f'Compras: {Compra.objects.count()} | '
            f'Ventas: {Venta.objects.count()}'
        )
        self.stdout.write('Credenciales generadas:')
        for usuario, pwd, email, legajo, tipo in self.credenciales:
            self.stdout.write(
                f'  [{tipo:9}] usuario: {usuario:22} pass: {pwd:10} '
                f'email: {email:28} legajo: {legajo}'
            )
