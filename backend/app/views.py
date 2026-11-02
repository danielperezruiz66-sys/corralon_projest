"""Viewsets de la API.

Un viewset por modelo, agrupados por dominio con el mismo orden que `models.py`.

Regla de escritura:

- Catalogos y datos maestros: CRUD completo.
- `Stock` y `DetalleStock`: solo lectura. Se modifican desde los servicios de
  stock (ventas/compras), no con un PUT directo.
- `SeccionCaja`: solo lectura. La apertura/cierre pasa por `services/caja.py`.
- `Venta`, `Compra`, `Detalle*`, `Factura` y pagos: solo lectura por ahora. La
  escritura se habilitara cuando existan los servicios transaccionales.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

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

class PaisViewSet(viewsets.ModelViewSet):
    queryset = Pais.objects.all()
    serializer_class = serializers.PaisSerializer
    filterset_fields = ['nombre']
    search_fields = ['nombre']
    ordering_fields = ['nombre']


class ProvinciaViewSet(viewsets.ModelViewSet):
    queryset = Provincia.objects.select_related('pais')
    serializer_class = serializers.ProvinciaSerializer
    filterset_fields = ['pais']
    search_fields = ['nombre', 'pais__nombre']
    ordering_fields = ['nombre']


class LocalidadViewSet(viewsets.ModelViewSet):
    queryset = Localidad.objects.select_related('provincia__pais')
    serializer_class = serializers.LocalidadSerializer
    filterset_fields = ['provincia', 'codigo_postal']
    search_fields = ['nombre', 'codigo_postal', 'provincia__nombre']
    ordering_fields = ['nombre', 'codigo_postal']


class UbicacionViewSet(viewsets.ModelViewSet):
    queryset = Ubicacion.objects.select_related('localidad__provincia')
    serializer_class = serializers.UbicacionSerializer
    filterset_fields = ['localidad']
    search_fields = ['calle', 'localidad__nombre']
    ordering_fields = ['calle', 'nro_calle']


# =============================================================================
# ORGANIZACION
# =============================================================================

class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = serializers.EmpresaSerializer
    filterset_fields = ['condicion_iva']
    search_fields = ['cuit', 'nombre', 'razon_social']
    ordering_fields = ['razon_social', 'nombre']


class SucursalViewSet(viewsets.ModelViewSet):
    queryset = Sucursal.objects.select_related('empresa', 'ubicacion__localidad')
    serializer_class = serializers.SucursalSerializer
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
    filterset_fields = ['estado', 'usuario']
    search_fields = ['legajo', 'dni', 'apellido', 'nombre']
    ordering_fields = ['apellido', 'nombre', 'legajo']


class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = serializers.RolSerializer
    search_fields = ['ocupacion', 'descripcion']
    ordering_fields = ['ocupacion']


class EmpleadoXRolViewSet(viewsets.ModelViewSet):
    queryset = EmpleadoXRol.objects.select_related('empleado', 'rol')
    serializer_class = serializers.EmpleadoXRolSerializer
    filterset_fields = ['empleado', 'rol', 'estado']
    search_fields = ['empleado__apellido', 'empleado__nombre', 'rol__ocupacion']
    ordering_fields = ['empleado__apellido', 'rol__ocupacion']


class SucursalXEmpleadoViewSet(viewsets.ModelViewSet):
    queryset = SucursalXEmpleado.objects.select_related('sucursal', 'empleado')
    serializer_class = serializers.SucursalXEmpleadoSerializer
    filterset_fields = ['sucursal', 'empleado', 'estado']
    search_fields = ['sucursal__nombre', 'empleado__apellido', 'empleado__nombre']
    ordering_fields = ['fecha_asociacion']


# =============================================================================
# CAJA
# =============================================================================

class CajaViewSet(viewsets.ModelViewSet):
    queryset = Caja.objects.select_related('sucursal')
    serializer_class = serializers.CajaSerializer
    filterset_fields = ['sucursal', 'estado']
    search_fields = ['sucursal__nombre']
    ordering_fields = ['sucursal__nombre']


class SeccionCajaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SeccionCaja.objects.select_related('caja__sucursal', 'empleado')
    serializer_class = serializers.SeccionCajaSerializer
    filterset_fields = ['caja', 'empleado', 'estado']
    search_fields = ['caja__sucursal__nombre', 'empleado__apellido', 'empleado__nombre']
    ordering_fields = ['fecha_hora_apertura', 'monto_inicial']


# =============================================================================
# CATALOGO
# =============================================================================

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = serializers.CategoriaSerializer
    search_fields = ['categorias']
    ordering_fields = ['categorias']


class MarcaViewSet(viewsets.ModelViewSet):
    queryset = Marca.objects.all()
    serializer_class = serializers.MarcaSerializer
    search_fields = ['marcas']
    ordering_fields = ['marcas']


class UnidadViewSet(viewsets.ModelViewSet):
    queryset = Unidad.objects.all()
    serializer_class = serializers.UnidadSerializer
    search_fields = ['unidades']
    ordering_fields = ['unidades']


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.select_related('categoria', 'marca', 'unidad')
    serializer_class = serializers.ProductoSerializer
    filterset_fields = ['categoria', 'marca', 'unidad']
    search_fields = ['codigo', 'nombre', 'descripcion']
    ordering_fields = ['nombre', 'codigo', 'precio_unidad']


class ProductoXSucursalViewSet(viewsets.ModelViewSet):
    queryset = ProductoXSucursal.objects.select_related('producto', 'sucursal')
    serializer_class = serializers.ProductoXSucursalSerializer
    filterset_fields = ['producto', 'sucursal', 'estado']
    search_fields = ['producto__nombre', 'producto__codigo', 'sucursal__nombre']
    ordering_fields = ['producto__nombre']


# =============================================================================
# STOCK
# =============================================================================

class DepositoViewSet(viewsets.ModelViewSet):
    queryset = Deposito.objects.select_related('sucursal')
    serializer_class = serializers.DepositoSerializer
    filterset_fields = ['sucursal', 'es_predeterminado']
    search_fields = ['nombre', 'descripcion', 'sucursal__nombre']
    ordering_fields = ['nombre']


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Stock.objects.select_related('producto', 'sucursal')
    serializer_class = serializers.StockSerializer
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
    filterset_fields = ['stock', 'deposito']
    search_fields = ['lote', 'stock__producto__nombre', 'stock__producto__codigo']
    ordering_fields = ['fecha_ingreso', 'cantidad']


# =============================================================================
# PROVEEDORES
# =============================================================================

class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = serializers.ProveedorSerializer
    filterset_fields = ['estado_prov']
    search_fields = ['cuit', 'nombre', 'razon_social']
    ordering_fields = ['razon_social', 'nombre']


class ProveedorXSucursalViewSet(viewsets.ModelViewSet):
    queryset = ProveedorXSucursal.objects.select_related('proveedor', 'sucursal')
    serializer_class = serializers.ProveedorXSucursalSerializer
    filterset_fields = ['proveedor', 'sucursal', 'estado']
    search_fields = ['proveedor__razon_social', 'sucursal__nombre']
    ordering_fields = ['proveedor__razon_social']


class ProductoXProveedorViewSet(viewsets.ModelViewSet):
    queryset = ProductoXProveedor.objects.select_related('producto', 'proveedor')
    serializer_class = serializers.ProductoXProveedorSerializer
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
    filterset_fields = ['estado']
    search_fields = ['metodo_pago']
    ordering_fields = ['metodo_pago']


# =============================================================================
# VENTAS
# =============================================================================

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = serializers.ClienteSerializer
    search_fields = ['dni', 'razon_social', 'nombre', 'apellido', 'email']
    ordering_fields = ['apellido', 'nombre', 'razon_social']


class VentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Venta.objects.select_related('seccion_caja__caja', 'cliente')
    serializer_class = serializers.VentaSerializer
    filterset_fields = ['seccion_caja', 'cliente', 'estado']
    search_fields = ['cliente__razon_social', 'cliente__apellido', 'cliente__nombre']
    ordering_fields = ['fecha_venta', 'monto_venta']


class DetalleVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleVenta.objects.select_related('venta', 'producto')
    serializer_class = serializers.DetalleVentaSerializer
    filterset_fields = ['venta', 'producto']
    search_fields = ['producto__nombre', 'producto__codigo']
    ordering_fields = ['subtotal']


class FacturaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Factura.objects.select_related('venta')
    serializer_class = serializers.FacturaSerializer
    filterset_fields = ['venta', 'tipo']
    ordering_fields = ['fecha_emision']


class MetodoPagoXVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MetodoPagoXVenta.objects.select_related('metodo_pago', 'venta')
    serializer_class = serializers.MetodoPagoXVentaSerializer
    filterset_fields = ['venta', 'metodo_pago']
    ordering_fields = ['monto_pagado']


# =============================================================================
# COMPRAS
# =============================================================================

class CompraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Compra.objects.select_related('seccion_caja__caja', 'proveedor')
    serializer_class = serializers.CompraSerializer
    filterset_fields = ['seccion_caja', 'proveedor', 'estado']
    search_fields = ['proveedor__razon_social', 'proveedor__nombre', 'proveedor__cuit']
    ordering_fields = ['fecha_compra', 'monto_compra']


class DetalleCompraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleCompra.objects.select_related('compra', 'producto')
    serializer_class = serializers.DetalleCompraSerializer
    filterset_fields = ['compra', 'producto']
    search_fields = ['producto__nombre', 'producto__codigo']
    ordering_fields = ['subtotal']


class MetodoPagoXCompraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MetodoPagoXCompra.objects.select_related('metodo_pago', 'compra')
    serializer_class = serializers.MetodoPagoXCompraSerializer
    filterset_fields = ['compra', 'metodo_pago']
    ordering_fields = ['monto_pagado']
