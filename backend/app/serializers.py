"""Serializers de la API.

Un serializer por modelo, agrupados por dominio con el mismo orden que
`models.py`. Las tablas puente tienen serializer propio para poder gestionarlas
desde la API sin anidar escrituras.

Los campos `*_detalle` son de solo lectura y muestran el `__str__` de la
relacion, para que el frontend no tenga que resolver cada FK por separado.
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
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
    Provincia,
    Proveedor,
    ProveedorXSucursal,
    Rol,
    SeccionCaja,
    Stock,
    Sucursal,
    SucursalXEmpleado,
    Ubicacion,
    Unidad,
    Usuario,
    Venta,
)


# =============================================================================
# GEOGRAFIA
# =============================================================================

class PaisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pais
        fields = ['id', 'nombre']


class ProvinciaSerializer(serializers.ModelSerializer):
    pais_detalle = serializers.StringRelatedField(source='pais', read_only=True)

    class Meta:
        model = Provincia
        fields = ['id', 'pais', 'pais_detalle', 'nombre']


class LocalidadSerializer(serializers.ModelSerializer):
    provincia_detalle = serializers.StringRelatedField(source='provincia', read_only=True)

    class Meta:
        model = Localidad
        fields = ['id', 'provincia', 'provincia_detalle', 'codigo_postal', 'nombre']


class UbicacionSerializer(serializers.ModelSerializer):
    localidad_detalle = serializers.StringRelatedField(source='localidad', read_only=True)

    class Meta:
        model = Ubicacion
        fields = [
            'id',
            'localidad',
            'localidad_detalle',
            'latitud',
            'longitud',
            'calle',
            'nro_calle',
        ]


# =============================================================================
# ORGANIZACION
# =============================================================================

class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = [
            'id',
            'cuit',
            'nombre',
            'razon_social',
            'email',
            'telefono',
            'ingresos_brutos',
            'fecha_inicio_act',
            'dir_fiscal',
            'condicion_iva',
        ]


class SucursalSerializer(serializers.ModelSerializer):
    empresa_detalle = serializers.StringRelatedField(source='empresa', read_only=True)
    ubicacion_detalle = serializers.StringRelatedField(source='ubicacion', read_only=True)

    class Meta:
        model = Sucursal
        fields = [
            'id',
            'empresa',
            'empresa_detalle',
            'ubicacion',
            'ubicacion_detalle',
            'nombre',
            'hora_ap',
            'hora_c',
            'contacto',
            'email_suc',
        ]


class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'},
    )
    legajo = serializers.SerializerMethodField()
    is_superuser = serializers.BooleanField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id',
            'username',
            'password',
            'email',
            'legajo',
            'is_active',
            'is_staff',
            'is_superuser',
            'last_login',
            'date_joined',
        ]
        read_only_fields = ['last_login', 'date_joined']

    def get_legajo(self, obj):
        empleado = getattr(obj, 'empleado', None)
        return empleado.legajo if empleado else None

    def validate_password(self, value):
        try:
            validate_password(value, self.instance)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError(
                {'password': 'La contrasena es obligatoria al crear un usuario.'}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        return usuario

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        usuario = super().update(instance, validated_data)
        if password:
            usuario.set_password(password)
            usuario.save(update_fields=['password'])
        return usuario


class EmpleadoSerializer(serializers.ModelSerializer):
    usuario_detalle = serializers.CharField(
        source='usuario.username',
        read_only=True,
        allow_null=True,
    )
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Empleado
        fields = [
            'id',
            'usuario',
            'usuario_detalle',
            'dni',
            'legajo',
            'nombre',
            'apellido',
            'telefono',
            'estado',
            'estado_detalle',
        ]


class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ['id', 'ocupacion', 'descripcion']


class EmpleadoXRolSerializer(serializers.ModelSerializer):
    empleado_detalle = serializers.StringRelatedField(source='empleado', read_only=True)
    rol_detalle = serializers.StringRelatedField(source='rol', read_only=True)

    class Meta:
        model = EmpleadoXRol
        fields = [
            'id',
            'empleado',
            'empleado_detalle',
            'rol',
            'rol_detalle',
            'hora_entrada',
            'hora_salida',
            'estado',
        ]


class SucursalXEmpleadoSerializer(serializers.ModelSerializer):
    sucursal_detalle = serializers.StringRelatedField(source='sucursal', read_only=True)
    empleado_detalle = serializers.StringRelatedField(source='empleado', read_only=True)

    class Meta:
        model = SucursalXEmpleado
        fields = [
            'id',
            'sucursal',
            'sucursal_detalle',
            'empleado',
            'empleado_detalle',
            'fecha_asociacion',
            'estado',
        ]


# =============================================================================
# CAJA
# =============================================================================

class CajaSerializer(serializers.ModelSerializer):
    sucursal_detalle = serializers.StringRelatedField(source='sucursal', read_only=True)
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Caja
        fields = ['id', 'sucursal', 'sucursal_detalle', 'estado', 'estado_detalle']


class DetalleCierreCajaSerializer(serializers.ModelSerializer):
    metodo_pago_detalle = serializers.StringRelatedField(
        source='metodo_pago',
        read_only=True,
    )
    diferencia = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = DetalleCierreCaja
        fields = [
            'id',
            'seccion_caja',
            'metodo_pago',
            'metodo_pago_detalle',
            'monto_sistema',
            'monto_real',
            'diferencia',
        ]


class SeccionCajaSerializer(serializers.ModelSerializer):
    caja_detalle = serializers.StringRelatedField(source='caja', read_only=True)
    empleado_detalle = serializers.StringRelatedField(source='empleado', read_only=True)
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)
    detalles_cierre = DetalleCierreCajaSerializer(many=True, read_only=True)

    class Meta:
        model = SeccionCaja
        fields = [
            'id',
            'caja',
            'caja_detalle',
            'empleado',
            'empleado_detalle',
            'fecha_hora_apertura',
            'fecha_hora_cierre',
            'monto_inicial',
            'monto_teorico',
            'monto_final',
            'observaciones',
            'estado',
            'estado_detalle',
            'detalles_cierre',
        ]


# =============================================================================
# CATALOGO
# =============================================================================

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'categorias']


class MarcaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Marca
        fields = ['id', 'marcas']


class UnidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = ['id', 'unidades']


class ProductoSerializer(serializers.ModelSerializer):
    categoria_detalle = serializers.StringRelatedField(source='categoria', read_only=True)
    marca_detalle = serializers.StringRelatedField(source='marca', read_only=True)
    unidad_detalle = serializers.StringRelatedField(source='unidad', read_only=True)

    class Meta:
        model = Producto
        # `sucursales` queda afuera: es M2M con `through=ProductoXSucursal`
        # y se gestiona con su propio endpoint.
        fields = [
            'id',
            'codigo',
            'categoria',
            'categoria_detalle',
            'marca',
            'marca_detalle',
            'unidad',
            'unidad_detalle',
            'nombre',
            'precio_unidad',
            'descripcion',
        ]


class ProductoXSucursalSerializer(serializers.ModelSerializer):
    producto_detalle = serializers.StringRelatedField(source='producto', read_only=True)
    sucursal_detalle = serializers.StringRelatedField(source='sucursal', read_only=True)

    class Meta:
        model = ProductoXSucursal
        fields = [
            'id',
            'producto',
            'producto_detalle',
            'sucursal',
            'sucursal_detalle',
            'estado',
        ]


# =============================================================================
# STOCK
# =============================================================================

class DepositoSerializer(serializers.ModelSerializer):
    sucursal_detalle = serializers.StringRelatedField(source='sucursal', read_only=True)

    class Meta:
        model = Deposito
        fields = [
            'id',
            'sucursal',
            'sucursal_detalle',
            'nombre',
            'descripcion',
            'es_predeterminado',
        ]

    def validate(self, attrs):
        es_predeterminado = attrs.get(
            'es_predeterminado',
            getattr(self.instance, 'es_predeterminado', False),
        )
        sucursal = attrs.get('sucursal', getattr(self.instance, 'sucursal', None))

        if es_predeterminado:
            if sucursal is None:
                raise serializers.ValidationError(
                    {'sucursal': 'Un deposito predeterminado debe tener sucursal.'}
                )
            existentes = Deposito.objects.filter(
                sucursal=sucursal,
                es_predeterminado=True,
            )
            if self.instance:
                existentes = existentes.exclude(pk=self.instance.pk)
            if existentes.exists():
                raise serializers.ValidationError(
                    {
                        'es_predeterminado': (
                            'Ya existe un deposito predeterminado para esta sucursal.'
                        )
                    }
                )
        return attrs


class StockSerializer(serializers.ModelSerializer):
    producto_detalle = serializers.StringRelatedField(source='producto', read_only=True)
    sucursal_detalle = serializers.StringRelatedField(source='sucursal', read_only=True)
    alerta = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = [
            'id',
            'producto',
            'producto_detalle',
            'sucursal',
            'sucursal_detalle',
            'cantidad',
            'cant_min',
            'cant_negativa_max',
            'alerta',
        ]

    def get_alerta(self, obj):
        if obj.cantidad < 0:
            return 'NEGATIVO'
        if obj.cantidad <= obj.cant_min:
            return 'MINIMO'
        return 'OK'


class DetalleStockSerializer(serializers.ModelSerializer):
    stock_detalle = serializers.StringRelatedField(source='stock', read_only=True)
    deposito_detalle = serializers.StringRelatedField(source='deposito', read_only=True)

    class Meta:
        model = DetalleStock
        fields = [
            'id',
            'stock',
            'stock_detalle',
            'deposito',
            'deposito_detalle',
            'lote',
            'cantidad',
            'fecha_ingreso',
            'fecha_venc',
        ]
        read_only_fields = ['fecha_ingreso']


# =============================================================================
# PROVEEDORES
# =============================================================================

class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = [
            'id',
            'cuit',
            'nombre',
            'razon_social',
            'contacto',
            'email_prov',
            'estado_prov',
        ]


class ProveedorXSucursalSerializer(serializers.ModelSerializer):
    proveedor_detalle = serializers.StringRelatedField(source='proveedor', read_only=True)
    sucursal_detalle = serializers.StringRelatedField(source='sucursal', read_only=True)

    class Meta:
        model = ProveedorXSucursal
        fields = [
            'id',
            'proveedor',
            'proveedor_detalle',
            'sucursal',
            'sucursal_detalle',
            'estado',
        ]


class ProductoXProveedorSerializer(serializers.ModelSerializer):
    producto_detalle = serializers.StringRelatedField(source='producto', read_only=True)
    proveedor_detalle = serializers.StringRelatedField(source='proveedor', read_only=True)

    class Meta:
        model = ProductoXProveedor
        fields = [
            'id',
            'producto',
            'producto_detalle',
            'proveedor',
            'proveedor_detalle',
            'codigo_producto_proveedor',
            'precio_lista',
            'estado',
        ]


# =============================================================================
# PAGOS
# =============================================================================

class MetodoPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetodoPago
        fields = ['id', 'metodo_pago', 'estado', 'es_efectivo']


# =============================================================================
# VENTAS
# =============================================================================

class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = [
            'id',
            'dni',
            'razon_social',
            'nombre',
            'apellido',
            'email',
            'telefono',
            'direccion',
            'condicion_iva',
        ]


class VentaSerializer(serializers.ModelSerializer):
    seccion_caja_detalle = serializers.StringRelatedField(source='seccion_caja', read_only=True)
    cliente_detalle = serializers.StringRelatedField(source='cliente', read_only=True)
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Venta
        fields = [
            'id',
            'seccion_caja',
            'seccion_caja_detalle',
            'cliente',
            'cliente_detalle',
            'fecha_venta',
            'monto_venta',
            'estado',
            'estado_detalle',
        ]
        read_only_fields = ['fecha_venta']


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_detalle = serializers.StringRelatedField(source='producto', read_only=True)

    class Meta:
        model = DetalleVenta
        fields = [
            'id',
            'venta',
            'producto',
            'producto_detalle',
            'cantidad_venta',
            'precio_venta',
            'subtotal',
        ]


class FacturaSerializer(serializers.ModelSerializer):
    tipo_detalle = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Factura
        fields = ['id', 'venta', 'tipo', 'tipo_detalle', 'fecha_emision', 'direccion_pdf']
        read_only_fields = ['fecha_emision']


class MetodoPagoXVentaSerializer(serializers.ModelSerializer):
    metodo_pago_detalle = serializers.StringRelatedField(source='metodo_pago', read_only=True)

    class Meta:
        model = MetodoPagoXVenta
        fields = ['id', 'metodo_pago', 'metodo_pago_detalle', 'venta', 'monto_pagado']


# =============================================================================
# COMPRAS
# =============================================================================

class CompraSerializer(serializers.ModelSerializer):
    seccion_caja_detalle = serializers.StringRelatedField(source='seccion_caja', read_only=True)
    proveedor_detalle = serializers.StringRelatedField(source='proveedor', read_only=True)
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)
    recibida = serializers.SerializerMethodField()

    class Meta:
        model = Compra
        fields = [
            'id',
            'seccion_caja',
            'seccion_caja_detalle',
            'proveedor',
            'proveedor_detalle',
            'fecha_compra',
            'fecha_recepcion',
            'recibida',
            'monto_compra',
            'estado',
            'estado_detalle',
        ]
        read_only_fields = ['fecha_compra', 'fecha_recepcion']

    def get_recibida(self, obj):
        return obj.fecha_recepcion is not None


class DetalleCompraSerializer(serializers.ModelSerializer):
    producto_detalle = serializers.StringRelatedField(source='producto', read_only=True)

    class Meta:
        model = DetalleCompra
        fields = [
            'id',
            'compra',
            'producto',
            'producto_detalle',
            'cantidad_compra',
            'precio_compra',
            'subtotal',
        ]


class MetodoPagoXCompraSerializer(serializers.ModelSerializer):
    metodo_pago_detalle = serializers.StringRelatedField(source='metodo_pago', read_only=True)

    class Meta:
        model = MetodoPagoXCompra
        fields = ['id', 'metodo_pago', 'metodo_pago_detalle', 'compra', 'monto_pagado']


# =============================================================================
# STOCK — MOVIMIENTOS
# =============================================================================

class MovimientoStockSerializer(serializers.ModelSerializer):
    stock_detalle = serializers.StringRelatedField(source='stock', read_only=True)
    detalle_stock_detalle = serializers.StringRelatedField(
        source='detalle_stock',
        read_only=True,
    )
    tipo_detalle = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = MovimientoStock
        fields = [
            'id',
            'stock',
            'stock_detalle',
            'detalle_stock',
            'detalle_stock_detalle',
            'tipo',
            'tipo_detalle',
            'cantidad',
            'venta',
            'compra',
            'referencia',
            'fecha',
        ]
        read_only_fields = fields
