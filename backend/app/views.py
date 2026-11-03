"""Viewsets de la API.

Un viewset por modelo, agrupados por dominio con el mismo orden que `models.py`.

Regla de escritura:

- Catalogos y datos maestros: CRUD completo, limitado por rol.
- `Stock` y `DetalleStock`: solo lectura. Se modifican desde los servicios de
  stock (ventas/compras), no con un PUT directo.
- `Venta`, `Compra`, `Factura` y pagos: lectura general; la escritura pasa por
  acciones que delegan en `services/`.
- `SeccionCaja`: se abre, cierra y audita con acciones; no se edita a mano.

Los permisos de escritura se declaran por viewset en `roles_escritura`
(ver `app/permissions.py`).
"""

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from . import serializers
from .models import (
    Caja,
    Categoria,
    Cliente,
    Compra,
    Deposito,
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
from .permissions import (
    ADMIN,
    CAJERO,
    DEPOSITO,
    GERENTE,
    GESTION,
    PermisoPorRol,
    VENDEDOR,
    codigos_activos,
    es_admin,
)
from .services import caja as caja_service
from .services import compras as compras_service
from .services import pagos as pagos_service
from .services import ventas as ventas_service


# =============================================================================
# PERFIL
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def perfil(request):
    """Datos del usuario autenticado y sus roles, para que el cliente arme el menu."""
    empleado = getattr(request.user, 'empleado', None)
    roles = []
    if empleado is not None:
        roles = [
            {
                'id': asignacion.rol_id,
                'codigo': asignacion.rol.codigo,
                'ocupacion': asignacion.rol.ocupacion,
            }
            for asignacion in empleado.roles_asignados.filter(
                estado='AC',
                rol__codigo__isnull=False,
            ).select_related('rol')
        ]

    return Response(
        {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'is_superuser': request.user.is_superuser,
            'empleado': (
                {
                    'id': empleado.id,
                    'legajo': empleado.legajo,
                    'nombre': empleado.nombre,
                    'apellido': empleado.apellido,
                }
                if empleado is not None
                else None
            ),
            'roles': roles,
            'codigos': sorted(str(codigo) for codigo in codigos_activos(request.user)),
        }
    )


def _empleado_de(user):
    empleado = getattr(user, 'empleado', None)
    if empleado is None:
        raise ValueError(
            'El usuario autenticado no tiene un empleado asociado. '
            'Asociele un empleado antes de operar la caja.'
        )
    return empleado


# =============================================================================
# GEOGRAFIA
# =============================================================================

class PaisViewSet(viewsets.ModelViewSet):
    queryset = Pais.objects.all()
    serializer_class = serializers.PaisSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['nombre']
    search_fields = ['nombre']
    ordering_fields = ['nombre']


class ProvinciaViewSet(viewsets.ModelViewSet):
    queryset = Provincia.objects.select_related('pais')
    serializer_class = serializers.ProvinciaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['pais']
    search_fields = ['nombre', 'pais__nombre']
    ordering_fields = ['nombre']


class LocalidadViewSet(viewsets.ModelViewSet):
    queryset = Localidad.objects.select_related('provincia__pais')
    serializer_class = serializers.LocalidadSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['provincia', 'codigo_postal']
    search_fields = ['nombre', 'codigo_postal', 'provincia__nombre']
    ordering_fields = ['nombre', 'codigo_postal']


class UbicacionViewSet(viewsets.ModelViewSet):
    queryset = Ubicacion.objects.select_related('localidad__provincia')
    serializer_class = serializers.UbicacionSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['localidad']
    search_fields = ['calle', 'localidad__nombre']
    ordering_fields = ['calle', 'nro_calle']


# =============================================================================
# ORGANIZACION
# =============================================================================

class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = serializers.EmpresaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['condicion_iva']
    search_fields = ['cuit', 'nombre', 'razon_social']
    ordering_fields = ['razon_social', 'nombre']


class SucursalViewSet(viewsets.ModelViewSet):
    queryset = Sucursal.objects.select_related('empresa', 'ubicacion__localidad')
    serializer_class = serializers.SucursalSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['empresa', 'ubicacion']
    search_fields = ['nombre', 'empresa__nombre', 'ubicacion__localidad__nombre']
    ordering_fields = ['nombre']


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.select_related('empleado')
    serializer_class = serializers.UsuarioSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['is_active', 'is_staff']
    search_fields = ['username', 'email', 'empleado__legajo']
    ordering_fields = ['username', 'date_joined']


class EmpleadoViewSet(viewsets.ModelViewSet):
    queryset = Empleado.objects.select_related('usuario')
    serializer_class = serializers.EmpleadoSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['estado', 'usuario']
    search_fields = ['legajo', 'dni', 'apellido', 'nombre']
    ordering_fields = ['apellido', 'nombre', 'legajo']


class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = serializers.RolSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['codigo']
    search_fields = ['ocupacion', 'descripcion']
    ordering_fields = ['ocupacion']


class EmpleadoXRolViewSet(viewsets.ModelViewSet):
    queryset = EmpleadoXRol.objects.select_related('empleado', 'rol')
    serializer_class = serializers.EmpleadoXRolSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['empleado', 'rol', 'estado']
    search_fields = ['empleado__apellido', 'empleado__nombre', 'rol__ocupacion']
    ordering_fields = ['empleado__apellido', 'rol__ocupacion']


class SucursalXEmpleadoViewSet(viewsets.ModelViewSet):
    queryset = SucursalXEmpleado.objects.select_related('sucursal', 'empleado')
    serializer_class = serializers.SucursalXEmpleadoSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['sucursal', 'empleado', 'estado']
    search_fields = ['sucursal__nombre', 'empleado__apellido', 'empleado__nombre']
    ordering_fields = ['fecha_asociacion']


# =============================================================================
# CAJA
# =============================================================================

class CajaViewSet(viewsets.ModelViewSet):
    queryset = Caja.objects.select_related('sucursal')
    serializer_class = serializers.CajaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['sucursal', 'estado']
    search_fields = ['sucursal__nombre']
    ordering_fields = ['sucursal__nombre']


class SeccionCajaViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = SeccionCaja.objects.select_related(
        'caja__sucursal', 'empleado'
    ).prefetch_related('detalles_cierre__metodo_pago')
    serializer_class = serializers.SeccionCajaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, CAJERO)
    filterset_fields = ['caja', 'empleado', 'estado']
    search_fields = ['caja__sucursal__nombre', 'empleado__apellido', 'empleado__nombre']
    ordering_fields = ['fecha_hora_apertura', 'monto_inicial']

    def get_permissions(self):
        if self.action == 'auditar':
            self.roles_escritura = GESTION
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.AperturaCajaSerializer
        if self.action == 'cerrar':
            return serializers.CierreCajaSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        empleado = datos.get('empleado')
        if empleado is not None and not es_admin(request.user):
            raise ValidationError(
                {
                    'empleado': (
                        'Solo un administrador puede abrir la caja a nombre '
                        'de otro empleado.'
                    )
                }
            )
        if empleado is None:
            empleado = _empleado_de(request.user)

        seccion = caja_service.abrir_seccion(
            datos['caja'],
            empleado,
            datos['monto_inicial'],
        )
        salida = serializers.SeccionCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        entrada = serializers.CierreCajaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        seccion = caja_service.cerrar_seccion(
            self.get_object(),
            entrada.validated_data['montos_reales'],
            entrada.validated_data.get('observaciones'),
        )
        salida = serializers.SeccionCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def auditar(self, request, pk=None):
        seccion = caja_service.auditar_seccion(self.get_object())
        salida = serializers.SeccionCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


# =============================================================================
# CATALOGO
# =============================================================================

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = serializers.CategoriaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    search_fields = ['categorias']
    ordering_fields = ['categorias']


class MarcaViewSet(viewsets.ModelViewSet):
    queryset = Marca.objects.all()
    serializer_class = serializers.MarcaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    search_fields = ['marcas']
    ordering_fields = ['marcas']


class UnidadViewSet(viewsets.ModelViewSet):
    queryset = Unidad.objects.all()
    serializer_class = serializers.UnidadSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    search_fields = ['unidades']
    ordering_fields = ['unidades']


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.select_related('categoria', 'marca', 'unidad')
    serializer_class = serializers.ProductoSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['categoria', 'marca', 'unidad']
    search_fields = ['codigo', 'nombre', 'descripcion']
    ordering_fields = ['nombre', 'codigo', 'precio_unidad']


class ProductoXSucursalViewSet(viewsets.ModelViewSet):
    queryset = ProductoXSucursal.objects.select_related('producto', 'sucursal')
    serializer_class = serializers.ProductoXSucursalSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['producto', 'sucursal', 'estado']
    search_fields = ['producto__nombre', 'producto__codigo', 'sucursal__nombre']
    ordering_fields = ['producto__nombre']


# =============================================================================
# STOCK
# =============================================================================

class DepositoViewSet(viewsets.ModelViewSet):
    queryset = Deposito.objects.select_related('sucursal')
    serializer_class = serializers.DepositoSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['sucursal', 'es_predeterminado']
    search_fields = ['nombre', 'descripcion', 'sucursal__nombre']
    ordering_fields = ['nombre']


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Stock.objects.select_related('producto', 'sucursal')
    serializer_class = serializers.StockSerializer
    permission_classes = [PermisoPorRol]
    filterset_fields = ['producto', 'sucursal']
    search_fields = ['producto__nombre', 'producto__codigo', 'sucursal__nombre']
    ordering_fields = ['producto__nombre', 'cantidad']


class DetalleStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleStock.objects.select_related(
        'stock__producto',
        'stock__sucursal',
        'deposito',
    )
    serializer_class = serializers.DetalleStockSerializer
    permission_classes = [PermisoPorRol]
    filterset_fields = ['stock', 'deposito']
    search_fields = ['lote', 'stock__producto__nombre', 'stock__producto__codigo']
    ordering_fields = ['fecha_ingreso', 'cantidad']


class MovimientoStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoStock.objects.select_related(
        'stock__producto',
        'detalle_stock__deposito',
        'venta',
        'compra',
    )
    serializer_class = serializers.MovimientoStockSerializer
    permission_classes = [PermisoPorRol]
    filterset_fields = ['stock', 'detalle_stock', 'tipo', 'venta', 'compra']
    search_fields = ['referencia', 'stock__producto__nombre']
    ordering_fields = ['fecha', 'cantidad']


# =============================================================================
# PROVEEDORES
# =============================================================================

class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = serializers.ProveedorSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['estado_prov']
    search_fields = ['cuit', 'nombre', 'razon_social']
    ordering_fields = ['razon_social', 'nombre']


class ProveedorXSucursalViewSet(viewsets.ModelViewSet):
    queryset = ProveedorXSucursal.objects.select_related('proveedor', 'sucursal')
    serializer_class = serializers.ProveedorXSucursalSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['proveedor', 'sucursal', 'estado']
    search_fields = ['proveedor__razon_social', 'sucursal__nombre']
    ordering_fields = ['proveedor__razon_social']


class ProductoXProveedorViewSet(viewsets.ModelViewSet):
    queryset = ProductoXProveedor.objects.select_related('producto', 'proveedor')
    serializer_class = serializers.ProductoXProveedorSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['producto', 'proveedor', 'estado']
    search_fields = [
        'producto__nombre',
        'producto__codigo',
        'proveedor__razon_social',
        'codigo_producto_proveedor',
    ]
    ordering_fields = ['precio_lista']


# =============================================================================
# PAGOS
# =============================================================================

class MetodoPagoViewSet(viewsets.ModelViewSet):
    queryset = MetodoPago.objects.all()
    serializer_class = serializers.MetodoPagoSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['estado']
    search_fields = ['metodo_pago']
    ordering_fields = ['metodo_pago']


# =============================================================================
# VENTAS
# =============================================================================

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = serializers.ClienteSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, CAJERO, VENDEDOR)
    search_fields = ['dni', 'razon_social', 'nombre', 'apellido', 'email']
    ordering_fields = ['apellido', 'nombre', 'razon_social']


class VentaViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = (
        Venta.objects.select_related('seccion_caja__caja', 'cliente')
        .prefetch_related('detalles__producto', 'pagos__metodo_pago')
    )
    serializer_class = serializers.VentaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, CAJERO, VENDEDOR)
    filterset_fields = ['seccion_caja', 'cliente', 'estado']
    search_fields = ['cliente__razon_social', 'cliente__apellido', 'cliente__nombre']
    ordering_fields = ['fecha_venta', 'monto_venta']

    def get_permissions(self):
        if self.action == 'cancelar':
            self.roles_escritura = (ADMIN, GERENTE, CAJERO)
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.VentaCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        venta = ventas_service.crear_venta(
            datos['seccion_caja'],
            datos['items'],
            datos.get('cliente'),
        )
        salida = serializers.VentaSerializer(
            venta,
            context=self.get_serializer_context(),
        )
        return Response(salida.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        venta = ventas_service.confirmar_venta(self.get_object())
        salida = serializers.VentaSerializer(
            venta,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        venta = ventas_service.cancelar_venta(
            self.get_object(),
            motivo=request.data.get('motivo', ''),
        )
        salida = serializers.VentaSerializer(
            venta,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


class DetalleVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleVenta.objects.select_related('venta', 'producto')
    serializer_class = serializers.DetalleVentaSerializer
    permission_classes = [PermisoPorRol]
    filterset_fields = ['venta', 'producto']
    search_fields = ['producto__nombre', 'producto__codigo']
    ordering_fields = ['subtotal']


class FacturaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Factura.objects.select_related('venta')
    serializer_class = serializers.FacturaSerializer
    permission_classes = [PermisoPorRol]
    filterset_fields = ['venta', 'tipo']
    ordering_fields = ['fecha_emision']


class MetodoPagoXVentaViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MetodoPagoXVenta.objects.select_related('metodo_pago', 'venta')
    serializer_class = serializers.MetodoPagoXVentaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, CAJERO)
    filterset_fields = ['venta', 'metodo_pago']
    ordering_fields = ['monto_pagado']

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.PagoVentaCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        pago = pagos_service.registrar_pago_venta(
            datos['venta'],
            datos['metodo_pago'],
            datos['monto_pagado'],
        )
        salida = serializers.MetodoPagoXVentaSerializer(pago)
        return Response(salida.data, status=status.HTTP_201_CREATED)


# =============================================================================
# COMPRAS
# =============================================================================

class CompraViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = (
        Compra.objects.select_related('seccion_caja__caja', 'proveedor')
        .prefetch_related('detalles__producto', 'pagos__metodo_pago')
    )
    serializer_class = serializers.CompraSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['seccion_caja', 'proveedor', 'estado']
    search_fields = ['proveedor__razon_social', 'proveedor__nombre', 'proveedor__cuit']
    ordering_fields = ['fecha_compra', 'monto_compra']

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.CompraCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        compra = compras_service.registrar_compra(
            datos['seccion_caja'],
            datos['proveedor'],
            datos['items'],
        )
        salida = serializers.CompraSerializer(
            compra,
            context=self.get_serializer_context(),
        )
        return Response(salida.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        compra = compras_service.recibir_compra(self.get_object())
        salida = serializers.CompraSerializer(
            compra,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


class DetalleCompraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleCompra.objects.select_related('compra', 'producto')
    serializer_class = serializers.DetalleCompraSerializer
    permission_classes = [PermisoPorRol]
    filterset_fields = ['compra', 'producto']
    search_fields = ['producto__nombre', 'producto__codigo']
    ordering_fields = ['subtotal']


class MetodoPagoXCompraViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MetodoPagoXCompra.objects.select_related('metodo_pago', 'compra')
    serializer_class = serializers.MetodoPagoXCompraSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['compra', 'metodo_pago']
    ordering_fields = ['monto_pagado']

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.PagoCompraCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        pago = pagos_service.registrar_pago_compra(
            datos['compra'],
            datos['metodo_pago'],
            datos['monto_pagado'],
        )
        salida = serializers.MetodoPagoXCompraSerializer(pago)
        return Response(salida.data, status=status.HTTP_201_CREATED)
