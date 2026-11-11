import random
from datetime import timedelta
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
from app.services import stock as stock_service

Usuario = get_user_model()

PASSWORD_DEMO = 'test1234'
PASSWORD_ADMIN = 'admin1234'
DIAS_HISTORIAL = 180

METODOS_PAGO = [
    'Efectivo',
    'Debito',
    'Credito',
    'Transferencia',
    'Cuenta Corriente',
    'QR',
]

CATEGORIAS = [
    'Cemento y Mamposteria',
    'Hierros',
    'Aridos',
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
    'Sika',
]

UNIDADES = ['bolsa', 'kg', 'm3', 'unidad', 'metro', 'litro', 'rollo']

PRODUCTOS = [
    ('Cemento Loma Negra 50kg', 1, 2, 1, '8500.00'),
    ('Cemento Avellaneda 50kg', 1, 2, 1, '8200.00'),
    ('Cal Hidratada 25kg', 1, 4, 1, '4100.00'),
    ('Ladrillo Hueco 12x18x33', 1, 6, 4, '620.00'),
    ('Ladrillo Comun', 1, 6, 4, '310.00'),
    ('Hierro 8mm x12m', 2, 1, 5, '9800.00'),
    ('Hierro 10mm x12m', 2, 1, 5, '14600.00'),
    ('Hierro 12mm x12m', 2, 1, 5, '20500.00'),
    ('Malla Sima 15x15', 2, 1, 5, '32000.00'),
    ('Arena Fina', 3, 5, 3, '12500.00'),
    ('Arena Gruesa', 3, 5, 3, '11800.00'),
    ('Piedra Partida 6/20', 3, 5, 3, '15200.00'),
    ('Inodoro Largo', 4, 8, 4, '65000.00'),
    ('Lavatorio', 4, 8, 4, '42000.00'),
    ('Bacha de Cocina', 4, 8, 4, '58000.00'),
    ('Pintura Latex Interior 20L', 5, 7, 6, '38000.00'),
    ('Pintura Latex Exterior 20L', 5, 7, 6, '46000.00'),
    ('Esmalte Sintetico 4L', 5, 7, 6, '18500.00'),
    ('Cable Unipolar 2.5mm', 6, 6, 5, '3200.00'),
    ('Cable Unipolar 4mm', 6, 6, 5, '4800.00'),
    ('Llave Termica 20A', 6, 6, 4, '9200.00'),
    ('Tablero Electrico 12 Bocas', 6, 8, 4, '28000.00'),
    ('Martillo Galponero', 7, 6, 4, '11500.00'),
    ('Taladro Percutor 650W', 7, 8, 4, '78000.00'),
    ('Amoladora Angular 900W', 7, 8, 4, '92000.00'),
    ('Chapa Zinc 12 x 3m', 8, 6, 5, '34000.00'),
    ('Membrana Asfaltica 4mm', 8, 4, 7, '52000.00'),
    ('Teja Colonial', 8, 6, 4, '1450.00'),
    ('Adhesivo Ceramico 30kg', 1, 2, 1, '9600.00'),
    ('Pastina Blanca 2kg', 1, 2, 1, '3400.00'),
]

ROLES = [
    ('AD', 'Admin', 'Acceso total al sistema'),
    ('GE', 'Gerente', 'Supervision general y gestion de catalogos'),
    ('CA', 'Cajero', 'Manejo de caja y cobros'),
    ('VE', 'Vendedor', 'Atencion al publico y carga de ventas'),
    ('ED', 'Encargado de deposito', 'Compras, recepcion y depositos'),
    (None, 'Chofer', 'Reparto de mercaderia'),
]

EMPLEADOS = [
    ('30211222', '0001', 'Juan', 'Perez', 'Vendedor'),
    ('31445566', '0002', 'Maria', 'Gomez', 'Cajero'),
    ('28556677', '0003', 'Carlos', 'Rodriguez', 'Gerente'),
    ('27889900', '0004', 'Ana', 'Fernandez', 'Gerente'),
    ('33998877', '0005', 'Lautaro', 'Diaz', 'Encargado de deposito'),
    ('29556611', '0006', 'Sofia', 'Martinez', 'Vendedor'),
    ('32112233', '0007', 'Diego', 'Lopez', 'Chofer'),
    ('35667788', '0008', 'Lucia', 'Romero', 'Cajero'),
    ('30334455', '0009', 'Martina', 'Sosa', 'Vendedor'),
    ('NULL', '0010', 'Pablo', 'Torres', 'Encargado de deposito'),
]

CLIENTES = [
    ('Construcciones Delta SRL', '30712345678', 'Resp. Inscripto'),
    ('Maderas y Materiales SA', '30798765432', 'Resp. Inscripto'),
    ('Consumidor Final', None, 'Consumidor Final'),
    ('Monotributista Ruiz', '20334455667', 'Monotributo'),
    ('Obra Norte SA', '30655443322', 'Resp. Inscripto'),
    ('Vecinos Corralon', None, 'Consumidor Final'),
    ('El Constructor Feliz', '30888776655', 'Monotributo'),
    ('Hormigonera Central SRL', '30999001122', 'Resp. Inscripto'),
    ('Plomeria Integral SRL', '30555667788', 'Resp. Inscripto'),
    ('Cliente Final', None, 'Consumidor Final'),
]


class Command(BaseCommand):
    help = 'Carga datos de prueba coherentes y relacionados en la base de datos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Borra las tablas de negocio antes de poblar.',
        )
        parser.add_argument('--ventas', type=int, default=50)
        parser.add_argument('--compras', type=int, default=20)

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        if options['reset']:
            self._reset()

        self.credenciales = []

        ids = {}
        ids['pais'] = self._paises()
        ids['prov'] = self._provincias(ids['pais'])
        ids['loc'] = self._localidades(ids['prov'])
        ids['ubic'] = self._ubicaciones(ids['loc'])
        ids['empresa'] = self._empresas()
        ids['sucursal'] = self._sucursales(ids['empresa'], ids['ubic'])
        ids['usuario'] = self._usuarios(ids['sucursal'])
        ids['empleado'] = self._empleados(ids['usuario'])
        ids['rol'] = self._roles()
        self._empleados_x_roles(ids['empleado'], ids['rol'])
        self._sucursales_x_empleados(ids['sucursal'], ids['empleado'])
        ids['cat'] = self._categorias()
        ids['marca'] = self._marcas()
        ids['unidad'] = self._unidades()
        ids['producto'] = self._productos(ids['cat'], ids['marca'], ids['unidad'])
        ids['deposito'] = self._depositos(ids['sucursal'])
        self._productos_x_sucursal(ids['producto'], ids['sucursal'])
        ids['stock'] = self._stocks(ids['producto'], ids['sucursal'])
        ids['proveedor'] = self._proveedores()
        self._proveedores_x_sucursal(ids['proveedor'], ids['sucursal'])
        self._productos_x_proveedor(ids['producto'], ids['proveedor'])
        ids['caja'] = self._cajas(ids['sucursal'])
        ids['seccion'] = self._secciones(ids['caja'], ids['empleado'])
        ids['metodo'] = self._metodos_pago()
        ids['cliente'] = self._clientes()
        ids['stock_detalle'] = self._detalles_stock(ids['stock'], ids['deposito'])

        # Las compras reponen stock antes de que las ventas lo consuman, asi el
        # libro de movimientos queda completo y no se dispara `StockInsuficiente`.
        self._compras(ids, options['compras'])
        self._ventas(ids, options['ventas'])

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
        nombres = ['Argentina', 'Brasil', 'Uruguay']
        return [Pais.objects.get_or_create(nombre=n)[0] for n in nombres]

    def _provincias(self, paises):
        arg = paises[0]
        datos = [
            (arg, 'Buenos Aires'),
            (arg, 'Santa Fe'),
            (arg, 'Cordoba'),
        ]
        return [
            Provincia.objects.get_or_create(pais=p, nombre=n)[0]
            for p, n in datos
        ]

    def _localidades(self, provincias):
        datos = [
            (provincias[0], '1000', 'CABA'),
            (provincias[0], '1900', 'La Plata'),
            (provincias[0], '2700', 'Pergamino'),
            (provincias[1], '2000', 'Rosario'),
            (provincias[1], '3000', 'Santa Fe'),
            (provincias[2], '5000', 'Cordoba Capital'),
            (provincias[2], '5800', 'Rio Cuarto'),
        ]
        return [
            Localidad.objects.get_or_create(
                provincia=p, nombre=n, defaults={'codigo_postal': cp}
            )[0]
            for p, cp, n in datos
        ]

    def _ubicaciones(self, localidades):
        calles = [
            ('Av. San Martin', 1234),
            ('Belgrano', 567),
            ('Rivadavia', 890),
            ('Mitre', 321),
            ('Sarmiento', 654),
            ('9 de Julio', 987),
            ('Corrientes', 210),
        ]
        result = []
        for loc, (calle, nro) in zip(localidades, calles):
            result.append(
                Ubicacion.objects.get_or_create(
                    localidad=loc,
                    calle=calle,
                    nro_calle=nro,
                    defaults={
                        'latitud': Decimal('-34.603722'),
                        'longitud': Decimal('-58.381592'),
                    },
                )[0]
            )
        return result

    # --------------------------------------------------------- organizacion
    def _empresas(self):
        datos = [
            ('30712345678', 'Corralon Fer-Cons', 'Fer-Cons S.A.', 'Responsable Inscripto'),
            ('30787654321', 'Corralon del Norte', 'Materiales del Norte SRL', 'Monotributo'),
        ]
        return [
            Empresa.objects.get_or_create(
                cuit=c,
                defaults={
                    'nombre': n,
                    'razon_social': r,
                    'email': f'contacto@{n.lower().replace(" ", "")}.com',
                    'telefono': '3415551234',
                    'condicion_iva': iva,
                },
            )[0]
            for c, n, r, iva in datos
        ]

    def _sucursales(self, empresas, ubicaciones):
        datos = [
            (empresas[0], ubicaciones[0], 'Casa Central'),
            (empresas[0], ubicaciones[1], 'Sucursal La Plata'),
            (empresas[0], ubicaciones[3], 'Sucursal Rosario'),
            (empresas[1], ubicaciones[5], 'Sucursal Cordoba'),
        ]
        Sucursal.objects.filter(empresa__in=empresas).update(es_central=False)
        return [
            Sucursal.objects.update_or_create(
                empresa=e,
                ubicacion=u,
                nombre=n,
                defaults={
                    'hora_ap': '08:00:00',
                    'hora_c': '18:00:00',
                    'contacto': '3415559999',
                    'email_suc': f'{n.lower().replace(" ", "")}@corralon.com',
                    'es_central': n == 'Casa Central',
                },
            )[0]
            for e, u, n in datos
        ]

    def _usuarios(self, sucursales):
        admin = Usuario.objects.filter(username='admin').first()
        if not admin:
            admin = Usuario.objects.create_superuser(
                username='admin',
                email='admin@corralon.com',
                password=PASSWORD_ADMIN,
            )
        self.credenciales.append(
            ('admin', PASSWORD_ADMIN, 'admin@corralon.com', '-', 'Superuser')
        )

        usuarios = []
        for i, (dni, legajo, nombre, apellido, _) in enumerate(EMPLEADOS, start=1):
            username = f'{nombre.lower()}.{apellido.lower()}'
            email = f'{username}@corralon.com'
            if dni == 'NULL':
                usuarios.append(None)
                continue
            user, creado = Usuario.objects.get_or_create(
                username=username,
                defaults={'email': email},
            )
            if creado:
                user.set_password(PASSWORD_DEMO)
                user.save()
                self.credenciales.append(
                    (username, PASSWORD_DEMO, email, legajo, 'Empleado')
                )
            usuarios.append(user)
        return usuarios

    def _empleados(self, usuarios):
        empleados = []
        for (dni, legajo, nombre, apellido, _), user in zip(EMPLEADOS, usuarios):
            emp, _ = Empleado.objects.get_or_create(
                legajo=legajo,
                defaults={
                    'usuario': user,
                    'dni': dni if dni != 'NULL' else f'9{legajo}',
                    'nombre': nombre,
                    'apellido': apellido,
                    'telefono': f'34155{900000 + int(legajo)}',
                    'estado': Empleado.EstadoEmpleado.ACTIVO,
                },
            )
            empleados.append(emp)
        return empleados

    def _roles(self):
        roles = []
        for codigo, ocupacion, descripcion in ROLES:
            rol, creado = Rol.objects.get_or_create(
                ocupacion=ocupacion,
                defaults={'codigo': codigo, 'descripcion': descripcion},
            )
            if not creado and rol.codigo != codigo:
                rol.codigo = codigo
                rol.save(update_fields=['codigo'])
            roles.append(rol)
        return roles

    def _empleados_x_roles(self, empleados, roles):
        rol_por_nombre = {r.ocupacion: r for r in roles}
        for (_, _, _, _, rol_nombre), emp in zip(EMPLEADOS, empleados):
            EmpleadoXRol.objects.get_or_create(
                empleado=emp,
                rol=rol_por_nombre[rol_nombre],
                defaults={
                    'hora_entrada': '08:00:00',
                    'hora_salida': '17:00:00',
                    'estado': 'AC',
                },
            )

    def _sucursales_x_empleados(self, sucursales, empleados):
        for i, emp in enumerate(empleados):
            SucursalXEmpleado.objects.get_or_create(
                sucursal=sucursales[i % len(sucursales)],
                empleado=emp,
                defaults={
                    'fecha_asociacion': (timezone.now() - timedelta(days=300)).date(),
                    'estado': True,
                },
            )

    # ---------------------------------------------------------------- catalogo
    def _categorias(self):
        return [
            Categoria.objects.get_or_create(categorias=c)[0] for c in CATEGORIAS
        ]

    def _marcas(self):
        return [Marca.objects.get_or_create(marcas=m)[0] for m in MARCAS]

    def _unidades(self):
        return [Unidad.objects.get_or_create(unidades=u)[0] for u in UNIDADES]

    def _productos(self, categorias, marcas, unidades):
        result = []
        for nombre, cat_i, marca_i, uni_i, precio in PRODUCTOS:
            codigo = f'P{len(result) + 1:04d}'
            prod, _ = Producto.objects.get_or_create(
                codigo=codigo,
                defaults={
                    'categoria': categorias[cat_i - 1],
                    'marca': marcas[marca_i - 1],
                    'unidad': unidades[uni_i - 1],
                    'nombre': nombre,
                    'precio_unidad': Decimal(precio),
                    'descripcion': f'Producto de prueba: {nombre}',
                },
            )
            result.append(prod)
        return result

    def _depositos(self, sucursales):
        datos = [
            ('Deposito Central', 0, True),
            ('Deposito Obra', 1, True),
            ('Deposito Norte', 2, True),
            ('Deposito Sur', 3, True),
            ('Deposito Anexo', 0, False),
            ('Deposito Corralon', 0, False),
        ]
        return [
            Deposito.objects.update_or_create(
                nombre=nombre,
                defaults={
                    'descripcion': f'Deposito {nombre}',
                    'sucursal': sucursales[indice],
                    'es_predeterminado': predeterminado,
                },
            )[0]
            for nombre, indice, predeterminado in datos
        ]

    def _productos_x_sucursal(self, productos, sucursales):
        for prod in productos:
            for suc in sucursales:
                ProductoXSucursal.objects.get_or_create(
                    producto=prod, sucursal=suc, defaults={'estado': True}
                )

    def _stocks(self, productos, sucursales):
        result = []
        for prod in productos:
            for suc in sucursales:
                stock, _ = Stock.objects.get_or_create(
                    producto=prod,
                    sucursal=suc,
                    defaults={
                        'cantidad': Decimal('0.000'),
                        'cant_min': Decimal(random.randint(5, 30)),
                        'cant_negativa_max': Decimal('-10.000'),
                    },
                )
                result.append(stock)
        return result

    def _detalles_stock(self, stocks, depositos):
        result = []
        # El stock inicial es anterior a todo el historial de ventas/compras.
        fecha_inicial = timezone.now() - timedelta(
            days=DIAS_HISTORIAL + 30,
            minutes=random.randint(0, 600),
        )
        for stock in stocks:
            depositos_sucursal = [
                deposito
                for deposito in depositos
                if deposito.sucursal_id == stock.sucursal_id
            ] or depositos
            for _ in range(random.randint(1, 2)):
                det = DetalleStock.objects.create(
                    stock=stock,
                    deposito=random.choice(depositos_sucursal),
                    lote=f'L{random.randint(1000, 9999)}',
                    cantidad=Decimal(random.randint(100, 300)),
                    fecha_venc=(timezone.now() + timedelta(days=random.randint(30, 365))).date(),
                )
                # `fecha_ingreso` es auto_now_add: se corrige despues de crear.
                DetalleStock.objects.filter(pk=det.pk).update(
                    fecha_ingreso=fecha_inicial
                )
                det.fecha_ingreso = fecha_inicial
                result.append(det)
            stock.cantidad = sum(
                (detalle.cantidad for detalle in stock.detalles.all()),
                Decimal('0.000'),
            )
            stock.save(update_fields=['cantidad'])
        return result

    # ------------------------------------------------------------- proveedores
    def _proveedores(self):
        nombres = [
            ('Acindar S.A.', '30711112223'),
            ('Loma Negra CIASA', '30722223334'),
            ('Weber Argentina', '30733334445'),
            ('Distribuidora Norte SRL', '30744445556'),
            ('Metalurgica Sur', '30755556667'),
            ('Sanitarios del Litoral', '30766667778'),
            ('Pinturerias Tigre S.A.', '30777778889'),
            ('Aridos Rosario SRL', '30788889990'),
        ]
        return [
            Proveedor.objects.get_or_create(
                cuit=c,
                defaults={
                    'nombre': n,
                    'razon_social': n,
                    'contacto': '3415550000',
                    'email_prov': f'ventas@{n.lower().replace(" ", "").replace(".", "")[:10]}.com',
                    'estado_prov': True,
                },
            )[0]
            for n, c in nombres
        ]

    def _proveedores_x_sucursal(self, proveedores, sucursales):
        for i, prov in enumerate(proveedores):
            ProveedorXSucursal.objects.get_or_create(
                proveedor=prov,
                sucursal=sucursales[i % len(sucursales)],
                defaults={'estado': True},
            )

    def _productos_x_proveedor(self, productos, proveedores):
        for i, prod in enumerate(productos):
            prov = proveedores[i % len(proveedores)]
            ProductoXProveedor.objects.get_or_create(
                producto=prod,
                proveedor=prov,
                defaults={
                    'codigo_producto_proveedor': f'CP{prod.codigo}',
                    'precio_lista': (prod.precio_unidad * Decimal('0.7')).quantize(Decimal('0.01')),
                    'estado': True,
                },
            )

    # ------------------------------------------------------------------- cajas
    def _cajas(self, sucursales):
        result = []
        estados = ['AC', 'AC', 'MT', 'IN']
        for suc, estado in zip(sucursales, estados):
            caja, _ = Caja.objects.get_or_create(sucursal=suc, estado=estado)
            result.append(caja)
        return result

    def _secciones(self, cajas, empleados):
        secciones = []
        ahora = timezone.now()
        for caja in cajas:
            for i in range(3):
                apertura = ahora - timedelta(days=random.randint(1, DIAS_HISTORIAL), hours=random.randint(0, 8))
                cierre = apertura + timedelta(hours=8)
                seccion, _ = SeccionCaja.objects.get_or_create(
                    caja=caja,
                    fecha_hora_apertura=apertura,
                    defaults={
                        'empleado': random.choice(empleados),
                        'fecha_hora_cierre': cierre,
                        'monto_inicial': Decimal('10000.00'),
                        'monto_final': Decimal('10000.00') + Decimal(random.randint(0, 50000)),
                        'estado': SeccionCaja.EstadoSeccion.CERRADA,
                    },
                )
                secciones.append(seccion)
        for caja in [c for c in cajas if c.estado == 'AC']:
            seccion, _ = SeccionCaja.objects.get_or_create(
                caja=caja,
                estado=SeccionCaja.EstadoSeccion.ABIERTA,
                defaults={
                    'empleado': random.choice(empleados),
                    'fecha_hora_apertura': ahora - timedelta(hours=2),
                    'monto_inicial': Decimal('15000.00'),
                },
            )
            secciones.append(seccion)
        return secciones

    # ---------------------------------------------------------------- pagos
    def _metodos_pago(self):
        return [
            MetodoPago.objects.update_or_create(
                metodo_pago=m,
                defaults={
                    'estado': True,
                    'es_efectivo': m == 'Efectivo',
                },
            )[0]
            for m in METODOS_PAGO
        ]

    def _clientes(self):
        condiciones = {
            'Consumidor Final': Cliente.CondicionIVA.CONSUMIDOR_FINAL,
            'Monotributo': Cliente.CondicionIVA.MONOTRIBUTISTA,
            'Resp. Inscripto': Cliente.CondicionIVA.RESPONSABLE_INSCRIPTO,
        }
        result = []
        for indice, (rs, cuit, iva) in enumerate(CLIENTES):
            cliente, _ = Cliente.objects.get_or_create(
                razon_social=rs,
                defaults={
                    'dni': None if cuit is None else f'20{cuit[-8:]}',
                    'tipo_documento': (
                        Cliente.TipoDocumento.CUIT if cuit else None
                    ),
                    'email': f'cliente{indice + 1}@mail.com',
                    'telefono': '3415550000',
                    'direccion': 'Calle Falsa 123',
                    'condicion_iva': condiciones.get(
                        iva,
                        Cliente.CondicionIVA.NO_CATEGORIZADO,
                    ),
                    'ingresos_brutos': None,
                    'notas': None,
                    'estado': True,
                },
            )
            result.append(cliente)
        return result

    # ------------------------------------------------------------------ ventas
    def _ventas(self, ids, cantidad):
        productos = ids['producto']
        secciones = [s for s in ids['seccion'] if s.estado == SeccionCaja.EstadoSeccion.CERRADA]
        if not secciones:
            secciones = ids['seccion']
        clientes = ids['cliente']
        metodos = ids['metodo']
        ahora = timezone.now()

        for _ in range(cantidad):
            seccion = random.choice(secciones)
            cliente = random.choice(clientes)
            estado_pago = random.choice(
                ['CONFIRMADA', 'CONFIRMADA', 'PENDIENTE_CON_PAGO', 'PENDIENTE']
            )
            fecha = ahora - timedelta(days=random.randint(0, DIAS_HISTORIAL))
            if estado_pago == 'PENDIENTE':
                # Las pendientes quedan dentro de la ventana de auto-cancelacion
                # para que el barrido no anule el historial de prueba.
                margen = max(settings.VENTAS_MINUTOS_PARA_CONFIRMAR - 5, 1)
                fecha = ahora - timedelta(minutes=random.randint(0, margen))

            venta = Venta.objects.create(
                seccion_caja=seccion,
                cliente=cliente,
                fecha_venta=fecha,
                monto_venta=Decimal('0.00'),
            )
            # `fecha_venta` es auto_now_add: se corrige despues de crear.
            Venta.objects.filter(pk=venta.pk).update(fecha_venta=fecha)
            venta.refresh_from_db()

            total = Decimal('0.00')
            vendidos = 0
            for prod in random.sample(productos, random.randint(1, 4)):
                cant = Decimal(random.randint(1, 20))
                stock = stock_service.obtener_stock(prod, seccion.caja.sucursal)
                # Si no hay stock suficiente se omite el producto: el seed tiene
                # que poder correr sobre una base con historial ya cargado.
                if stock.cantidad - cant < stock.cant_negativa_max:
                    continue

                precio = prod.precio_unidad
                subtotal = (cant * precio).quantize(Decimal('0.01'))
                DetalleVenta.objects.create(
                    venta=venta,
                    producto=prod,
                    cantidad_venta=cant,
                    precio_venta=precio,
                    subtotal=subtotal,
                )
                movimientos = stock_service.consumir_stock(
                    stock,
                    cant,
                    referencia=f'Venta {venta.pk}',
                    venta=venta,
                )
                # El movimiento nace con `auto_now_add`: se fecha con la venta.
                MovimientoStock.objects.filter(
                    pk__in=[movimiento.pk for movimiento in movimientos]
                ).update(fecha=fecha)
                total += subtotal
                vendidos += 1

            if vendidos == 0:
                # Ninguna linea tenia stock: no se deja una venta vacia.
                venta.delete()
                continue

            venta.monto_venta = total
            if estado_pago == 'CONFIRMADA':
                venta.estado = Venta.EstadoVenta.CONFIRMADA
                self._pagar(venta, total, metodos, 'venta')
            elif estado_pago == 'PENDIENTE_CON_PAGO':
                # Pago parcial: la venta sigue Pendiente hasta completar el
                # saldo y confirmarla manualmente.
                venta.estado = Venta.EstadoVenta.PENDIENTE
                self._pagar(
                    venta,
                    (total / 2).quantize(Decimal('0.01')),
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
                    defaults={'tipo': tipo, 'direccion_pdf': f'/media/facturas/{venta.pk}.pdf'},
                )

    def _pagar(self, obj, monto, metodos, tipo):
        restante = monto
        elegidos = random.sample(metodos, random.randint(1, 2))
        for i, metodo in enumerate(elegidos):
            if i == len(elegidos) - 1:
                parcial = restante
            else:
                parcial = (restante * Decimal('0.5')).quantize(Decimal('0.01'))
                restante -= parcial
            if tipo == 'venta':
                MetodoPagoXVenta.objects.create(
                    metodo_pago=metodo, venta=obj, monto_pagado=parcial
                )
            else:
                MetodoPagoXCompra.objects.create(
                    metodo_pago=metodo, compra=obj, monto_pagado=parcial
                )

    # ----------------------------------------------------------------- compras
    def _compras(self, ids, cantidad):
        secciones = ids['seccion']
        metodos = ids['metodo']
        proveedores = ids['proveedor']
        ahora = timezone.now()
        productos_por_proveedor = {}
        for asociacion in ProductoXProveedor.objects.filter(
            estado=True
        ).select_related('producto'):
            productos_por_proveedor.setdefault(
                asociacion.proveedor_id,
                [],
            ).append(asociacion.producto)
        proveedores_con_productos = [
            proveedor
            for proveedor in proveedores
            if productos_por_proveedor.get(proveedor.id)
        ]

        for _ in range(cantidad):
            if not proveedores_con_productos:
                return
            proveedor = random.choice(proveedores_con_productos)
            disponibles = productos_por_proveedor[proveedor.id]
            seccion = random.choice(secciones)
            sucursal = seccion.caja.sucursal
            fecha_compra = ahora - timedelta(days=random.randint(0, DIAS_HISTORIAL))
            fecha_recepcion = fecha_compra + timedelta(hours=2)
            deposito = stock_service.deposito_predeterminado(sucursal)
            compra = Compra.objects.create(
                seccion_caja=seccion,
                proveedor=proveedor,
                fecha_compra=fecha_compra,
                estado_entrega=Compra.EstadoEntrega.RECIBIDA,
                monto_compra=Decimal('0.00'),
            )
            # `fecha_compra` es auto_now_add: se corrige despues de crear.
            Compra.objects.filter(pk=compra.pk).update(
                fecha_compra=fecha_compra,
                fecha_recepcion=fecha_recepcion,
            )
            compra.refresh_from_db()

            total = Decimal('0.00')
            cantidad_items = random.randint(1, min(3, len(disponibles)))
            for prod in random.sample(disponibles, cantidad_items):
                cant = Decimal(random.randint(10, 100))
                precio = (prod.precio_unidad * Decimal('0.7')).quantize(Decimal('0.01'))
                subtotal = (cant * precio).quantize(Decimal('0.01'))
                DetalleCompra.objects.create(
                    compra=compra,
                    producto=prod,
                    cantidad_compra=cant,
                    precio_compra=precio,
                    subtotal=subtotal,
                )

                stock = stock_service.obtener_stock(prod, sucursal)
                detalle_stock, movimiento = stock_service.reponer_stock(
                    stock,
                    cant,
                    deposito,
                    lote=f'C{compra.pk}-{prod.pk}',
                    fecha_venc=(
                        fecha_recepcion + timedelta(days=random.randint(90, 540))
                    ).date(),
                    referencia=f'Compra {compra.pk}',
                    compra=compra,
                )
                # `fecha_ingreso` y `fecha` son auto_now_add.
                DetalleStock.objects.filter(pk=detalle_stock.pk).update(
                    fecha_ingreso=fecha_recepcion
                )
                MovimientoStock.objects.filter(pk=movimiento.pk).update(
                    fecha=fecha_recepcion
                )

                total += subtotal

            compra.monto_compra = total
            estado = random.choice(['PAGADA', 'PAGADA', 'PARCIAL', 'PENDIENTE'])
            if estado == 'PAGADA':
                compra.estado = Compra.EstadoCompra.PAGADA
                self._pagar(compra, total, metodos, 'compra')
            elif estado == 'PARCIAL':
                compra.estado = Compra.EstadoCompra.PARCIAL
                self._pagar(compra, (total / 2).quantize(Decimal('0.01')), metodos, 'compra')
            else:
                compra.estado = Compra.EstadoCompra.PENDIENTE
            compra.save()

    # ----------------------------------------------------------------- reporte
    def _reporte(self):
        self.stdout.write(self.style.SUCCESS('\nDatos cargados correctamente.\n'))
        self.stdout.write('Credenciales generadas:')
        for usuario, pwd, email, legajo, tipo in self.credenciales:
            self.stdout.write(
                f'  [{tipo:9}] usuario: {usuario:22} pass: {pwd:10} email: {email:28} legajo: {legajo}'
            )
