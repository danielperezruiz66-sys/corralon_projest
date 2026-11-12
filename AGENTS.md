# AGENTS.md — Corralón Fer-Cons

> Contexto permanente para agentes. Los pendientes del día van en
> `DIA_SIGUIENTE.md`; la instalación para el equipo, en `INSTRUCCIONES.md`.
> Al cerrar una sesión: actualizar este archivo si cambió el estado y reescribir
> `DIA_SIGUIENTE.md` solo con lo pendiente (lo terminado se borra).

**Última actualización:** 2026-11-11

## 1. Proyecto y stack

Sistema de gestión para un corralón de materiales: geografía, organización,
catálogo, stock, caja, ventas, compras, facturación, pagos y proveedores.
Arquitectura desacoplada:

- `backend/` — Django 6.1 + DRF + PostgreSQL 16 (puerto 5433 por defecto),
  Python 3.14. Entorno virtual en la raíz (`venv/`).
- `frontend/` — React 19 + Vite 8 + JavaScript (sin TypeScript) + Tailwind 4,
  React Router 7, Tabler Icons, SweetAlert2 y react-hook-form. Node 20+.
- API en `http://localhost:8000`, Vite en `http://localhost:5173`.
- `.env` en la raíz (no se commitea); plantilla en `.env.example`.

Estado: backend Fase 1+2 completo (35 viewsets, 159 tests); frontend con
Dashboard, Ventas, Compras, Clientes, Inventario y Proveedores. Faltan Caja,
Empleados, Perfil y Actividad. Facturación ARCA bloqueada.

## 2. Estructura y arquitectura

```text
backend/
├── config/            # settings.py, urls.py, asgi.py, wsgi.py
└── app/               # ÚNICA app Django
    ├── models.py      # 35 modelos por secciones (# ==== DOMINIO ====)
    ├── services/      # stock, caja, ventas, compras, pagos, proveedores
    ├── management/commands/  # seed_data, cancelar_ventas_vencidas
    ├── migrations/    # 0001–0014
    ├── tests/         # 159 tests
    ├── admin.py  apps.py  backends.py  exceptions.py  permissions.py
    └── serializers.py  urls.py  views.py
frontend/src/
├── api/  context/  pages/  components/  styles/
├── data/menuConfig.js  hooks/  utils/
└── App.jsx  index.css  main.jsx
scripts/               # tareas programadas de Windows
```

Reglas fijas:

- Una sola app Django (`app`). **No** crear apps por dominio.
- `models.py` es un solo archivo: no dividirlo en un paquete `models/`.
- `backends.py` es solo autenticación; no mover allí lógica de modelos/vistas.
- No cambiar `AUTH_USER_MODEL` (`app.Usuario`) ni los `db_table`.
- Endpoints nuevos en `app/urls.py`, no en `config/urls.py`.
- No crear archivos vacíos "por si acaso".

## 3. Backend: datos y reglas de negocio

Modelos por dominio (el orden de definición importa: una clase va después de
las que referencia):

| Sección | Modelos |
|---|---|
| GEOGRAFIA | Pais, Provincia, Localidad, Ubicacion |
| ORGANIZACION | Empresa, Sucursal, Usuario, Empleado, Rol, EmpleadoXRol, SucursalXEmpleado |
| CAJA | Caja, SeccionCaja, DetalleCierreCaja |
| CATALOGO | Categoria, Marca, Unidad, Producto, ProductoXSucursal |
| STOCK | Deposito, Stock, DetalleStock, MovimientoStock, TransferenciaStock |
| PROVEEDORES | Proveedor, ProveedorXSucursal, ProductoXProveedor |
| PAGOS | MetodoPago |
| VENTAS | Cliente, Venta, DetalleVenta, Factura, MetodoPagoXVenta |
| COMPRAS | Compra, DetalleCompra, MetodoPagoXCompra |

Reglas:

- Las cantidades de stock son `DecimalField(12,3)`; los importes,
  `DecimalField(10,2)`.
- `DetalleStock` es la fuente de verdad. `Stock.cantidad` = suma de detalles.
  Solo `services/stock.py` escribe detalles y recalcula el total.
- `MovimientoStock` es el libro: `VE` venta, `CA` cancelación, `CO` compra,
  `AJ` ajuste, `TR` transferencia.
- Stock negativo: piso `Stock.cant_negativa_max` (default `-10`). El faltante se
  guarda como `DetalleStock` negativo sin lote en el depósito predeterminado.
- Carga masiva por sucursal: suma cantidades en un depósito de la sucursal, exige
  lote (vencimiento opcional), producto activo en la sucursal y registra
  movimientos `AJ` con referencia `carga-stock: <motivo>`.
- `Deposito.es_predeterminado`: uno por sucursal. `Sucursal.es_central`: única
  por empresa; recibe las compras si no se elige depósito.
- `TransferenciaStock`: descuenta el origen y queda `ET`; al recibir ingresa en
  destino (`RE`); al cancelar vuelve al origen (`CA`).
- `Venta.EstadoVenta`: `PE` Pendiente, `CO` Confirmada, `AN` Anulada. **No
  existe Parcial.** Nace pendiente y descuenta stock; acepta pagos parciales sin
  cambiar de estado; se confirma con el saldo en cero. Tras 30 min sin pagos
  (`VENTAS_MINUTOS_PARA_CONFIRMAR`) se considera vencida y se muestra como alerta;
  **no se anula automáticamente** (barrido manual): el stock sigue reservado
  hasta anulación manual. Una venta pendiente con pagos no se puede anular.
- `Venta.cliente_venta`: nombre libre opcional para consumidor final.
- `Cliente`: `estado` activo/inactivo, `tipo_documento`, `condicion_iva` (`RI`,
  `MT`, `CF`, `EX`, `NC`), `ingresos_brutos`, `notas`. Al crear exige identidad,
  tipo y número de documento y al menos un teléfono o email. Un cliente inactivo
  no se ofrece ni se acepta en ventas. El resumen se calcula en
  `GET /api/clientes/{id}/resumen/`.
- `Producto`: código, nombre, categoría, marca, unidad, precio de venta > 0 y al
  menos una sucursal activa. Al crear por API se exige `proveedor` y
  `precio_lista`; el serializer crea/actualiza `ProductoXProveedor` en la misma
  transacción. El precio de venta debe superar el costo activo más alto de
  `ProductoXProveedor`.
- `Proveedor`: CUIT, nombre, razón social y al menos una sucursal activa. Los
  costos viven en `ProductoXProveedor.precio_lista` y deben ser menores al
  precio de venta. `POST /api/proveedores/{id}/productos/` asocia/actualiza
  varios productos en bloque dentro de una transacción.
- `Compra.estado_entrega`: `PE` Pendiente, `EC` En camino, `RE` Recibida. Es
  independiente del estado de pago (`PE`/`PC`/`PA`/`AN`). Registrar o marcar en
  camino no mueve stock; `recibir_compra` repone el depósito elegido (o el
  central por defecto) y la deja `RECIBIDA`. `fecha_estimada_llegada` es
  obligatoria en `EC` y no puede ser anterior a `fecha_compra` (se valida en
  `Compra.clean()`, en los serializers y en los servicios). Anular solo si no
  está recibida y no tiene pagos, con `motivo_cancelacion` obligatorio. Cada
  detalle exige costo > 0, no usa el precio de venta y el producto debe tener un
  `ProductoXProveedor` activo del proveedor de la compra.
- `SeccionCaja`: `monto_teorico` calculado por el sistema, `monto_final` contado.
  `DetalleCierreCaja` guarda `monto_sistema` vs `monto_real` por método.
  `MetodoPago.es_efectivo` suma el `monto_inicial` al teórico.
- `Rol.codigo`: `AD` Admin, `GE` Gerente, `CA` Cajero, `VE` Vendedor, `ED`
  Encargado de depósito. Sin código = solo lectura.
- `django-simple-history` en modelos críticos (Usuario sin password, Empleado,
  Producto, Stock, DetalleStock, MovimientoStock, TransferenciaStock,
  Proveedor, SeccionCaja, DetalleCierreCaja, Cliente, Venta, DetalleVenta,
  Factura, MetodoPagoXVenta, Compra, DetalleCompra, MetodoPagoXCompra).
  `HistoryRequestMiddleware` guarda el usuario autenticado en `history_user`.

## 4. Servicios

La lógica de negocio vive en `backend/app/services/`. Las vistas validan la
entrada y delegan; no escriben directamente.

| Módulo | Funciones |
|---|---|
| `stock.py` | `obtener_stock`, `consumir_stock`, `reponer_stock`, `restaurar_stock`, `recalcular_stock`, `deposito_predeterminado`, `ajustar_stock`, `cargar_stock_sucursal`, `crear_transferencia`, `recibir_transferencia`, `cancelar_transferencia` |
| `caja.py` | `abrir_seccion`, `calcular_teorico`, `cerrar_seccion`, `auditar_seccion` |
| `ventas.py` | `crear_venta`, `confirmar_venta`, `cancelar_venta`, `cancelar_ventas_vencidas` |
| `compras.py` | `registrar_compra`, `anular_compra`, `marcar_en_camino`, `recibir_compra` |
| `pagos.py` | `registrar_pago_venta`, `registrar_pagos_venta`, `registrar_pago_compra`, `registrar_pagos_compra` |
| `proveedores.py` | `asociar_productos` |

Reglas: stock usa `select_for_update` y recalcula dentro de la transacción;
ventas rechaza stock bajo el piso, clientes inactivos, precio <= 0 y venta bajo
costo; compras exige proveedor activo; pagos no permite pagar de más, documentos
anulados ni métodos inactivos; `proveedores.asociar_productos` crea/actualiza
costos en bloque y valida costo < precio de venta. `registrar_pagos_*` guarda
varios métodos en una misma transacción.

`Stock`, `DetalleStock`, `MovimientoStock`, `DetalleVenta`, `Factura` y
`DetalleCompra` son de solo lectura. `Venta`, `Compra`, `SeccionCaja` y los pagos
se escriben solo mediante acciones que llaman a los servicios (sin
`PUT`/`PATCH`/`DELETE`).

## 5. API y permisos

- JWT: `POST /api/token/` (acepta `username` o `legajo`) y
  `POST /api/token/refresh/`. Header `Authorization: Bearer <token>`.
- Paginación 20; filtros DjangoFilter + Search + Ordering. Ventas y compras
  aceptan `fecha`, `fecha_desde` y `fecha_hasta` (`AAAA-MM-DD`).
- Errores de negocio: `400 {"detail": "...", "codigo": "..."}` con `codigo` =
  `stock_insuficiente`, `error_de_negocio`, `validacion`, `no_encontrado` o
  `protegido`.
- Routers: 35 viewsets en `app/urls.py` + `GET /api/perfil/` y
  `GET /api/dashboard/?periodo=hoy|7d|mes&sucursal=<id>`.
- Escrituras clave:
  - `POST /api/ventas/`, `/{id}/confirmar/`, `/{id}/cobrar/`, `/{id}/cancelar/`
  - `PATCH /api/clientes/{id}/estado/`
  - `PATCH /api/stocks/{id}/` y `POST /api/stocks/{id}/ajustar/`
  - `POST /api/stocks/carga-masiva/` (suma stock por sucursal, lote obligatorio)
  - `POST /api/transferencias-stock/`, `/{id}/recibir/`, `/{id}/cancelar/`
  - `POST /api/compras/`, `/{id}/pagar/`, `/{id}/anular/`, `/{id}/en-camino/`,
    `/{id}/recibir/`
  - `POST /api/secciones-caja/`, `/{id}/cerrar/`, `/{id}/auditar/`
  - `POST /api/metodos-pago-ventas/` y `/api/metodos-pago-compras/`
- Permisos: lectura para autenticados; escritura por rol. `is_superuser` y `AD`
  pueden todo. Caja: abrir/cerrar `AD/GE/CA`, auditar `AD/GE`. Ventas: crear
  `AD/GE/CA/VE`; cobrar, confirmar y anular `AD/GE/CA` (el vendedor no).
  Compras: `AD/GE/ED`. Pagos: `AD/GE/CA/ED`. Sin rol = solo lectura.
- `Usuario` exige `IsAdminUser`, contraseña write-only con `set_password()`.
  `Producto` acepta `sucursales` write-only y sincroniza `ProductoXSucursal`.

## 6. Frontend

- Rutas protegidas; `/login` es pública. `useAuth()` expone `user`, `login`,
  `logout`, `puedeVer(modulo)` y `puedeEscribir(roles)`. El menú y las rutas
  filtran por `AD/GE/CA/VE/ED`; sin rol solo Inicio y Perfil.
- Selector global de sucursal en el encabezado, persistido en `localStorage`
  (`corralon.sucursal`). Las opciones salen de `/api/perfil/` (admin ve todas,
  el resto solo las asignadas). Filtra dashboard, ventas, compras, caja, stock,
  movimientos, depósitos y transferencias. Clientes, proveedores, productos y
  catálogos son globales.
- Tokens en `localStorage` (`corralon.acceso` / `corralon.refresco`). Ante un
  `401`, `pedir()` renueva y reintenta una vez; si falla, cierra sesión.
- Módulos listos: Dashboard, Ventas, Compras, Clientes, Inventario, Proveedores.
  Pendientes: Caja, Empleados, Perfil y Actividad (`EnDesarrollo`).
- Convenciones UI: búsqueda en vivo con debounce, filtros persistidos en la URL,
  exportación CSV, presupuesto imprimible, cobro multi-método, recepción de
  compras con depósito, ajustes y transferencias de stock, costos por proveedor.
- Alta de compra: el selector muestra solo los productos del proveedor elegido.
  Si se cambia de proveedor con líneas cargadas, se confirma y se vacía el
  carrito. La fecha estimada de llegada no puede ser anterior a la compra.
- Inventario: el alta/edición de producto exige proveedor y precio de costo. Los
  selects de categoría, marca, unidad y proveedor tienen un atajo `+` que abre
  el formulario de alta sin perder los datos del producto. Al crear, recibir o
  cancelar una transferencia, la lista pasa al estado nuevo y resalta la fila.
- Selects de entidades con `CampoSelectorBuscable`: búsqueda local o remota,
  navegación por teclado y atajo opcional de alta. Se usa en venta (cliente),
  compra (proveedor), producto (proveedor y catálogos), costo de proveedor
  (proveedor y producto), transferencias (producto remoto; depósitos local),
  ajuste de stock (depósito), sucursales (depósito y encabezado), sección de
  caja (venta/compra) y filtros de inventario/selector de productos (categoría,
  marca y unidad local). El modal se renderiza fuera del formulario principal y
  auto-selecciona el ítem creado.
- Los formularios ya no cargan catálogos completos de clientes, proveedores ni
  productos: buscan contra la API. `FormularioVenta` usa `SelectorProductos`
  remoto; `FormularioCompra` carga solo los productos del proveedor elegido.
  `ProductoXProveedorSerializer` incluye los datos del producto para evitar
  precargar el catálogo. Los valores iniciales (por ejemplo `clienteInicial` por
  URL) se resuelven con una consulta puntual por ID.
- Validaciones de formularios: `utils/validaciones.js` centraliza DNI/CUIT,
  email, teléfono, códigos, números y textos. Los campos inválidos usan
  `MensajeError`, clase `.input-error` y bloquean el envío; se enfoca el primer
  error. `pedir()` conserva `error.campos` para mapear errores de DRF al input.
- Compra: si el proveedor no tiene productos, se asocian desde un modal múltiple
  con proveedor fijo, sin abrir otra pestaña ni perder el borrador. Al guardar se
  recargan los productos del proveedor y quedan disponibles en la compra.
- Navegación desde las alertas del dashboard:
  `/ventas?alerta=por_vencer|vencida`,
  `/productos?tab=stock&alerta=negativo|minimo&producto=<id>` y
  `/compras?por_recibir=1`. Inventario resalta y hace scroll al producto.
  Cajas abiertas ancla al panel `#cajas-abiertas` hasta que exista el módulo.
- Facturación muestra mantenimiento hasta habilitar ARCA.

## 7. Facturación (ARCA) — bloqueada

`Factura` existe y es solo lectura; no hay emisión. Falta CUIT del emisor,
certificado `.crt`/`.key` y punto de venta habilitado. Al retomar: empezar por
homologación; WSAA (TRA + token/sign cacheados ~12 h) y WSFEv1
(`FECompUltimoAutorizado` + `FECAESolicitar`); tras un timeout consultar
`FECompConsultar` antes de reintentar; contemplar RG 5616
(`CondicionIVAReceptorId`) y RG 4892 (QR).

## 8. Comandos y verificación

```bash
cd backend
../venv/Scripts/python.exe manage.py check                 # 0 issues
../venv/Scripts/python.exe manage.py makemigrations --check --dry-run
../venv/Scripts/python.exe manage.py migrate
../venv/Scripts/python.exe manage.py test app              # 159 tests
../venv/Scripts/python.exe manage.py seed_data [--reset] [--ventas 240] [--compras 72]
../venv/Scripts/python.exe manage.py cancelar_ventas_vencidas [--minutos 30]

cd ../frontend
npm run lint                                               # 0 warnings
npm run build
```

Antes de cerrar un cambio: check, makemigrations --check, migrate, tests, lint y
build. Si se tocaron modelos, generar la migración; no editar migraciones a mano.
El seed es determinista (`random.seed(42)`), crea las sucursales Salta Capital y
Campo Quijano, `admin`/`admin1234`, 8 empleados demo (4 por sucursal con roles
AD/CA/VE/ED) con `test1234` y 6 meses de compras y ventas. El barrido de ventas
vencidas es manual (no automático); el comando `cancelar_ventas_vencidas` puede
ejecutarse manualmente si se requiere. No programar la tarea
`Corralon\CancelarVentasVencidas`.

## 9. Convenciones

- Nombres de modelos, campos, `db_table` y `verbose_name` en español.
- `db_table` en MAYÚSCULAS y plural (`USUARIOS`, `SECCIONES_CAJA`).
- `Meta` con `ordering`, `verbose_name` y `verbose_name_plural`.
- Comillas simples en Python; `TextChoices` para estados.
- Frontend: JavaScript y `.jsx` (no TypeScript).

## 10. Cierre de sesión

1. Leer `DIA_SIGUIENTE.md` al empezar.
2. Al terminar, actualizar este archivo si cambió el estado y reescribir
   `DIA_SIGUIENTE.md` solo con lo pendiente. Lo terminado o descartado se borra.
3. Si no queda nada: `Sin pendientes.`
