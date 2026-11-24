import re
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator, MinValueValidator
from django.db import models
from django.db.models.functions import Lower
from django.dispatch import receiver
from django.utils import timezone
from simple_history.models import HistoricalRecords
from simple_history.signals import pre_create_historical_record


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
    cuit = models.CharField(
        max_length=13,
        unique=True,
        validators=[MinLengthValidator(3)],
    )
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
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cuit__regex=r'^[0-9]{3,13}$'),
                name='cuit_empresa_valido',
            ),
        ]

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
    es_central = models.BooleanField(
        default=False,
        help_text='Sucursal principal de la empresa; recibe las compras por defecto.',
    )

    class Meta:
        db_table = 'SUCURSALES'
        ordering = ['nombre']
        verbose_name = 'Sucursal'
        verbose_name_plural = 'Sucursales'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa'],
                condition=models.Q(es_central=True),
                name='una_sucursal_central_por_empresa',
            ),
        ]

    def __str__(self):
        return self.nombre

    def clean(self):
        """Una empresa opera con una sola sucursal (estructura multi lista)."""
        super().clean()
        if self.empresa_id is None:
            return
        existentes = Sucursal.objects.filter(empresa_id=self.empresa_id)
        if self.pk is not None:
            existentes = existentes.exclude(pk=self.pk)
        if existentes.exists():
            raise ValidationError(
                {
                    'empresa': (
                        'La empresa ya tiene una sucursal. El sistema opera con '
                        'una sola sucursal.'
                    )
                }
            )


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
    class CodigoRol(models.TextChoices):
        ADMIN = 'AD', 'Admin'
        GERENTE = 'GE', 'Gerente'
        CAJERO = 'CA', 'Cajero'
        VENDEDOR = 'VE', 'Vendedor'
        DEPOSITO = 'ED', 'Encargado de deposito'

    ocupacion = models.CharField(max_length=50)
    codigo = models.CharField(
        max_length=2,
        choices=CodigoRol.choices,
        unique=True,
        null=True,
        blank=True,
        help_text='Rol funcional usado por los permisos de la API.',
    )
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
        on_delete=models.CASCADE,
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
        constraints = [
            models.UniqueConstraint(
                fields=['empleado', 'rol'],
                name='un_rol_por_empleado',
            ),
        ]

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
        on_delete=models.CASCADE,
        related_name='sucursales_asignadas',
    )
    fecha_asociacion = models.DateField(null=True, blank=True)
    estado = models.BooleanField(default=True)

    class Meta:
        db_table = 'SUCURSALES_X_EMPLEADOS'
        verbose_name = 'Sucursal por Empleado'
        verbose_name_plural = 'Sucursales por Empleados'
        constraints = [
            models.UniqueConstraint(
                fields=['sucursal', 'empleado'],
                name='una_sucursal_por_empleado',
            ),
        ]

    def __str__(self):
        return f'{self.sucursal} - {self.empleado}'


# =============================================================================
# CAJA — Caja, MovimientoCaja, DetalleCierreCaja
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
        help_text='Sucursal a la que pertenece la caja fisica.',
    )
    numero_caja = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text='Numero de la caja fisica dentro de la sucursal (ej. 1).',
    )
    estado = models.CharField(
        max_length=2,
        choices=EstadoCaja.choices,
        default=EstadoCaja.ACTIVA,
    )

    class Meta:
        db_table = 'CAJAS'
        ordering = ['sucursal__nombre', 'numero_caja']
        verbose_name = 'Caja'
        verbose_name_plural = 'Cajas'
        constraints = [
            models.UniqueConstraint(
                fields=['sucursal', 'numero_caja'],
                name='un_numero_de_caja_por_sucursal',
            ),
        ]

    def __str__(self):
        return f'Caja {self.numero_caja} - {self.sucursal}'


class MovimientoCaja(models.Model):
    class EstadoMovimiento(models.TextChoices):
        ABIERTA = 'AB', 'Abierta'
        PAUSADA = 'PA', 'Pausada'
        CERRADA = 'CE', 'Cerrada'
        AUDITADA = 'AU', 'Auditada'

    caja = models.ForeignKey(
        Caja,
        on_delete=models.PROTECT,
        related_name='movimientos',
    )
    empleado = models.ForeignKey(
        Empleado,
        on_delete=models.PROTECT,
        related_name='movimientos_caja',
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
    observaciones_apertura = models.TextField(
        null=True,
        blank=True,
        help_text='Motivo de la diferencia entre el monto sugerido y el informado.',
    )
    # Clave de idempotencia del cierre: un reintento no repite el arqueo.
    clave_cierre = models.CharField(
        max_length=64,
        blank=True,
        default='',
        db_index=True,
    )
    motivo_pausa = models.TextField(
        blank=True,
        default='',
        help_text='Motivo por el que el empleado dejo la seccion en pausa.',
    )
    estado = models.CharField(
        max_length=2,
        choices=EstadoMovimiento.choices,
        default=EstadoMovimiento.ABIERTA,
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'MOVIMIENTOS_CAJA'
        verbose_name = 'Movimiento de Caja'
        verbose_name_plural = 'Movimientos de Caja'
        constraints = [
            models.UniqueConstraint(
                fields=['caja'],
                condition=models.Q(estado__in=['AB', 'PA']),
                name='un_movimiento_abierto_por_caja',
            ),
            models.UniqueConstraint(
                fields=['empleado'],
                condition=models.Q(estado__in=['AB', 'PA']),
                name='un_movimiento_abierto_por_empleado',
            ),
        ]

    def __str__(self):
        return f'Movimiento {self.pk} - {self.caja}'

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.estado in (
            self.EstadoMovimiento.CERRADA,
            self.EstadoMovimiento.AUDITADA,
        ):
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
    movimiento_caja = models.ForeignKey(
        MovimientoCaja,
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
    cobrado_sistema = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    pagado_sistema = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    cobrado_real = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    pagado_real = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'DETALLES_CIERRE_CAJA'
        ordering = ['metodo_pago__metodo_pago']
        verbose_name = 'Detalle de Cierre de Caja'
        verbose_name_plural = 'Detalles de Cierre de Caja'
        constraints = [
            models.UniqueConstraint(
                fields=['movimiento_caja', 'metodo_pago'],
                name='un_metodo_por_cierre_caja',
            ),
        ]

    @property
    def diferencia(self):
        return self.monto_real - self.monto_sistema

    def __str__(self):
        return f'{self.movimiento_caja} - {self.metodo_pago}'


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
        constraints = [
            models.UniqueConstraint(
                Lower('categorias'),
                name='categoria_unica',
            ),
        ]

    def __str__(self):
        return self.categorias


class Marca(models.Model):
    marcas = models.CharField(max_length=50)

    class Meta:
        db_table = 'MARCAS'
        ordering = ['marcas']
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'
        constraints = [
            models.UniqueConstraint(
                Lower('marcas'),
                name='marca_unica',
            ),
        ]

    def __str__(self):
        return self.marcas


class Unidad(models.Model):
    unidades = models.CharField(max_length=50)
    permite_decimales = models.BooleanField(
        default=False,
        help_text='Indica si las cantidades de esta unidad admiten decimales.',
    )

    class Meta:
        db_table = 'UNIDADES'
        ordering = ['unidades']
        verbose_name = 'Unidad'
        verbose_name_plural = 'Unidades'
        constraints = [
            models.UniqueConstraint(
                Lower('unidades'),
                name='unidad_unica',
            ),
        ]

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
    precio_unidad = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
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
        constraints = [
            models.UniqueConstraint(
                Lower('codigo'),
                name='producto_codigo_unico',
            ),
            models.UniqueConstraint(
                Lower('nombre'),
                models.F('marca'),
                name='producto_nombre_marca_unico',
            ),
        ]

    def __str__(self):
        return f'{self.codigo} - {self.nombre}'


class ProductoXSucursal(models.Model):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
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
        constraints = [
            models.UniqueConstraint(
                fields=['producto', 'sucursal'],
                name='un_producto_por_sucursal',
            ),
        ]

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
            models.UniqueConstraint(
                Lower('nombre'),
                models.F('sucursal'),
                name='deposito_nombre_sucursal_unico',
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
    lote = models.CharField(max_length=30, unique=True)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    fecha_ingreso = models.DateTimeField(auto_now_add=True)
    fecha_venc = models.DateField(null=True, blank=True)
    observaciones = models.TextField(
        blank=True,
        default='',
        help_text='Observaciones del lote. La nota automática de origen es inborrable.',
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'DETALLES_DE_STOCK'
        ordering = ['stock', 'fecha_ingreso']
        verbose_name = 'Detalle de Stock'
        verbose_name_plural = 'Detalles de Stock'

    @staticmethod
    def codigo_lote(pk):
        return f'LOT-{int(pk):06d}'

    def save(self, *args, **kwargs):
        import uuid

        es_nuevo = self.pk is None
        if es_nuevo and not self.lote:
            self.lote = f'TMP-{uuid.uuid4().hex[:20]}'
        super().save(*args, **kwargs)
        if es_nuevo and str(self.lote).startswith('TMP-'):
            self.lote = self.codigo_lote(self.pk)
            super().save(update_fields=['lote'])

    def __str__(self):
        return f'{self.lote} - {self.stock}'


# =============================================================================
# PROVEEDORES — Proveedor, ProveedorXSucursal, ProductoXProveedor
# =============================================================================

class Proveedor(models.Model):
    cuit = models.CharField(
        max_length=13,
        unique=True,
        validators=[MinLengthValidator(3)],
    )
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
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cuit__regex=r'^[0-9]{3,13}$'),
                name='cuit_proveedor_valido',
            ),
        ]

    def __str__(self):
        return self.razon_social


class ProveedorXSucursal(models.Model):
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.CASCADE,
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
        constraints = [
            models.UniqueConstraint(
                fields=['proveedor', 'sucursal'],
                name='un_proveedor_por_sucursal',
            ),
        ]

    def __str__(self):
        return f'{self.proveedor} - {self.sucursal}'


class ProductoXProveedor(models.Model):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='proveedores_asociados',
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name='productos_asociados',
    )
    codigo_producto_proveedor = models.CharField(max_length=30, null=True, blank=True)
    precio_lista = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    estado = models.BooleanField(default=True)

    history = HistoricalRecords()

    class Meta:
        db_table = 'PRODUCTOS_X_PROVEEDORES'
        verbose_name = 'Producto por Proveedor'
        verbose_name_plural = 'Productos por Proveedores'
        constraints = [
            models.UniqueConstraint(
                fields=['producto', 'proveedor'],
                name='un_producto_por_proveedor',
            ),
        ]

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
    class TipoDocumento(models.TextChoices):
        DNI = 'DNI', 'DNI'
        CUIT = 'CUIT', 'CUIT'
        CUIL = 'CUIL', 'CUIL'
        PASAPORTE = 'PAS', 'Pasaporte'
        OTRO = 'OTRO', 'Otro'

    class CondicionIVA(models.TextChoices):
        RESPONSABLE_INSCRIPTO = 'RI', 'Responsable Inscripto'
        MONOTRIBUTISTA = 'MT', 'Monotributista'
        CONSUMIDOR_FINAL = 'CF', 'Consumidor Final'
        EXENTO = 'EX', 'Exento'
        NO_CATEGORIZADO = 'NC', 'No Categorizado'

    dni = models.CharField(max_length=15, unique=True, null=True, blank=True)
    tipo_documento = models.CharField(
        max_length=5,
        choices=TipoDocumento.choices,
        null=True,
        blank=True,
    )
    razon_social = models.CharField(max_length=100, null=True, blank=True)
    nombre = models.CharField(max_length=50, null=True, blank=True)
    apellido = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(max_length=80, null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    direccion = models.CharField(max_length=120, null=True, blank=True)
    condicion_iva = models.CharField(
        max_length=30,
        choices=CondicionIVA.choices,
        default=CondicionIVA.CONSUMIDOR_FINAL,
        null=True,
        blank=True,
    )
    ingresos_brutos = models.CharField(max_length=20, null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    estado = models.BooleanField(
        default=True,
        help_text='Indica si el cliente esta activo para operar.',
    )

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
        PARCIAL = 'PC', 'Parcial'
        CONFIRMADA = 'CO', 'Confirmada'
        ANULADA = 'AN', 'Anulada'

    movimiento_caja = models.ForeignKey(
        MovimientoCaja,
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
    cliente_venta = models.CharField(
        max_length=120,
        null=True,
        blank=True,
        help_text='Nombre del consumidor final cuando no se registra un cliente.',
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
    # Lotes consumidos por esta linea: [{'detalle_stock': id, 'cantidad': '...'}].
    # Permite revertir la venta sobre los mismos lotes al anularla.
    consumos = models.JSONField(
        default=list,
        blank=True,
        editable=False,
        help_text='Lotes consumidos por la linea para restaurar el stock al anular.',
    )

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
    # Caja donde se cobro realmente. Puede no ser la caja original de la
    # venta cuando el saldo de una venta PARCIAL se paga despues del cierre.
    # Queda nulo en pagos historicos anteriores a este campo.
    movimiento_caja = models.ForeignKey(
        MovimientoCaja,
        on_delete=models.PROTECT,
        related_name='pagos_venta',
        null=True,
        blank=True,
    )
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2)
    # Clave de idempotencia: si la misma operacion se reintenta, no se
    # registra el pago dos veces.
    clave = models.CharField(max_length=64, blank=True, default='', db_index=True)

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

    class EstadoEntrega(models.TextChoices):
        PENDIENTE = 'PE', 'Pendiente de recepcion'
        EN_CAMINO = 'EC', 'En camino'
        RECIBIDA = 'RE', 'Recibida'

    movimiento_caja = models.ForeignKey(
        MovimientoCaja,
        on_delete=models.PROTECT,
        related_name='compras',
    )
    # Deposito donde se repone el stock al recibir la compra.
    deposito = models.ForeignKey(
        'Deposito',
        on_delete=models.PROTECT,
        related_name='compras',
        null=True,
        blank=True,
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
    estado_entrega = models.CharField(
        max_length=2,
        choices=EstadoEntrega.choices,
        default=EstadoEntrega.PENDIENTE,
        help_text='Situacion logistica de la mercaderia.',
    )
    fecha_estimada_llegada = models.DateField(
        null=True,
        blank=True,
        help_text='Fecha estimada de llegada cuando la compra esta en camino.',
    )
    monto_compra = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(
        max_length=2,
        choices=EstadoCompra.choices,
        default=EstadoCompra.PENDIENTE,
    )
    motivo_cancelacion = models.TextField(
        blank=True,
        default='',
        help_text='Motivo obligatorio al anular la compra.',
    )

    history = HistoricalRecords()

    class Meta:
        db_table = 'COMPRAS'
        ordering = ['-fecha_compra']
        verbose_name = 'Compra'
        verbose_name_plural = 'Compras'

    def __str__(self):
        return f'Compra {self.pk} - {self.monto_compra}'

    def clean(self):
        super().clean()
        if self.fecha_estimada_llegada is None:
            return
        fecha_compra = (
            timezone.localtime(self.fecha_compra).date()
            if self.fecha_compra
            else timezone.localdate()
        )
        if self.fecha_estimada_llegada < fecha_compra:
            raise ValidationError(
                {
                    'fecha_estimada_llegada': (
                        'La fecha estimada de llegada no puede ser anterior '
                        'a la fecha de compra.'
                    )
                }
            )


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
    # Caja donde se pago realmente (mismo criterio que los pagos de venta).
    movimiento_caja = models.ForeignKey(
        MovimientoCaja,
        on_delete=models.PROTECT,
        related_name='pagos_compra',
        null=True,
        blank=True,
    )
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2)
    # Clave de idempotencia: si la misma operacion se reintenta, no se
    # registra el pago dos veces.
    clave = models.CharField(max_length=64, blank=True, default='', db_index=True)

    history = HistoricalRecords()

    class Meta:
        db_table = 'METODO_DE_PAGO_X_COMPRAS'
        verbose_name = 'Metodo de Pago por Compra'
        verbose_name_plural = 'Metodos de Pago por Compras'

    def __str__(self):
        return f'{self.metodo_pago} - Compra {self.compra_id}'


class RegistroActividad(models.Model):
    """Registro consolidado de cambios del sistema.

    Se alimenta automaticamente desde el historial de simple-history
    (pre_create_historical_record) de todos los modelos con `history = HistoricalRecords()`.
    """

    class TipoAccion(models.TextChoices):
        CREAR = 'CREAR', 'Creación'
        EDITAR = 'EDITAR', 'Edición'
        ELIMINAR = 'ELIMINAR', 'Eliminación'

    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(
        'Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registros_actividad',
    )
    modelo = models.CharField(max_length=100, blank=True)
    objeto_id = models.PositiveIntegerField(null=True, blank=True)
    objeto = models.CharField(max_length=255, blank=True)
    accion = models.CharField(
        max_length=10,
        choices=TipoAccion.choices,
        default=TipoAccion.EDITAR,
    )
    campo = models.CharField(max_length=100, blank=True, default='')
    valor_anterior = models.TextField(blank=True, default='')
    valor_nuevo = models.TextField(blank=True, default='')
    detalle = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'REGISTROS_ACTIVIDAD'
        ordering = ['-fecha']
        verbose_name = 'Registro de actividad'
        verbose_name_plural = 'Registros de actividad'

    def __str__(self):
        return f'{self.fecha} · {self.modelo} · {self.get_accion_display()}'


def _slug_modelo(nombre):
    """Convierte un nombre de modelo CamelCase a slug kebab-case.

    Ejemplos: `Producto` -> `producto`, `MovimientoCaja` -> `movimiento-caja`,
    `ProductoXProveedor` -> `producto-proveedor`.
    """
    # Separa minuscula/mayuscula y mayuscula/minuscula.
    slug = re.sub(r'([a-z0-9])([A-Z])', r'\1-\2', nombre)
    slug = re.sub(r'([A-Z])([A-Z][a-z])', r'\1-\2', slug)
    return slug.lower().replace('-x-', '-')


# Campos que no forman parte del diff legible de un cambio.
_CAMPOS_NO_DETALLE = {
    'history_id',
    'history_date',
    'history_change_reason',
    'history_type',
    'history_user',
    'password',
}


def _formatear_valor_actividad(valor):
    """Formatea un valor para mostrarlo en el detalle de actividad."""
    if valor is None or valor == '':
        return '—'
    if isinstance(valor, bool):
        return 'Sí' if valor else 'No'
    if isinstance(valor, Decimal):
        return f'{valor:.2f}'
    if hasattr(valor, 'isoformat'):
        return valor.isoformat()
    texto = str(valor)
    return texto if len(texto) <= 60 else f'{texto[:60]}…'


def _detalle_actividad(history_instance, history_type, motivo, objeto_txt):
    """Arma el resumen legible de un cambio de actividad.

    Prioriza el motivo cargado por el flujo; si no hay, para altas/bajas usa
    la etiqueta del objeto y para ediciones compara con el historico anterior
    del mismo objeto (solo los campos que cambiaron, sin datos sensibles).
    """
    if motivo:
        return motivo[:500]

    if history_type == '+':
        return f'Alta: {objeto_txt}'[:500]
    if history_type == '-':
        return f'Baja: {objeto_txt}'[:500]

    # Edicion: comparar con el ultimo historico guardado del mismo objeto.
    anterior = (
        history_instance.__class__.objects.filter(id=history_instance.id)
        .order_by('-history_date')
        .first()
    )
    if anterior is None:
        return 'Sin cambios'

    cambios = []
    for field in history_instance._meta.fields:
        nombre = field.name
        if nombre in _CAMPOS_NO_DETALLE:
            continue
        if getattr(field, 'auto_now', False) or getattr(
            field, 'auto_now_add', False
        ):
            continue
        valor_anterior = getattr(anterior, nombre, None)
        valor_nuevo = getattr(history_instance, nombre, None)
        if valor_anterior == valor_nuevo:
            continue
        etiqueta = str(field.verbose_name or nombre).replace('_', ' ')
        etiqueta = etiqueta[:1].upper() + etiqueta[1:]
        cambios.append(
            f'{etiqueta}: {_formatear_valor_actividad(valor_anterior)} → '
            f'{_formatear_valor_actividad(valor_nuevo)}'
        )
        if len(cambios) >= 5:
            break

    if not cambios:
        return 'Sin cambios'
    texto = ' · '.join(cambios)
    if len(cambios) >= 5:
        texto += ' …'
    return texto[:500]


@receiver(pre_create_historical_record)
def _registrar_actividad_desde_historial(sender, instance, **kwargs):
    """Crea un RegistroActividad cada vez que simple-history graba un cambio.

    En simple-history 3.x el signal entrega el objeto original en `instance`
    y el registro historico en `kwargs['history_instance']`. El `sender` es el
    modelo historico.
    """
    # Evitar registrar cambios del propio modelo de actividad.
    if sender.__name__ == 'HistoricalRegistroActividad':
        return

    history_instance = kwargs.get('history_instance')
    if history_instance is None:
        return

    history_type = history_instance.history_type
    if history_type is None:
        return

    modelo_nombre = sender.__name__
    if modelo_nombre.startswith('Historical'):
        modelo_nombre = modelo_nombre[len('Historical'):]
    modelo_slug = _slug_modelo(modelo_nombre)

    tipo_map = {
        '+': RegistroActividad.TipoAccion.CREAR,
        '~': RegistroActividad.TipoAccion.EDITAR,
        '-': RegistroActividad.TipoAccion.ELIMINAR,
    }

    # El pk del objeto original.
    objeto_id = getattr(instance, 'pk', None)

    # Intentar obtener una etiqueta legible del objeto.
    objeto_txt = ''
    for campo_texto in (
        'nombre', 'razon_social', 'ocupacion', 'legajo', 'cuit',
        'descripcion', 'codigo',
    ):
        valor = getattr(instance, campo_texto, None)
        if valor:
            objeto_txt = str(valor)[:255]
            break
    if not objeto_txt:
        objeto_txt = str(instance)[:255]

    detalle = _detalle_actividad(
        history_instance,
        history_type,
        kwargs.get('history_change_reason'),
        objeto_txt,
    )

    # Un guardado sin cambios reales no aporta a la auditoria.
    if history_type == '~' and detalle == 'Sin cambios':
        return

    try:
        RegistroActividad.objects.create(
            usuario=kwargs.get('history_user'),
            modelo=modelo_slug,
            objeto_id=objeto_id,
            objeto=objeto_txt,
            accion=tipo_map.get(
                history_type, RegistroActividad.TipoAccion.EDITAR
            ),
            detalle=detalle,
        )
    except Exception:
        # Nunca debe romper el flujo de la aplicacion si falla la auditoria.
        pass
