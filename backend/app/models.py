from django.contrib.auth.models import AbstractUser
from django.db import models
from simple_history.models import HistoricalRecords


# =============================================================================
# GEOGRAFIA — Pais, Provincia, Localidad, Ubicacion
# =============================================================================

class Pais(models.Model):
    nombre = models.CharField(max_length=60, unique=True)

    class Meta:
        db_table = 'PAISES'
        ordering = ['nombre']
        verbose_name = 'Pais'
        verbose_name_plural = 'Paises'

    def __str__(self):
        return self.nombre


class Provincia(models.Model):
    pais = models.ForeignKey(
        Pais,
        on_delete=models.PROTECT,
        related_name='provincias',
    )
    nombre = models.CharField(max_length=60)

    class Meta:
        db_table = 'PROVINCIAS'
        ordering = ['nombre']
        verbose_name = 'Provincia'
        verbose_name_plural = 'Provincias'

    def __str__(self):
        return self.nombre


class Localidad(models.Model):
    provincia = models.ForeignKey(
        Provincia,
        on_delete=models.PROTECT,
        related_name='localidades',
    )
    codigo_postal = models.CharField(max_length=20, unique=True, null=True, blank=True)
    nombre = models.CharField(max_length=60)

    class Meta:
        db_table = 'LOCALIDADES'
        ordering = ['nombre']
        verbose_name = 'Localidad'
        verbose_name_plural = 'Localidades'

    def __str__(self):
        return self.nombre


class Ubicacion(models.Model):
    localidad = models.ForeignKey(
        Localidad,
        on_delete=models.PROTECT,
        related_name='ubicaciones',
    )
    latitud = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    calle = models.CharField(max_length=60, null=True, blank=True)
    nro_calle = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'UBICACIONES'
        verbose_name = 'Ubicacion'
        verbose_name_plural = 'Ubicaciones'

    def __str__(self):
        return f'{self.calle or ""} {self.nro_calle or ""}'.strip() or f'Ubicacion {self.pk}'


# =============================================================================
# ORGANIZACION — Empresa, Sucursal, Usuario, Empleado, Rol, EmpleadoXRol, SucursalXEmpleado
# =============================================================================

class Empresa(models.Model):
    cuit = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=80)
    razon_social = models.CharField(max_length=100)
    email = models.EmailField(max_length=80, null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    ingresos_brutos = models.CharField(max_length=30, null=True, blank=True)
    fecha_inicio_act = models.DateField(null=True, blank=True)
    dir_fiscal = models.CharField(max_length=120, null=True, blank=True)
    condicion_iva = models.CharField(max_length=30, default="RESPONSABLE_INSCRIPTO")

    class Meta:
        db_table = 'EMPRESAS'
        ordering = ['razon_social']
        verbose_name = 'Empresa'
        verbose_name_plural = 'Empresas'

    def __str__(self):
        return self.razon_social


class Sucursal(models.Model):
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name='sucursales',
    )
    ubicacion = models.ForeignKey(
        Ubicacion,
        on_delete=models.PROTECT,
        related_name='sucursales',
    )
    nombre = models.CharField(max_length=50)
    hora_ap = models.TimeField(null=True, blank=True)
    hora_c = models.TimeField(null=True, blank=True)
    contacto = models.CharField(max_length=30, null=True, blank=True)
    email_suc = models.EmailField(max_length=80, null=True, blank=True)

    class Meta:
        db_table = 'SUCURSALES'
        ordering = ['nombre']
        verbose_name = 'Sucursal'
        verbose_name_plural = 'Sucursales'

    def __str__(self):
        return self.nombre


class Usuario(AbstractUser):
    # Datos de login unicamente. La informacion personal/laboral vive en Empleado.
    # Se eliminan los campos heredados que no se usan.
    first_name = None
    last_name = None

    history = HistoricalRecords(excluded_fields=['password'])

    class Meta:
        db_table = 'USUARIOS'
        ordering = ['username']
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def get_full_name(self):
        return self.username

    def get_short_name(self):
        return self.username

    def __str__(self):
        return self.username


class Empleado(models.Model):
    class EstadoEmpleado(models.TextChoices):
        ACTIVO = 'AC', 'Activo'
        BAJA_TEMPORAL = 'BT', 'Baja temporal'
        SUSPENDIDO = 'SU', 'Suspendido'
        INACTIVO = 'IN', 'Inactivo'

    usuario = models.OneToOneField(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='empleado',
    )
    dni = models.CharField(max_length=15, unique=True)
    legajo = models.CharField(max_length=15, unique=True)
    nombre = models.CharField(max_length=50)
    apellido = models.CharField(max_length=50)
    telefono = models.CharField(max_length=30, null=True, blank=True)
    estado = models.CharField(
        max_length=2,
        choices=EstadoEmpleado.choices,
        default=EstadoEmpleado.ACTIVO,
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'EMPLEADOS'
        ordering = ['apellido', 'nombre']
        verbose_name = 'Empleado'
        verbose_name_plural = 'Empleados'

    def __str__(self):
        return f'{self.apellido}, {self.nombre}'


class Rol(models.Model):
    ocupacion = models.CharField(max_length=50)
    descripcion = models.CharField(max_length=150, null=True, blank=True)

    class Meta:
        db_table = 'ROLES'
        ordering = ['ocupacion']
        verbose_name = 'Rol'
        verbose_name_plural = 'Roles'

    def __str__(self):
        return self.ocupacion


class EmpleadoXRol(models.Model):
    empleado = models.ForeignKey(
        Empleado,
        on_delete=models.PROTECT,
        related_name='roles_asignados',
    )
    rol = models.ForeignKey(
        Rol,
        on_delete=models.PROTECT,
        related_name='empleados_asignados',
    )
    hora_entrada = models.TimeField(null=True, blank=True)
    hora_salida = models.TimeField(null=True, blank=True)
    estado = models.CharField(
        max_length=2,
        choices=[
            ('AC', 'Activo'),
            ('BT', 'Baja temporal'),
            ('SU', 'Suspendido'),
            ('IN', 'Inactivo'),
        ],
        default='AC',
    )

    class Meta:
        db_table = 'EMPLEADOS_X_ROLES'
        verbose_name = 'Empleado por Rol'
        verbose_name_plural = 'Empleados por Roles'

    def __str__(self):
        return f'{self.empleado} - {self.rol}'


class SucursalXEmpleado(models.Model):
    sucursal = models.ForeignKey(
        Sucursal,
        on_delete=models.PROTECT,
        related_name='empleados_asignados',
    )
    empleado = models.ForeignKey(
        Empleado,
        on_delete=models.PROTECT,
        related_name='sucursales_asignadas',
    )
    fecha_asociacion = models.DateField(null=True, blank=True)
    estado = models.BooleanField(default=True)

    class Meta:
        db_table = 'SUCURSALES_X_EMPLEADOS'
        verbose_name = 'Sucursal por Empleado'
        verbose_name_plural = 'Sucursales por Empleados'

    def __str__(self):
        return f'{self.sucursal} - {self.empleado}'


# =============================================================================
# CAJA — Caja, SeccionCaja
# =============================================================================

class Caja(models.Model):
    class EstadoCaja(models.TextChoices):
        ACTIVA = 'AC', 'Activa'
        INACTIVA = 'IN', 'Inactiva'
        MANTENIMIENTO = 'MT', 'En mantenimiento'

    sucursal = models.ForeignKey(
        Sucursal,
        on_delete=models.PROTECT,
        related_name='cajas',
    )
    estado = models.CharField(
        max_length=2,
        choices=EstadoCaja.choices,
        default=EstadoCaja.ACTIVA,
    )

    class Meta:
        db_table = 'CAJAS'
        verbose_name = 'Caja'
        verbose_name_plural = 'Cajas'

    def __str__(self):
        return f'Caja {self.pk} - {self.sucursal}'


class SeccionCaja(models.Model):
    class EstadoSeccion(models.TextChoices):
        ABIERTA = 'AB', 'Abierta'
        CERRADA = 'CE', 'Cerrada'
        AUDITADA = 'AU', 'Auditada'

    caja = models.ForeignKey(
        Caja,
        on_delete=models.PROTECT,
        related_name='secciones',
    )
    empleado = models.ForeignKey(
        Empleado,
        on_delete=models.PROTECT,
        related_name='secciones_caja',
    )
    fecha_hora_apertura = models.DateTimeField()
    fecha_hora_cierre = models.DateTimeField(null=True, blank=True)
    monto_inicial = models.DecimalField(max_digits=10, decimal_places=2)
    monto_final = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    monto_teorico = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Total calculado por el sistema al cerrar la seccion.',
    )
    observaciones = models.TextField(
        null=True,
        blank=True,
        help_text='Detalle u observaciones del cierre.',
    )
    estado = models.CharField(
        max_length=2,
        choices=EstadoSeccion.choices,
        default=EstadoSeccion.ABIERTA,
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'SECCIONES_CAJA'
        verbose_name = 'Seccion de Caja'
        verbose_name_plural = 'Secciones de Caja'

    def __str__(self):
        return f'Seccion {self.pk} - {self.caja}'

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.estado in (self.EstadoSeccion.CERRADA, self.EstadoSeccion.AUDITADA):
            if self.monto_final is None:
                raise ValidationError(
                    {'monto_final': 'Debe registrar el monto final al cerrar la seccion.'}
                )
            if self.fecha_hora_cierre is None:
                raise ValidationError(
                    {'fecha_hora_cierre': 'Debe registrar la fecha y hora de cierre.'}
                )
        if (
            self.fecha_hora_cierre is not None
            and self.fecha_hora_apertura is not None
            and self.fecha_hora_cierre < self.fecha_hora_apertura
        ):
            raise ValidationError(
                {'fecha_hora_cierre': 'El cierre no puede ser anterior a la apertura.'}
            )


class DetalleCierreCaja(models.Model):
    seccion_caja = models.ForeignKey(
        SeccionCaja,
        on_delete=models.CASCADE,
        related_name='detalles_cierre',
    )
    metodo_pago = models.ForeignKey(
        'MetodoPago',
        on_delete=models.PROTECT,
        related_name='detalles_cierre',
    )
    monto_sistema = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monto_real = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    history = HistoricalRecords()

    class Meta:
        db_table = 'DETALLES_CIERRE_CAJA'
        ordering = ['metodo_pago__metodo_pago']
        verbose_name = 'Detalle de Cierre de Caja'
        verbose_name_plural = 'Detalles de Cierre de Caja'
        constraints = [
            models.UniqueConstraint(
                fields=['seccion_caja', 'metodo_pago'],
                name='un_metodo_por_cierre_caja',
            ),
        ]

    @property
    def diferencia(self):
        return self.monto_real - self.monto_sistema

    def __str__(self):
        return f'{self.seccion_caja} - {self.metodo_pago}'


# =============================================================================
# CATALOGO — Categoria, Marca, Unidad, Producto, ProductoXSucursal
# =============================================================================

class Categoria(models.Model):
    categorias = models.CharField(max_length=50)

    class Meta:
        db_table = 'CATEGORIAS'
        ordering = ['categorias']
        verbose_name = 'Categoria'
        verbose_name_plural = 'Categorias'

    def __str__(self):
        return self.categorias


class Marca(models.Model):
    marcas = models.CharField(max_length=50)

    class Meta:
        db_table = 'MARCAS'
        ordering = ['marcas']
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'

    def __str__(self):
        return self.marcas


class Unidad(models.Model):
    unidades = models.CharField(max_length=50)

    class Meta:
        db_table = 'UNIDADES'
        ordering = ['unidades']
        verbose_name = 'Unidad'
        verbose_name_plural = 'Unidades'

    def __str__(self):
        return self.unidades


class Producto(models.Model):
    codigo = models.CharField(max_length=30, unique=True)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name='productos',
    )
    marca = models.ForeignKey(
        Marca,
        on_delete=models.PROTECT,
        related_name='productos',
    )
    unidad = models.ForeignKey(
        Unidad,
        on_delete=models.PROTECT,
        related_name='productos',
    )
    nombre = models.CharField(max_length=80)
    precio_unidad = models.DecimalField(max_digits=10, decimal_places=2)
    descripcion = models.CharField(max_length=150, null=True, blank=True)
    sucursales = models.ManyToManyField(
        Sucursal,
        through='ProductoXSucursal',
        related_name='productos',
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'PRODUCTOS'
        ordering = ['nombre']
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'

    def __str__(self):
        return f'{self.codigo} - {self.nombre}'


class ProductoXSucursal(models.Model):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='sucursales_asociadas',
    )
    sucursal = models.ForeignKey(
        Sucursal,
        on_delete=models.PROTECT,
        related_name='productos_asociados',
    )
    estado = models.BooleanField(default=True)

    class Meta:
        db_table = 'PRODUCTOSXSUCURSALES'
        verbose_name = 'Producto por Sucursal'
        verbose_name_plural = 'Productos por Sucursales'

    def __str__(self):
        return f'{self.producto} - {self.sucursal}'


# =============================================================================
# STOCK — Deposito, Stock, DetalleStock
# =============================================================================

class Deposito(models.Model):
    sucursal = models.ForeignKey(
        Sucursal,
        on_delete=models.PROTECT,
        related_name='depositos',
        null=True,
        blank=True,
        help_text='Sucursal a la que pertenece el deposito.',
    )
    nombre = models.CharField(max_length=50)
    descripcion = models.CharField(max_length=150, null=True, blank=True)
    es_predeterminado = models.BooleanField(
        default=False,
        help_text='Deposito donde se reciben las compras de la sucursal.',
    )

    class Meta:
        db_table = 'DEPOSITOS'
        ordering = ['nombre']
        verbose_name = 'Deposito'
        verbose_name_plural = 'Depositos'
        constraints = [
            models.UniqueConstraint(
                fields=['sucursal'],
                condition=models.Q(es_predeterminado=True),
                name='un_deposito_predeterminado_por_sucursal',
            ),
        ]

    def __str__(self):
        return self.nombre


class Stock(models.Model):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='stocks',
    )
    sucursal = models.ForeignKey(
        Sucursal,
        on_delete=models.PROTECT,
        related_name='stocks',
    )
    # Total del stock: suma de las cantidades de sus DetalleStock.
    # Lo mantiene services/stock.py dentro de la misma transaccion.
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    cant_min = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    cant_negativa_max = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=-10,
        help_text='Limite negativo permitido antes de bloquear ventas.',
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'STOCKS'
        ordering = ['producto__nombre', 'sucursal__nombre']
        verbose_name = 'Stock'
        verbose_name_plural = 'Stocks'
        constraints = [
            models.UniqueConstraint(
                fields=['producto', 'sucursal'],
                name='un_stock_por_producto_y_sucursal',
            ),
        ]

    def __str__(self):
        return f'{self.producto} en {self.sucursal}'


class DetalleStock(models.Model):
    stock = models.ForeignKey(
        Stock,
        on_delete=models.CASCADE,
        related_name='detalles',
    )
    deposito = models.ForeignKey(
        Deposito,
        on_delete=models.PROTECT,
        related_name='detalles_stock',
    )
    lote = models.CharField(max_length=30, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    fecha_ingreso = models.DateTimeField(auto_now_add=True)
    fecha_venc = models.DateField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = 'DETALLES_DE_STOCK'
        ordering = ['stock', 'fecha_ingreso']
        verbose_name = 'Detalle de Stock'
        verbose_name_plural = 'Detalles de Stock'

    def __str__(self):
        return f'Detalle {self.pk} - {self.stock}'


# =============================================================================
# PROVEEDORES — Proveedor, ProveedorXSucursal, ProductoXProveedor
# =============================================================================

class Proveedor(models.Model):
    cuit = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=80)
    razon_social = models.CharField(max_length=100)
    contacto = models.CharField(max_length=30, null=True, blank=True)
    email_prov = models.EmailField(max_length=80, null=True, blank=True)
    estado_prov = models.BooleanField(default=True)

    history = HistoricalRecords()

    class Meta:
        db_table = 'PROVEEDORES'
        ordering = ['razon_social']
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'

    def __str__(self):
        return self.razon_social


class ProveedorXSucursal(models.Model):
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name='sucursales_asociadas',
    )
    sucursal = models.ForeignKey(
        Sucursal,
        on_delete=models.PROTECT,
        related_name='proveedores_asociados',
    )
    estado = models.BooleanField(default=True)

    class Meta:
        db_table = 'PROVEEDORES_X_SUCURSALES'
        verbose_name = 'Proveedor por Sucursal'
        verbose_name_plural = 'Proveedores por Sucursales'

    def __str__(self):
        return f'{self.proveedor} - {self.sucursal}'


class ProductoXProveedor(models.Model):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='proveedores_asociados',
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name='productos_asociados',
    )
    codigo_producto_proveedor = models.CharField(max_length=30, null=True, blank=True)
    precio_lista = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.BooleanField(default=True)

    class Meta:
        db_table = 'PRODUCTOS_X_PROVEEDORES'
        verbose_name = 'Producto por Proveedor'
        verbose_name_plural = 'Productos por Proveedores'

    def __str__(self):
        return f'{self.producto} - {self.proveedor}'


# =============================================================================
# PAGOS — MetodoPago
# =============================================================================

class MetodoPago(models.Model):
    metodo_pago = models.CharField(max_length=30)
    estado = models.BooleanField(default=True)
    es_efectivo = models.BooleanField(
        default=False,
        help_text='Marca el metodo que afecta el efectivo inicial de la caja.',
    )

    class Meta:
        db_table = 'METODO_DE_PAGO'
        ordering = ['metodo_pago']
        verbose_name = 'Metodo de Pago'
        verbose_name_plural = 'Metodos de Pago'

    def __str__(self):
        return self.metodo_pago


# =============================================================================
# VENTAS — Cliente, Venta, DetalleVenta, Factura, MetodoPagoXVenta
# =============================================================================

class Cliente(models.Model):
    dni = models.CharField(max_length=15, unique=True, null=True, blank=True)
    razon_social = models.CharField(max_length=100, null=True, blank=True)
    nombre = models.CharField(max_length=50, null=True, blank=True)
    apellido = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(max_length=80, null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    direccion = models.CharField(max_length=120, null=True, blank=True)
    condicion_iva = models.CharField(max_length=30, null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = 'CLIENTES'
        ordering = ['apellido', 'nombre']
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'

    def __str__(self):
        return self.razon_social or f'{self.apellido or ""}, {self.nombre or ""}'.strip() or f'Cliente {self.pk}'


class Venta(models.Model):
    class EstadoVenta(models.TextChoices):
        PENDIENTE = 'PE', 'Pendiente'
        CONFIRMADA = 'CO', 'Confirmada'
        PAGADA = 'PA', 'Pagada'
        PARCIAL = 'PC', 'Parcial'
        ANULADA = 'AN', 'Anulada'

    seccion_caja = models.ForeignKey(
        SeccionCaja,
        on_delete=models.PROTECT,
        related_name='ventas',
    )
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ventas',
    )
    fecha_venta = models.DateTimeField(auto_now_add=True)
    monto_venta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(
        max_length=2,
        choices=EstadoVenta.choices,
        default=EstadoVenta.PENDIENTE,
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'VENTAS'
        ordering = ['-fecha_venta']
        verbose_name = 'Venta'
        verbose_name_plural = 'Ventas'

    def __str__(self):
        return f'Venta {self.pk} - {self.monto_venta}'


class DetalleVenta(models.Model):
    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name='detalles',
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_venta',
    )
    cantidad_venta = models.DecimalField(max_digits=12, decimal_places=3)
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    history = HistoricalRecords()

    class Meta:
        db_table = 'DETALLES_DE_VENTAS'
        verbose_name = 'Detalle de Venta'
        verbose_name_plural = 'Detalles de Ventas'

    def __str__(self):
        return f'Detalle {self.pk} - {self.producto}'


class Factura(models.Model):
    class TipoFactura(models.TextChoices):
        A = 'A', 'Factura A'
        B = 'B', 'Factura B'
        C = 'C', 'Factura C'
        E = 'E', 'Factura E'
        NC = 'NC', 'Nota de Credito'
        ND = 'ND', 'Nota de Debito'

    venta = models.ForeignKey(
        Venta,
        on_delete=models.PROTECT,
        related_name='facturas',
    )
    tipo = models.CharField(max_length=2, choices=TipoFactura.choices)
    fecha_emision = models.DateTimeField(auto_now_add=True)
    direccion_pdf = models.CharField(max_length=255, null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = 'FACTURAS'
        ordering = ['-fecha_emision']
        verbose_name = 'Factura'
        verbose_name_plural = 'Facturas'

    def __str__(self):
        return f'{self.get_tipo_display()} - Venta {self.venta_id}'


class MetodoPagoXVenta(models.Model):
    metodo_pago = models.ForeignKey(
        MetodoPago,
        on_delete=models.PROTECT,
        related_name='pagos_ventas',
    )
    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name='pagos',
    )
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2)

    history = HistoricalRecords()

    class Meta:
        db_table = 'METODO_DE_PAGO_X_VENTAS'
        verbose_name = 'Metodo de Pago por Venta'
        verbose_name_plural = 'Metodos de Pago por Ventas'

    def __str__(self):
        return f'{self.metodo_pago} - Venta {self.venta_id}'


# =============================================================================
# COMPRAS — Compra, DetalleCompra, MetodoPagoXCompra
# =============================================================================

class Compra(models.Model):
    class EstadoCompra(models.TextChoices):
        PENDIENTE = 'PE', 'Pendiente'
        PAGADA = 'PA', 'Pagada'
        PARCIAL = 'PC', 'Parcial'
        ANULADA = 'AN', 'Anulada'

    seccion_caja = models.ForeignKey(
        SeccionCaja,
        on_delete=models.PROTECT,
        related_name='compras',
    )
    # Nullable para no romper compras historicas; los servicios exigen
    # proveedor en toda compra nueva.
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name='compras',
        null=True,
        blank=True,
    )
    fecha_compra = models.DateTimeField(auto_now_add=True)
    fecha_recepcion = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Cuando se recibio la mercaderia y se repuso el stock.',
    )
    monto_compra = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(
        max_length=2,
        choices=EstadoCompra.choices,
        default=EstadoCompra.PENDIENTE,
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'COMPRAS'
        ordering = ['-fecha_compra']
        verbose_name = 'Compra'
        verbose_name_plural = 'Compras'

    def __str__(self):
        return f'Compra {self.pk} - {self.monto_compra}'


class DetalleCompra(models.Model):
    compra = models.ForeignKey(
        Compra,
        on_delete=models.CASCADE,
        related_name='detalles',
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_compra',
    )
    cantidad_compra = models.DecimalField(max_digits=12, decimal_places=3)
    precio_compra = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    history = HistoricalRecords()

    class Meta:
        db_table = 'DETALLES_DE_COMPRAS'
        verbose_name = 'Detalle de Compra'
        verbose_name_plural = 'Detalles de Compras'

    def __str__(self):
        return f'Detalle {self.pk} - {self.producto}'


class MetodoPagoXCompra(models.Model):
    metodo_pago = models.ForeignKey(
        MetodoPago,
        on_delete=models.PROTECT,
        related_name='pagos_compras',
    )
    compra = models.ForeignKey(
        Compra,
        on_delete=models.CASCADE,
        related_name='pagos',
    )
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2)

    history = HistoricalRecords()

    class Meta:
        db_table = 'METODO_DE_PAGO_X_COMPRAS'
        verbose_name = 'Metodo de Pago por Compra'
        verbose_name_plural = 'Metodos de Pago por Compras'

    def __str__(self):
        return f'{self.metodo_pago} - Compra {self.compra_id}'


# =============================================================================
# STOCK — MovimientoStock (libro de movimientos)
# =============================================================================

class MovimientoStock(models.Model):
    class TipoMovimiento(models.TextChoices):
        VENTA = 'VE', 'Venta'
        CANCELACION = 'CA', 'Cancelacion de venta'
        COMPRA = 'CO', 'Compra'
        AJUSTE = 'AJ', 'Ajuste'

    stock = models.ForeignKey(
        Stock,
        on_delete=models.CASCADE,
        related_name='movimientos',
    )
    detalle_stock = models.ForeignKey(
        DetalleStock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos',
    )
    tipo = models.CharField(max_length=2, choices=TipoMovimiento.choices)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    venta = models.ForeignKey(
        Venta,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_stock',
    )
    compra = models.ForeignKey(
        Compra,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_stock',
    )
    referencia = models.CharField(max_length=100, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    history = HistoricalRecords()

    class Meta:
        db_table = 'MOVIMIENTOS_STOCK'
        ordering = ['-fecha', '-id']
        verbose_name = 'Movimiento de Stock'
        verbose_name_plural = 'Movimientos de Stock'

    def __str__(self):
        return f'{self.get_tipo_display()} {self.cantidad} - {self.stock}'
