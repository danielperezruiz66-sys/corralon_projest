"""Serializers de la API.

Un serializer por modelo, agrupados por dominio con el mismo orden que
`models.py`. Las tablas puente tienen serializer propio para poder gestionarlas
desde la API sin anidar escrituras.

Los campos `*_detalle` son de solo lectura y muestran el `__str__` de la
relacion, para que el frontend no tenga que resolver cada FK por separado.
"""

import re
from decimal import Decimal

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
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
    TransferenciaStock,
    Ubicacion,
    Unidad,
    Usuario,
    Venta,
)
from .utils import (
    validar_cantidad_por_unidad,
    validar_ingresos_brutos,
    validar_nombre_consumidor,
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
            'es_central',
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
    codigo_detalle = serializers.CharField(source='get_codigo_display', read_only=True)

    class Meta:
        model = Rol
        fields = ['id', 'ocupacion', 'codigo', 'codigo_detalle', 'descripcion']


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
    sucursal = serializers.IntegerField(source='caja.sucursal_id', read_only=True)
    sucursal_detalle = serializers.StringRelatedField(
        source='caja.sucursal',
        read_only=True,
    )
    empleado_detalle = serializers.StringRelatedField(source='empleado', read_only=True)
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)
    detalles_cierre = DetalleCierreCajaSerializer(many=True, read_only=True)

    class Meta:
        model = SeccionCaja
        fields = [
            'id',
            'caja',
            'caja_detalle',
            'sucursal',
            'sucursal_detalle',
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


class AperturaCajaSerializer(serializers.Serializer):
    caja = serializers.PrimaryKeyRelatedField(queryset=Caja.objects.all())
    monto_inicial = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.00'),
    )
    # Solo un administrador puede abrir la caja a nombre de otro empleado.
    empleado = serializers.PrimaryKeyRelatedField(
        queryset=Empleado.objects.all(),
        required=False,
        allow_null=True,
    )


class CierreCajaSerializer(serializers.Serializer):
    montos_reales = serializers.DictField(
        child=serializers.DecimalField(
            max_digits=12,
            decimal_places=2,
            min_value=Decimal('0.00'),
        ),
        allow_empty=False,
    )
    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate_montos_reales(self, value):
        ids = []
        for clave in value:
            try:
                ids.append(int(clave))
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    f'El metodo de pago "{clave}" no es valido.'
                )

        existentes = set(
            MetodoPago.objects.filter(pk__in=ids).values_list('pk', flat=True)
        )
        faltantes = set(ids) - existentes
        if faltantes:
            raise serializers.ValidationError(
                f'No existe el metodo de pago {sorted(faltantes)[0]}.'
            )
        return value


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
    sucursales = serializers.PrimaryKeyRelatedField(
        queryset=Sucursal.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )
    sucursales_activas = serializers.SerializerMethodField()
    sucursales_detalle = serializers.SerializerMethodField()
    costo_max = serializers.SerializerMethodField()
    margen = serializers.SerializerMethodField()
    proveedor = serializers.PrimaryKeyRelatedField(
        queryset=Proveedor.objects.filter(estado_prov=True),
        write_only=True,
        required=False,
        allow_null=True,
    )
    precio_lista = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        write_only=True,
        required=False,
        allow_null=True,
    )
    codigo_producto_proveedor = serializers.CharField(
        max_length=30,
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = Producto
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
            'sucursales',
            'sucursales_activas',
            'sucursales_detalle',
            'costo_max',
            'margen',
            'proveedor',
            'precio_lista',
            'codigo_producto_proveedor',
        ]

    def get_sucursales_activas(self, obj):
        return [
            asociacion.sucursal_id
            for asociacion in obj.sucursales_asociadas.all()
            if asociacion.estado
        ]

    def get_sucursales_detalle(self, obj):
        return [
            str(asociacion.sucursal)
            for asociacion in obj.sucursales_asociadas.all()
            if asociacion.estado
        ]

    def get_costo_max(self, obj):
        costos = [
            asociacion.precio_lista
            for asociacion in obj.proveedores_asociados.all()
            if asociacion.estado
        ]
        return str(max(costos)) if costos else None

    def get_margen(self, obj):
        costos = [
            asociacion.precio_lista
            for asociacion in obj.proveedores_asociados.all()
            if asociacion.estado
        ]
        if not costos:
            return None
        return str(obj.precio_unidad - max(costos))

    def validate_precio_unidad(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'El precio unitario debe ser mayor que cero.'
            )
        return value

    def validate(self, attrs):
        sucursales = attrs.get('sucursales')
        if self.instance is None and not sucursales:
            raise serializers.ValidationError(
                {
                    'sucursales': (
                        'Seleccioná al menos una sucursal para el producto.'
                    )
                }
            )
        if self.instance is not None and sucursales is not None and not sucursales:
            raise serializers.ValidationError(
                {
                    'sucursales': (
                        'El producto debe tener al menos una sucursal activa.'
                    )
                }
            )
        if self.instance is not None and sucursales is not None:
            seleccionadas = {sucursal.id for sucursal in sucursales}
            activas_actuales = set(
                self.instance.sucursales_asociadas.filter(
                    estado=True,
                ).values_list('sucursal_id', flat=True)
            )
            a_desactivar = activas_actuales - seleccionadas
            if a_desactivar:
                con_stock = Stock.objects.filter(
                    producto=self.instance,
                    sucursal_id__in=a_desactivar,
                ).exclude(cantidad=0)
                if con_stock.exists():
                    nombres = ', '.join(
                        str(stock.sucursal) for stock in con_stock[:3]
                    )
                    raise serializers.ValidationError(
                        {
                            'sucursales': (
                                'No podés quitar el producto de sucursales con '
                                f'stock registrado ({nombres}). Dejá el stock '
                                'en cero antes de desactivarlo.'
                            )
                        }
                    )

        precio = attrs.get('precio_unidad')
        proveedor = attrs.get('proveedor')
        precio_lista = attrs.get('precio_lista')
        if self.instance is None:
            errores = {}
            if proveedor is None:
                errores['proveedor'] = 'Seleccioná un proveedor.'
            if precio_lista is None:
                errores['precio_lista'] = 'Indicá el precio de costo.'
            if errores:
                raise serializers.ValidationError(errores)
        elif (proveedor is None) != (precio_lista is None):
            raise serializers.ValidationError(
                {
                    'proveedor': (
                        'Indicá el proveedor y el precio de costo juntos.'
                    )
                }
            )
        elif (
            self.instance is not None
            and proveedor is None
            and not self.instance.proveedores_asociados.filter(
                estado=True,
            ).exists()
        ):
            raise serializers.ValidationError(
                {
                    'proveedor': (
                        'El producto debe tener un proveedor y un precio de '
                        'costo.'
                    )
                }
            )

        precio_venta = (
            precio
            if precio is not None
            else getattr(self.instance, 'precio_unidad', None)
        )
        if (
            precio_lista is not None
            and precio_venta is not None
            and precio_lista >= precio_venta
        ):
            raise serializers.ValidationError(
                {
                    'precio_lista': (
                        'El precio de costo debe ser menor al precio de '
                        f'venta del producto ({precio_venta}).'
                    )
                }
            )

        if (
            self.instance is not None
            and precio is not None
        ):
            costo_max = self.instance.proveedores_asociados.filter(
                estado=True,
            ).aggregate(maximo=Max('precio_lista'))['maximo']
            if costo_max is not None and precio <= costo_max:
                raise serializers.ValidationError(
                    {
                        'precio_unidad': (
                            'El precio de venta debe ser mayor al precio de '
                            f'costo del proveedor ({costo_max}).'
                        )
                    }
                )
        return attrs

    def create(self, validated_data):
        proveedor = validated_data.pop('proveedor', None)
        precio_lista = validated_data.pop('precio_lista', None)
        codigo_proveedor = validated_data.pop(
            'codigo_producto_proveedor',
            None,
        )
        sucursales = validated_data.pop('sucursales', [])
        with transaction.atomic():
            producto = super().create(validated_data)
            ProductoXSucursal.objects.bulk_create(
                [
                    ProductoXSucursal(
                        producto=producto,
                        sucursal=sucursal,
                        estado=True,
                    )
                    for sucursal in sucursales
                ]
            )
            if proveedor is not None and precio_lista is not None:
                ProductoXProveedor.objects.create(
                    producto=producto,
                    proveedor=proveedor,
                    precio_lista=precio_lista,
                    codigo_producto_proveedor=codigo_proveedor or None,
                    estado=True,
                )
        producto._prefetched_objects_cache = {}
        return producto

    def update(self, instance, validated_data):
        proveedor = validated_data.pop('proveedor', None)
        precio_lista = validated_data.pop('precio_lista', None)
        codigo_proveedor = validated_data.pop(
            'codigo_producto_proveedor',
            None,
        )
        sucursales = validated_data.pop('sucursales', None)
        with transaction.atomic():
            producto = super().update(instance, validated_data)
            if sucursales is not None:
                seleccionadas = {sucursal.id for sucursal in sucursales}
                producto.sucursales_asociadas.exclude(
                    sucursal_id__in=seleccionadas,
                ).update(estado=False)
                for sucursal in sucursales:
                    ProductoXSucursal.objects.update_or_create(
                        producto=producto,
                        sucursal=sucursal,
                        defaults={'estado': True},
                    )
            if proveedor is not None and precio_lista is not None:
                asociacion = producto.proveedores_asociados.filter(
                    proveedor=proveedor,
                ).first()
                if asociacion is None:
                    ProductoXProveedor.objects.create(
                        producto=producto,
                        proveedor=proveedor,
                        precio_lista=precio_lista,
                        codigo_producto_proveedor=codigo_proveedor or None,
                        estado=True,
                    )
                else:
                    asociacion.precio_lista = precio_lista
                    asociacion.codigo_producto_proveedor = (
                        codigo_proveedor or None
                    )
                    asociacion.estado = True
                    asociacion.save(
                        update_fields=[
                            'precio_lista',
                            'codigo_producto_proveedor',
                            'estado',
                        ]
                    )
        producto._prefetched_objects_cache = {}
        return producto


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

    def validate(self, attrs):
        estado = attrs.get(
            'estado',
            getattr(self.instance, 'estado', True),
        )
        producto = attrs.get(
            'producto',
            getattr(self.instance, 'producto', None),
        )
        sucursal = attrs.get(
            'sucursal',
            getattr(self.instance, 'sucursal', None),
        )
        if not estado:
            if producto is not None:
                otras = ProductoXSucursal.objects.filter(
                    producto=producto,
                    estado=True,
                )
                if self.instance is not None:
                    otras = otras.exclude(pk=self.instance.pk)
                if not otras.exists():
                    raise serializers.ValidationError(
                        {
                            'estado': (
                                'El producto debe tener al menos una sucursal '
                                'activa.'
                            )
                        }
                    )
            if producto is not None and sucursal is not None:
                stock = Stock.objects.filter(
                    producto=producto,
                    sucursal=sucursal,
                ).first()
                if stock is not None and stock.cantidad != 0:
                    raise serializers.ValidationError(
                        {
                            'estado': (
                                'No podés desactivar el producto en esta '
                                'sucursal porque tiene stock registrado. '
                                'Dejá el stock en cero antes de desactivarlo.'
                            )
                        }
                    )
        return attrs


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
        if sucursal is None:
            raise serializers.ValidationError(
                {'sucursal': 'El depósito debe pertenecer a una sucursal.'}
            )

        if es_predeterminado:
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
    producto_unidad_detalle = serializers.StringRelatedField(
        source='producto.unidad',
        read_only=True,
    )
    sucursal_detalle = serializers.StringRelatedField(source='sucursal', read_only=True)
    alerta = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = [
            'id',
            'producto',
            'producto_detalle',
            'producto_unidad_detalle',
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


class StockConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = ['cant_min', 'cant_negativa_max']

    def validate_cant_min(self, value):
        if value < 0:
            raise serializers.ValidationError(
                'El stock minimo no puede ser negativo.'
            )
        return value

    def validate_cant_negativa_max(self, value):
        if value > 0:
            raise serializers.ValidationError(
                'El limite negativo no puede ser mayor que cero.'
            )
        return value


class AjusteStockReduccionSerializer(serializers.Serializer):
    detalle = serializers.PrimaryKeyRelatedField(
        queryset=DetalleStock.objects.select_related('stock', 'deposito'),
    )
    cantidad_nueva = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal('0.000'),
    )


class AjusteStockIngresoSerializer(serializers.Serializer):
    deposito = serializers.PrimaryKeyRelatedField(
        queryset=Deposito.objects.select_related('sucursal'),
    )
    cantidad = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
    )
    fecha_venc = serializers.DateField(required=False, allow_null=True)


class AjusteStockSerializer(serializers.Serializer):
    """Ajuste detallado de stock por lote.

    - `reducciones`: fija la cantidad resultante de lotes existentes
      (0 <= cantidad_nueva <= cantidad actual del lote).
    - `ingresos`: crea nuevos lotes en depósitos de la sucursal.
    """

    motivo = serializers.CharField(max_length=90, min_length=3)
    reducciones = AjusteStockReduccionSerializer(many=True, required=False)
    ingresos = AjusteStockIngresoSerializer(many=True, required=False)

    def validate(self, attrs):
        stock = self.context.get('stock')
        reducciones = attrs.get('reducciones') or []
        ingresos = attrs.get('ingresos') or []

        if not reducciones and not ingresos:
            raise serializers.ValidationError(
                'Indicá al menos una reducción por lote o un ingreso de stock.'
            )

        if stock is None:
            return attrs

        nombre_unidad = str(getattr(stock.producto, 'unidad', '') or '')
        vistos_detalles = set()

        for item in reducciones:
            detalle = item['detalle']
            cantidad_nueva = item['cantidad_nueva']

            if detalle.pk in vistos_detalles:
                raise serializers.ValidationError(
                    {
                        'reducciones': (
                            f'El lote "{detalle.lote}" está repetido en el ajuste.'
                        )
                    }
                )
            vistos_detalles.add(detalle.pk)

            if detalle.stock_id != stock.id:
                raise serializers.ValidationError(
                    {
                        'reducciones': (
                            f'El lote "{detalle.lote}" no pertenece a este stock.'
                        )
                    }
                )
            if detalle.deposito.sucursal_id != stock.sucursal_id:
                raise serializers.ValidationError(
                    {
                        'reducciones': (
                            f'El lote "{detalle.lote}" no pertenece a la sucursal del stock.'
                        )
                    }
                )

            error_cantidad = validar_cantidad_por_unidad(
                cantidad_nueva,
                nombre_unidad,
                etiqueta='La cantidad del lote',
                permitir_no_positiva=True,
            )
            if error_cantidad:
                raise serializers.ValidationError(
                    {'reducciones': error_cantidad}
                )
            if cantidad_nueva > detalle.cantidad:
                raise serializers.ValidationError(
                    {
                        'reducciones': (
                            f'La cantidad nueva del lote "{detalle.lote}" no puede ser '
                            f'mayor a su stock actual ({detalle.cantidad}).'
                        )
                    }
                )

        for item in ingresos:
            deposito = item['deposito']
            cantidad = item['cantidad']

            error_cantidad = validar_cantidad_por_unidad(
                cantidad,
                nombre_unidad,
                etiqueta='La cantidad a ingresar',
            )
            if error_cantidad:
                raise serializers.ValidationError({'ingresos': error_cantidad})
            if deposito.sucursal_id != stock.sucursal_id:
                raise serializers.ValidationError(
                    {
                        'ingresos': (
                            'El depósito de ingreso debe pertenecer a la sucursal del stock.'
                        )
                    }
                )

        return attrs


class CargaStockItemSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.all(),
    )
    cantidad = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal('0.001'),
    )
    fecha_venc = serializers.DateField(
        required=False,
        allow_null=True,
    )


class CargaStockSerializer(serializers.Serializer):
    sucursal = serializers.PrimaryKeyRelatedField(
        queryset=Sucursal.objects.all(),
    )
    deposito = serializers.PrimaryKeyRelatedField(
        queryset=Deposito.objects.all(),
    )
    motivo = serializers.CharField(max_length=90, min_length=3)
    items = CargaStockItemSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        if attrs['deposito'].sucursal_id != attrs['sucursal'].id:
            raise serializers.ValidationError(
                {
                    'deposito': (
                        'El depósito debe pertenecer a la sucursal elegida.'
                    )
                }
            )
        ids = [item['producto'].pk for item in attrs['items']]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(
                {'items': 'No repitas el mismo producto en la carga.'}
            )
        for indice, item in enumerate(attrs.get('items') or [], start=1):
            producto = item.get('producto')
            cantidad = item.get('cantidad')
            if producto is None or cantidad is None:
                continue
            nombre_unidad = str(getattr(producto, 'unidad', '') or '')
            error_cantidad = validar_cantidad_por_unidad(
                cantidad,
                nombre_unidad,
                etiqueta=f'La cantidad del ítem {indice}',
            )
            if error_cantidad:
                raise serializers.ValidationError({'items': error_cantidad})
        return attrs


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
            'observaciones',
        ]
        read_only_fields = [
            'id',
            'stock',
            'stock_detalle',
            'deposito',
            'deposito_detalle',
            'lote',
            'cantidad',
            'fecha_ingreso',
        ]


def _nota_automatica_detalle(observaciones):
    texto = str(observaciones or '')
    if not texto.startswith('Transferido de '):
        return ''
    # La nota automática es la primera línea generada por el sistema.
    return texto.split('\n', 1)[0].strip()


class DetalleStockUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleStock
        fields = ['fecha_venc', 'observaciones']
        extra_kwargs = {
            'fecha_venc': {'required': False, 'allow_null': True},
            'observaciones': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        if self.instance is None:
            return attrs
        nueva_obs = attrs.get('observaciones')
        if nueva_obs is not None:
            automatica = _nota_automatica_detalle(self.instance.observaciones)
            if automatica:
                texto = str(nueva_obs or '').strip()
                if not texto.startswith(automatica):
                    raise serializers.ValidationError(
                        {
                            'observaciones': (
                                'La nota automática de origen no se puede modificar ni eliminar.'
                            )
                        }
                    )
        return attrs


class TransferenciaStockSerializer(serializers.ModelSerializer):
    producto_detalle = serializers.StringRelatedField(
        source='producto',
        read_only=True,
    )
    deposito_origen_detalle = serializers.StringRelatedField(
        source='deposito_origen',
        read_only=True,
    )
    deposito_destino_detalle = serializers.StringRelatedField(
        source='deposito_destino',
        read_only=True,
    )
    sucursal_origen_detalle = serializers.CharField(
        source='deposito_origen.sucursal.nombre',
        read_only=True,
    )
    sucursal_destino_detalle = serializers.CharField(
        source='deposito_destino.sucursal.nombre',
        read_only=True,
    )
    estado_detalle = serializers.CharField(
        source='get_estado_display',
        read_only=True,
    )
    lote_origen = serializers.CharField(source='lote', read_only=True)
    detalle_origen_detalle = serializers.StringRelatedField(
        source='detalle_origen',
        read_only=True,
    )
    lote_destino = serializers.SerializerMethodField()
    observaciones_destino = serializers.SerializerMethodField()

    class Meta:
        model = TransferenciaStock
        fields = [
            'id',
            'producto',
            'producto_detalle',
            'stock_origen',
            'deposito_origen',
            'deposito_origen_detalle',
            'sucursal_origen_detalle',
            'deposito_destino',
            'deposito_destino_detalle',
            'sucursal_destino_detalle',
            'detalle_origen',
            'detalle_origen_detalle',
            'cantidad',
            'lote',
            'lote_origen',
            'lote_destino',
            'observaciones_destino',
            'estado',
            'estado_detalle',
            'motivo',
            'fecha_creacion',
            'fecha_recepcion',
            'fecha_cancelacion',
        ]
        read_only_fields = [
            'producto',
            'stock_origen',
            'deposito_origen',
            'detalle_origen',
            'lote',
            'estado',
            'fecha_creacion',
            'fecha_recepcion',
            'fecha_cancelacion',
        ]

    def _detalle_destino(self, obj):
        if obj.estado != TransferenciaStock.EstadoTransferencia.RECIBIDA:
            return None
        if hasattr(obj, '_detalle_destino_cache'):
            return obj._detalle_destino_cache
        movimiento = (
            MovimientoStock.objects.select_related('detalle_stock')
            .filter(
                referencia=f'transferencia:{obj.id}',
                tipo=MovimientoStock.TipoMovimiento.TRANSFERENCIA,
                cantidad__gt=0,
                detalle_stock__deposito_id=obj.deposito_destino_id,
            )
            .order_by('-id')
            .first()
        )
        obj._detalle_destino_cache = (
            movimiento.detalle_stock if movimiento else None
        )
        return obj._detalle_destino_cache

    def get_lote_destino(self, obj):
        detalle = self._detalle_destino(obj)
        return detalle.lote if detalle else None

    def get_observaciones_destino(self, obj):
        detalle = self._detalle_destino(obj)
        return detalle.observaciones if detalle else ''


class TransferenciaStockCreateSerializer(serializers.Serializer):
    detalle_origen = serializers.PrimaryKeyRelatedField(
        queryset=DetalleStock.objects.select_related(
            'stock__producto__unidad',
            'deposito__sucursal',
        ),
    )
    deposito_destino = serializers.PrimaryKeyRelatedField(
        queryset=Deposito.objects.all(),
    )
    cantidad = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal('0.001'),
    )
    motivo = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        detalle = attrs['detalle_origen']
        deposito_destino = attrs['deposito_destino']
        cantidad = attrs['cantidad']

        if detalle.cantidad <= 0:
            raise serializers.ValidationError(
                {'detalle_origen': 'El lote de origen no tiene stock disponible.'}
            )
        if detalle.deposito_id == deposito_destino.id:
            raise serializers.ValidationError(
                'El deposito de origen y destino deben ser distintos.'
            )
        if cantidad > detalle.cantidad:
            raise serializers.ValidationError(
                {
                    'cantidad': (
                        'La cantidad supera el disponible del lote '
                        f'({detalle.cantidad}).'
                    )
                }
            )
        producto = detalle.stock.producto
        nombre_unidad = str(getattr(producto, 'unidad', '') or '')
        error_cantidad = validar_cantidad_por_unidad(
            cantidad,
            nombre_unidad,
            etiqueta='La cantidad a transferir',
        )
        if error_cantidad:
            raise serializers.ValidationError({'cantidad': error_cantidad})
        return attrs


# =============================================================================
# PROVEEDORES
# =============================================================================

class ProveedorSerializer(serializers.ModelSerializer):
    sucursales = serializers.PrimaryKeyRelatedField(
        queryset=Sucursal.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )
    sucursales_activas = serializers.SerializerMethodField()
    sucursales_detalle = serializers.SerializerMethodField()

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
            'sucursales',
            'sucursales_activas',
            'sucursales_detalle',
        ]

    def to_internal_value(self, data):
        datos = data.copy()
        if datos.get('cuit'):
            datos['cuit'] = re.sub(r'[.\-\s]', '', str(datos['cuit']))
        return super().to_internal_value(datos)

    def get_sucursales_activas(self, obj):
        return [
            asociacion.sucursal_id
            for asociacion in obj.sucursales_asociadas.all()
            if asociacion.estado
        ]

    def get_sucursales_detalle(self, obj):
        return [
            str(asociacion.sucursal)
            for asociacion in obj.sucursales_asociadas.all()
            if asociacion.estado
        ]

    def validate_cuit(self, value):
        cuit = re.sub(r'[.\-\s]', '', value or '')
        if not re.fullmatch(r'\d{11}', cuit):
            raise serializers.ValidationError(
                'El CUIT debe tener 11 números, sin letras ni símbolos.'
            )
        return cuit

    def validate_contacto(self, value):
        contacto = (value or '').strip()
        if not contacto:
            return value
        if not re.fullmatch(r'[0-9+()\s-]{6,20}', contacto):
            raise serializers.ValidationError(
                'El contacto solo puede tener números, espacios, +, - y '
                'paréntesis (mínimo 6 números).'
            )
        return contacto

    def validate(self, attrs):
        sucursales = attrs.get('sucursales')
        if self.instance is None and not sucursales:
            raise serializers.ValidationError(
                {
                    'sucursales': (
                        'Seleccioná al menos una sucursal para el proveedor.'
                    )
                }
            )
        if self.instance is not None and sucursales is not None and not sucursales:
            raise serializers.ValidationError(
                {
                    'sucursales': (
                        'El proveedor debe tener al menos una sucursal activa.'
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        sucursales = validated_data.pop('sucursales', [])
        proveedor = super().create(validated_data)
        ProveedorXSucursal.objects.bulk_create(
            [
                ProveedorXSucursal(
                    proveedor=proveedor,
                    sucursal=sucursal,
                    estado=True,
                )
                for sucursal in sucursales
            ]
        )
        return proveedor

    def update(self, instance, validated_data):
        sucursales = validated_data.pop('sucursales', None)
        proveedor = super().update(instance, validated_data)
        if sucursales is not None:
            seleccionadas = {sucursal.id for sucursal in sucursales}
            proveedor.sucursales_asociadas.exclude(
                sucursal_id__in=seleccionadas,
            ).update(estado=False)
            for sucursal in sucursales:
                ProveedorXSucursal.objects.update_or_create(
                    proveedor=proveedor,
                    sucursal=sucursal,
                    defaults={'estado': True},
                )
        proveedor._prefetched_objects_cache = {}
        return proveedor


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

    def validate(self, attrs):
        estado = attrs.get(
            'estado',
            getattr(self.instance, 'estado', True),
        )
        if not estado:
            proveedor = attrs.get(
                'proveedor',
                getattr(self.instance, 'proveedor', None),
            )
            if proveedor is not None:
                otras = ProveedorXSucursal.objects.filter(
                    proveedor=proveedor,
                    estado=True,
                )
                if self.instance is not None:
                    otras = otras.exclude(pk=self.instance.pk)
                if not otras.exists():
                    raise serializers.ValidationError(
                        {
                            'estado': (
                                'El proveedor debe tener al menos una '
                                'sucursal activa.'
                            )
                        }
                    )
        return attrs


class ProductoXProveedorSerializer(serializers.ModelSerializer):
    producto_detalle = serializers.StringRelatedField(source='producto', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_categoria = serializers.IntegerField(
        source='producto.categoria_id',
        read_only=True,
    )
    producto_categoria_detalle = serializers.CharField(
        source='producto.categoria.categorias',
        read_only=True,
    )
    producto_marca_detalle = serializers.CharField(
        source='producto.marca.marcas',
        read_only=True,
    )
    producto_unidad_detalle = serializers.CharField(
        source='producto.unidad.unidades',
        read_only=True,
    )
    producto_precio_unidad = serializers.DecimalField(
        source='producto.precio_unidad',
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    proveedor_detalle = serializers.StringRelatedField(source='proveedor', read_only=True)
    proveedor_cuit = serializers.CharField(source='proveedor.cuit', read_only=True)
    precio_lista = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )

    class Meta:
        model = ProductoXProveedor
        fields = [
            'id',
            'producto',
            'producto_detalle',
            'producto_codigo',
            'producto_nombre',
            'producto_categoria',
            'producto_categoria_detalle',
            'producto_marca_detalle',
            'producto_unidad_detalle',
            'producto_precio_unidad',
            'proveedor',
            'proveedor_detalle',
            'proveedor_cuit',
            'codigo_producto_proveedor',
            'precio_lista',
            'estado',
        ]

    def validate(self, attrs):
        producto = attrs.get(
            'producto',
            getattr(self.instance, 'producto', None),
        )
        precio_lista = attrs.get(
            'precio_lista',
            getattr(self.instance, 'precio_lista', None),
        )
        estado = attrs.get(
            'estado',
            getattr(self.instance, 'estado', True),
        )
        if (
            estado
            and producto is not None
            and precio_lista is not None
            and producto.precio_unidad <= precio_lista
        ):
            raise serializers.ValidationError(
                {
                    'precio_lista': (
                        'El precio de costo debe ser menor al precio de venta '
                        f'del producto ({producto.precio_unidad}).'
                    )
                }
            )
        return attrs


class ProductoXProveedorBulkItemSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.all(),
    )
    precio_lista = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    codigo_producto_proveedor = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate(self, attrs):
        producto = attrs['producto']
        precio = attrs['precio_lista']
        if precio >= producto.precio_unidad:
            raise serializers.ValidationError(
                {
                    'precio_lista': (
                        'El precio de costo debe ser menor al precio de venta '
                        f'del producto ({producto.precio_unidad}).'
                    )
                }
            )
        return attrs


class ProductoXProveedorBulkSerializer(serializers.Serializer):
    items = ProductoXProveedorBulkItemSerializer(
        many=True,
        allow_empty=False,
    )

    def validate(self, attrs):
        ids = [item['producto'].pk for item in attrs['items']]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(
                {'items': 'No repitas el mismo producto.'}
            )
        return attrs


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
    condicion_iva_detalle = serializers.CharField(
        source='get_condicion_iva_display',
        read_only=True,
    )
    tipo_documento_detalle = serializers.CharField(
        source='get_tipo_documento_display',
        read_only=True,
    )

    class Meta:
        model = Cliente
        fields = [
            'id',
            'dni',
            'tipo_documento',
            'tipo_documento_detalle',
            'razon_social',
            'nombre',
            'apellido',
            'email',
            'telefono',
            'direccion',
            'condicion_iva',
            'condicion_iva_detalle',
            'ingresos_brutos',
            'notas',
            'estado',
        ]

    def to_internal_value(self, data):
        datos = data.copy()
        tipo = datos.get('tipo_documento') or getattr(
            self.instance,
            'tipo_documento',
            None,
        )
        if tipo in ('DNI', 'CUIT', 'CUIL') and datos.get('dni'):
            datos['dni'] = re.sub(r'[.\-\s]', '', str(datos['dni']))
        return super().to_internal_value(datos)

    def validate(self, attrs):
        def valor(campo):
            if campo in attrs:
                return attrs.get(campo)
            if self.instance is not None:
                return getattr(self.instance, campo, None)
            return None

        razon_social = (valor('razon_social') or '').strip()
        nombre = (valor('nombre') or '').strip()
        apellido = (valor('apellido') or '').strip()
        dni = (valor('dni') or '').strip()
        tipo_documento = valor('tipo_documento')
        if tipo_documento in ('DNI', 'CUIT', 'CUIL'):
            dni = re.sub(r'[.\-\s]', '', dni)
            if 'dni' in attrs:
                attrs['dni'] = dni
        email = (valor('email') or '').strip()
        telefono = (valor('telefono') or '').strip()
        condicion_iva = valor('condicion_iva')

        errores = {}
        if not razon_social and not (nombre and apellido):
            errores['razon_social'] = (
                'Ingresá la razón social o el nombre y apellido completos.'
            )
        if not tipo_documento:
            errores['tipo_documento'] = 'Seleccioná el tipo de documento.'
        if not dni:
            errores['dni'] = 'Ingresá el DNI/CUIT.'
        elif tipo_documento == 'DNI' and not re.fullmatch(r'\d{7,8}', dni):
            errores['dni'] = (
                'El DNI debe tener 7 u 8 números, sin letras ni símbolos.'
            )
        elif tipo_documento in ('CUIT', 'CUIL') and not re.fullmatch(
            r'\d{11}',
            dni,
        ):
            errores['dni'] = (
                'El CUIT/CUIL debe tener 11 números, sin letras ni símbolos.'
            )
        elif tipo_documento == 'PAS' and not re.fullmatch(
            r'[A-Za-z0-9]{5,20}',
            dni,
        ):
            errores['dni'] = (
                'El pasaporte debe tener entre 5 y 20 letras o números.'
            )
        elif tipo_documento == 'OTRO' and not re.fullmatch(
            r'[A-Za-z0-9-]{3,20}',
            dni,
        ):
            errores['dni'] = (
                'Ingresá un documento válido de 3 a 20 caracteres.'
            )
        if not email and not telefono:
            errores['telefono'] = 'Ingresá un teléfono o un email.'
        elif telefono and not re.fullmatch(r'[0-9+()\s-]{6,20}', telefono):
            errores['telefono'] = (
                'El teléfono solo puede tener números, espacios, +, - y '
                'paréntesis (mínimo 6 números).'
            )

        ingresos = valor('ingresos_brutos')
        error_ingresos = validar_ingresos_brutos(ingresos)
        if error_ingresos:
            errores['ingresos_brutos'] = error_ingresos

        if self.instance is None and not condicion_iva:
            attrs['condicion_iva'] = Cliente.CondicionIVA.CONSUMIDOR_FINAL
        elif not condicion_iva:
            errores['condicion_iva'] = 'Seleccioná la condición IVA.'

        if errores:
            raise serializers.ValidationError(errores)
        return attrs


class ClienteEstadoSerializer(serializers.Serializer):
    estado = serializers.BooleanField()


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


class MetodoPagoXVentaSerializer(serializers.ModelSerializer):
    metodo_pago_detalle = serializers.StringRelatedField(source='metodo_pago', read_only=True)

    class Meta:
        model = MetodoPagoXVenta
        fields = ['id', 'metodo_pago', 'metodo_pago_detalle', 'venta', 'monto_pagado']


class VentaSerializer(serializers.ModelSerializer):
    seccion_caja_detalle = serializers.StringRelatedField(source='seccion_caja', read_only=True)
    cliente_detalle = serializers.StringRelatedField(source='cliente', read_only=True)
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    pagos = MetodoPagoXVentaSerializer(many=True, read_only=True)

    class Meta:
        model = Venta
        fields = [
            'id',
            'seccion_caja',
            'seccion_caja_detalle',
            'cliente',
            'cliente_detalle',
            'cliente_venta',
            'fecha_venta',
            'monto_venta',
            'estado',
            'estado_detalle',
            'detalles',
            'pagos',
        ]
        read_only_fields = ['fecha_venta']


class FacturaSerializer(serializers.ModelSerializer):
    tipo_detalle = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Factura
        fields = ['id', 'venta', 'tipo', 'tipo_detalle', 'fecha_emision', 'direccion_pdf']
        read_only_fields = ['fecha_emision']


class VentaItemSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    cantidad = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal('0.001'),
    )
    precio = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=False,
        allow_null=True,
    )


class VentaCreateSerializer(serializers.Serializer):
    seccion_caja = serializers.PrimaryKeyRelatedField(queryset=SeccionCaja.objects.all())
    cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        required=False,
        allow_null=True,
    )
    cliente_venta = serializers.CharField(
        max_length=120,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    items = VentaItemSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        errores = {}
        if attrs.get('cliente') and attrs.get('cliente_venta'):
            errores['cliente_venta'] = (
                'El nombre libre es solo para consumidor final. '
                'Quitalo o elegi un cliente registrado.'
            )
        elif not attrs.get('cliente') and attrs.get('cliente_venta'):
            error_consumidor = validar_nombre_consumidor(attrs.get('cliente_venta'))
            if error_consumidor:
                errores['cliente_venta'] = error_consumidor
            else:
                attrs['cliente_venta'] = str(attrs.get('cliente_venta')).strip()

        for indice, item in enumerate(attrs.get('items') or [], start=1):
            producto = item.get('producto')
            cantidad = item.get('cantidad')
            if producto is None or cantidad is None:
                continue
            nombre_unidad = str(getattr(producto, 'unidad', '') or '')
            error_cantidad = validar_cantidad_por_unidad(
                cantidad,
                nombre_unidad,
                etiqueta=f'La cantidad del ítem {indice}',
            )
            if error_cantidad:
                errores['items'] = error_cantidad
                break

        if errores:
            raise serializers.ValidationError(errores)
        return attrs


class PagoVentaCreateSerializer(serializers.Serializer):
    venta = serializers.PrimaryKeyRelatedField(queryset=Venta.objects.all())
    metodo_pago = serializers.PrimaryKeyRelatedField(queryset=MetodoPago.objects.all())
    monto_pagado = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )


class PagoVentaItemSerializer(serializers.Serializer):
    metodo_pago = serializers.PrimaryKeyRelatedField(queryset=MetodoPago.objects.all())
    monto_pagado = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )


class CobroVentaSerializer(serializers.Serializer):
    pagos = PagoVentaItemSerializer(many=True, allow_empty=False)
    confirmar = serializers.BooleanField(required=False, default=False)


class VentaCancelarSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200, min_length=3)

    def validate_motivo(self, value):
        texto = str(value or '').strip()
        if len(texto) < 3:
            raise serializers.ValidationError(
                'El motivo debe tener al menos 3 caracteres.'
            )
        return texto


# =============================================================================
# COMPRAS
# =============================================================================

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


class CompraSerializer(serializers.ModelSerializer):
    seccion_caja_detalle = serializers.StringRelatedField(source='seccion_caja', read_only=True)
    proveedor_detalle = serializers.StringRelatedField(source='proveedor', read_only=True)
    estado_detalle = serializers.CharField(source='get_estado_display', read_only=True)
    estado_entrega_detalle = serializers.CharField(
        source='get_estado_entrega_display',
        read_only=True,
    )
    recibida = serializers.SerializerMethodField()
    detalles = DetalleCompraSerializer(many=True, read_only=True)
    pagos = MetodoPagoXCompraSerializer(many=True, read_only=True)

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
            'estado_entrega',
            'estado_entrega_detalle',
            'fecha_estimada_llegada',
            'recibida',
            'monto_compra',
            'estado',
            'estado_detalle',
            'motivo_cancelacion',
            'detalles',
            'pagos',
        ]
        read_only_fields = [
            'fecha_compra',
            'fecha_recepcion',
            'motivo_cancelacion',
        ]

    def get_recibida(self, obj):
        return obj.estado_entrega == Compra.EstadoEntrega.RECIBIDA


class CompraItemSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    cantidad = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal('0.001'),
    )
    precio = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )


class CompraCreateSerializer(serializers.Serializer):
    seccion_caja = serializers.PrimaryKeyRelatedField(queryset=SeccionCaja.objects.all())
    proveedor = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all())
    estado_entrega = serializers.ChoiceField(
        choices=[
            Compra.EstadoEntrega.PENDIENTE,
            Compra.EstadoEntrega.EN_CAMINO,
        ],
        required=False,
        default=Compra.EstadoEntrega.PENDIENTE,
    )
    fecha_estimada_llegada = serializers.DateField(
        required=False,
        allow_null=True,
    )
    items = CompraItemSerializer(many=True, allow_empty=False)

    def validate_fecha_estimada_llegada(self, value):
        if value is not None and value < timezone.localdate():
            raise serializers.ValidationError(
                'La fecha estimada de llegada no puede ser anterior a la '
                'fecha de compra.'
            )
        return value

    def validate(self, attrs):
        if (
            attrs.get('estado_entrega') == Compra.EstadoEntrega.EN_CAMINO
            and not attrs.get('fecha_estimada_llegada')
        ):
            raise serializers.ValidationError(
                {
                    'fecha_estimada_llegada': (
                        'Indicá la fecha estimada de llegada para una compra '
                        'en camino.'
                    )
                }
            )

        proveedor = attrs.get('proveedor')
        items = attrs.get('items') or []
        if proveedor is not None and items:
            habilitados = set(
                ProductoXProveedor.objects.filter(
                    proveedor=proveedor,
                    estado=True,
                ).values_list('producto_id', flat=True)
            )
            invalidos = [
                item['producto'].nombre
                for item in items
                if item['producto'].pk not in habilitados
            ]
            if invalidos:
                raise serializers.ValidationError(
                    {
                        'items': (
                            'Los siguientes productos no están asociados al '
                            'proveedor seleccionado: '
                            f'{", ".join(invalidos)}.'
                        )
                    }
                )

        for indice, item in enumerate(items, start=1):
            producto = item.get('producto')
            cantidad = item.get('cantidad')
            if producto is None or cantidad is None:
                continue
            nombre_unidad = str(getattr(producto, 'unidad', '') or '')
            error_cantidad = validar_cantidad_por_unidad(
                cantidad,
                nombre_unidad,
                etiqueta=f'La cantidad del ítem {indice}',
            )
            if error_cantidad:
                raise serializers.ValidationError({'items': error_cantidad})
        return attrs


class AnularCompraSerializer(serializers.Serializer):
    motivo = serializers.CharField(
        max_length=500,
        allow_blank=False,
    )


class CompraEnCaminoSerializer(serializers.Serializer):
    fecha_estimada_llegada = serializers.DateField(
        required=False,
        allow_null=True,
    )

    def validate_fecha_estimada_llegada(self, value):
        if value is None:
            return value
        compra = self.context.get('compra')
        fecha_compra = (
            timezone.localtime(compra.fecha_compra).date()
            if compra is not None and compra.fecha_compra
            else timezone.localdate()
        )
        if value < fecha_compra:
            raise serializers.ValidationError(
                'La fecha estimada de llegada no puede ser anterior a la '
                'fecha de compra.'
            )
        return value


class CompraRecepcionSerializer(serializers.Serializer):
    deposito = serializers.PrimaryKeyRelatedField(
        queryset=Deposito.objects.all(),
        required=False,
        allow_null=True,
    )


class PagoCompraCreateSerializer(serializers.Serializer):
    compra = serializers.PrimaryKeyRelatedField(queryset=Compra.objects.all())
    metodo_pago = serializers.PrimaryKeyRelatedField(queryset=MetodoPago.objects.all())
    monto_pagado = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )


class PagoCompraItemSerializer(serializers.Serializer):
    metodo_pago = serializers.PrimaryKeyRelatedField(queryset=MetodoPago.objects.all())
    monto_pagado = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )


class PagoCompraMultipleSerializer(serializers.Serializer):
    pagos = PagoCompraItemSerializer(many=True, allow_empty=False)


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
