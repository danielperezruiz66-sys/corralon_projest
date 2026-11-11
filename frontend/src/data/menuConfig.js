import {
  IconAddressBook,
  IconBuildingWarehouse,
  IconCash,
  IconFileText,
  IconHistory,
  IconHome2,
  IconPackage,
  IconReceipt2,
  IconSettings,
  IconShoppingBag,
  IconShoppingCart,
  IconTruck,
  IconTruckDelivery,
  IconUserCircle,
  IconUsers,
} from '@tabler/icons-react'

/**
 * Módulos del sistema agrupados por categoría.
 *
 * `roles` son los códigos funcionales del backend (AD, GE, CA, VE, ED).
 * Una lista vacía significa "visible para cualquier usuario autenticado".
 * Los módulos marcados con `mantenimiento` muestran una pantalla informativa.
 */
export const menuCategories = [
  {
    id: 'principal',
    title: 'Principal',
    icono: IconHome2,
    modules: [
      {
        name: 'Inicio',
        path: '/',
        detalle: 'Resumen general y actividad',
        icono: IconHome2,
        roles: [],
      },
    ],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    icono: IconShoppingBag,
    modules: [
      {
        name: 'Ventas',
        path: '/ventas',
        detalle: 'Seguimiento y confirmación',
        icono: IconShoppingCart,
        roles: ['AD', 'GE', 'CA', 'VE'],
      },
      {
        name: 'Compras',
        path: '/compras',
        detalle: 'Registro y recepción',
        icono: IconTruckDelivery,
        roles: ['AD', 'GE', 'ED'],
      },
      {
        name: 'Clientes',
        path: '/clientes',
        detalle: 'Alta, edición y consulta de clientes',
        icono: IconAddressBook,
        roles: ['AD', 'GE', 'CA', 'VE'],
      },
    ],
  },
  {
    id: 'inventario',
    title: 'Inventario',
    icono: IconPackage,
    modules: [
      {
        name: 'Inventario',
        path: '/productos',
        detalle: 'Productos, stock, movimientos y depósitos',
        icono: IconBuildingWarehouse,
        roles: ['AD', 'GE', 'CA', 'VE', 'ED'],
      },
      {
        name: 'Proveedores',
        path: '/proveedores',
        detalle: 'Información, sucursales y costos',
        icono: IconTruck,
        roles: ['AD', 'GE', 'ED'],
      },
    ],
  },
  {
    id: 'administracion',
    title: 'Administración',
    icono: IconReceipt2,
    modules: [
      {
        name: 'Caja',
        path: '/caja',
        detalle: 'Apertura, cierre y pagos',
        icono: IconCash,
        roles: ['AD', 'GE', 'CA'],
      },
      {
        name: 'Empleados',
        path: '/empleados',
        detalle: 'Usuarios, roles y permisos',
        icono: IconUsers,
        roles: ['AD', 'GE'],
      },
      {
        name: 'Facturación',
        path: '/facturacion',
        detalle: 'Comprobantes electrónicos',
        icono: IconFileText,
        roles: ['AD', 'GE'],
        mantenimiento: true,
      },
    ],
  },
  {
    id: 'sistema',
    title: 'Sistema',
    icono: IconSettings,
    modules: [
      {
        name: 'Perfil',
        path: '/perfil',
        detalle: 'Cuenta y datos personales',
        icono: IconUserCircle,
        roles: [],
      },
      {
        name: 'Actividad',
        path: '/actividad',
        detalle: 'Registro de movimientos',
        icono: IconHistory,
        roles: ['AD', 'GE'],
      },
    ],
  },
]

export const modulosDelMenu = menuCategories.flatMap((categoria) =>
  categoria.modules.map((modulo) => ({ ...modulo, categoria: categoria.id })),
)
