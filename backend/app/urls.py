"""Rutas de la API.

Los endpoints de autenticacion (JWT) se declaran sueltos y el resto se
registra en `router`, que expone `/api/` como raiz navegable.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = DefaultRouter()

# GEOGRAFIA
router.register('paises', views.PaisViewSet, basename='pais')
router.register('provincias', views.ProvinciaViewSet, basename='provincia')
router.register('localidades', views.LocalidadViewSet, basename='localidad')
router.register('ubicaciones', views.UbicacionViewSet, basename='ubicacion')

# ORGANIZACION
router.register('empresas', views.EmpresaViewSet, basename='empresa')
router.register('sucursales', views.SucursalViewSet, basename='sucursal')
router.register('usuarios', views.UsuarioViewSet, basename='usuario')
router.register('empleados', views.EmpleadoViewSet, basename='empleado')
router.register('roles', views.RolViewSet, basename='rol')
router.register('empleados-roles', views.EmpleadoXRolViewSet, basename='empleado-rol')
router.register(
    'sucursales-empleados',
    views.SucursalXEmpleadoViewSet,
    basename='sucursal-empleado',
)

# CAJA
router.register('cajas', views.CajaViewSet, basename='caja')
router.register('secciones-caja', views.SeccionCajaViewSet, basename='seccion-caja')

# CATALOGO
router.register('categorias', views.CategoriaViewSet, basename='categoria')
router.register('marcas', views.MarcaViewSet, basename='marca')
router.register('unidades', views.UnidadViewSet, basename='unidad')
router.register('productos', views.ProductoViewSet, basename='producto')
router.register(
    'productos-sucursales',
    views.ProductoXSucursalViewSet,
    basename='producto-sucursal',
)

# STOCK
router.register('depositos', views.DepositoViewSet, basename='deposito')
router.register('stocks', views.StockViewSet, basename='stock')
router.register('detalles-stock', views.DetalleStockViewSet, basename='detalle-stock')
router.register(
    'movimientos-stock',
    views.MovimientoStockViewSet,
    basename='movimiento-stock',
)

# PROVEEDORES
router.register('proveedores', views.ProveedorViewSet, basename='proveedor')
router.register(
    'proveedores-sucursales',
    views.ProveedorXSucursalViewSet,
    basename='proveedor-sucursal',
)
router.register(
    'productos-proveedores',
    views.ProductoXProveedorViewSet,
    basename='producto-proveedor',
)

# PAGOS
router.register('metodos-pago', views.MetodoPagoViewSet, basename='metodo-pago')

# VENTAS
router.register('clientes', views.ClienteViewSet, basename='cliente')
router.register('ventas', views.VentaViewSet, basename='venta')
router.register('detalles-venta', views.DetalleVentaViewSet, basename='detalle-venta')
router.register('facturas', views.FacturaViewSet, basename='factura')
router.register(
    'metodos-pago-ventas',
    views.MetodoPagoXVentaViewSet,
    basename='metodo-pago-venta',
)

# COMPRAS
router.register('compras', views.CompraViewSet, basename='compra')
router.register('detalles-compra', views.DetalleCompraViewSet, basename='detalle-compra')
router.register(
    'metodos-pago-compras',
    views.MetodoPagoXCompraViewSet,
    basename='metodo-pago-compra',
)

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('perfil/', views.perfil, name='perfil'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('', include(router.urls)),
]
