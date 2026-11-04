# AGENTS.md — Contexto del proyecto

> **Cómo mantener este archivo:** refleja el **estado real** del proyecto, no el ideal.
> Al terminar cada sesión de trabajo: actualizar "Estado actual" y borrar lo que ya
> no sea cierto o ya no aporte. Si algo deja de ser verdad, **se elimina** (no se deja
> tachado ni "histórico").
>
> Lo que **falta hacer** no va acá: va en `DIA_SIGUIENTE.md` (ver sección 10), que se
> reescribe en cada sesión y solo contiene lo pendiente del día anterior.
>
> `INSTRUCCIONES.md` es otra cosa: es la guía de instalación para el equipo.
> No mezclar ambos documentos.

**Última actualización:** 2026-11-03

---

## 1. Qué es el proyecto

**Corralón Fer-Cons** — sistema de gestión para un corralón de materiales de construcción.

Cubre: geografía, organización (empresas/sucursales/empleados), catálogo de
productos, stock por depósito, cajas y turnos, ventas, compras, facturación,
pagos y proveedores.

Arquitectura **desacoplada**:

- `backend/` → API REST con Django + DRF, PostgreSQL
- `frontend/` → React con Vite (JavaScript, sin TypeScript)

## 2. Estado actual (2026-11-03)

| Área | Estado |
|---|---|
| Estructura del repo (`backend/` + `frontend/`) | ✅ Hecha |
| Modelos de datos (35) en `models.py` por secciones | ✅ Hechos |
| Migraciones (`0001`–`0007`) | ✅ Aplicadas y consistentes (`makemigrations --check` sin cambios) |
| Autenticación (login por usuario **o** legajo) | ✅ Funcional |
| Comando de datos de prueba (`seed_data`) | ✅ Funcional |
| Admin de Django | ✅ Configurado (Usuario + Empleado inline) |
| API REST — configuración base (JWT, paginación, permisos, filtros) | ✅ Lista — `/api/token/` y `/api/token/refresh/` funcionando |
| API REST — serializers, viewsets y rutas de negocio | ✅ **Fase 1** — 34 viewsets + `GET /api/perfil/` + `GET /api/dashboard/` |
| API REST — escritura transaccional (ventas, compras, caja, pagos) | ✅ **Fase 2** — acciones que delegan en `services/` |
| Lógica de negocio (`services/`) | ✅ stock, caja, ventas, compras y pagos |
| Permisos por rol (Admin, Gerente, Cajero, Vendedor, Enc. depósito) | ✅ Aplicados por viewset y acción |
| Auto-cancelación de ventas | ✅ Umbral 30 min · barrido cada 10 min (tarea de Windows registrada) |
| Seed con libro de movimientos | ✅ Ventas y compras generan `MovimientoStock` e histórico coherente |
| Tests | ✅ 57 tests (`manage.py test app`) |
| Facturación (ARCA) | ⛔ Bloqueada: sin CUIT, certificado ni punto de venta |
| Frontend — base | ✅ Login JWT (usuario o legajo), perfil y dashboard real |
| Frontend — rediseño visual (referencia `Fer-Cons-feature-api-rest-auth`) | ✅ **Fase 0–2 + login y dashboard** — Tailwind 4, router, sidebar, menú por roles y `/api/dashboard/`; el resto de los módulos muestra pantalla provisional |
| Frontend — módulos de negocio | ⏳ Pendientes de conectar (ventas, compras, caja, productos, empleados, proveedores, perfil, actividad) |

**Lo que sigue está en `DIA_SIGUIENTE.md`.**

> Estado del repo: la Fase 2 de la API (escritura + roles + tests) y el seed con
> libro de movimientos están en la base de desarrollo; falta commitear. La tarea
> programada `Corralon\CancelarVentasVencidas` ya está registrada en este equipo.

## 3. Stack y versiones

**Backend** (`backend/requirements.txt`)

| Paquete | Versión |
|---|---|
| Django | 6.1.1 |
| djangorestframework | 3.18.1 |
| djangorestframework-simplejwt | 5.5.1 |
| django-filter | 26.2 |
| django-simple-history | 3.13.0 |
| django-cors-headers | 4.9.0 |
| psycopg[binary] | 3.3.6 |
| python-decouple | 3.8 |
| PyJWT | 2.15.1 |

- Python 3.14 · PostgreSQL 16+ (por defecto puerto **5433**, configurable en `.env`)
- Entorno virtual `venv/` en la **raíz** del repo (Windows: `venv/Scripts/python.exe`)

**Frontend** (`frontend/package.json`)

| Paquete | Versión |
|---|---|
| React | 19.3.1 |
| Vite | 8.3.5 |
| @vitejs/plugin-react | 6.1.2 |
| oxlint | 1.89.0 |

- Node.js 20+ · Puerto de desarrollo **5173**

## 4. Estructura del repo

```text
corralon_projest/
├── backend/
│   ├── config/            # settings.py, urls.py, asgi.py, wsgi.py
│   ├── app/               # ÚNICA Django app del proyecto
│   │   ├── models.py      # 35 modelos, agrupados por dominio con comentarios
│   │   ├── services/      # stock, caja, ventas, compras y pagos
│   │   ├── management/commands/  # seed_data, cancelar_ventas_vencidas
│   │   ├── migrations/    # 0001–0007 (historial, modelo, roles canónicos)
│   │   ├── tests/         # tests de API, servicios y permisos
│   │   ├── admin.py  apps.py  backends.py  exceptions.py  permissions.py
│   │   ├── serializers.py  urls.py  views.py
│   ├── logs/              # salida del barrido (no se commitea)
│   ├── manage.py
│   └── requirements.txt
├── frontend/              # React + Vite (cliente de la API)
├── scripts/               # tareas programadas de Windows (.bat)
├── .env                   # NO se commitea (está en .gitignore)
├── .env.example
├── INSTRUCCIONES.md       # guía de instalación para el equipo
├── AGENTS.md              # este archivo (contexto del proyecto)
└── DIA_SIGUIENTE.md       # pendientes de la sesión anterior
```

## 5. Backend: arquitectura

### Decisión: una sola Django app, modularizada por dentro

Se evaluó crear una Django app por dominio (`apps/ventas/`, `apps/caja/`, …) y se
**descartó**. Se volvió a plantear al configurar la API (2026-11-01) y se confirmó
la app única. Motivos:

- cambia el `app_label` de los modelos → obliga a regenerar todas las migraciones;
- mover `Usuario` implicaría tocar `AUTH_USER_MODEL` (el cambio más delicado de Django);
- rompe la estructura base del proyecto.

En su lugar, `models.py` es un **único archivo** dividido en secciones por dominio
con comentarios, y la lógica de negocio irá en `services/`. `app_label` sigue siendo
`app` → **las migraciones no se tocan**.

> Si en el futuro se quiere separación total en apps, es una fase aparte, con
> tests que la respalden y asumiendo la cirugía de migraciones.

### Secciones de `models.py`

Encabezados con el formato `# ==== DOMINIO ====`. No se crean archivos ni paquetes
por dominio.

| Sección | Modelos | Depende de |
|---|---|---|
| GEOGRAFIA | Pais, Provincia, Localidad, Ubicacion | — |
| ORGANIZACION | Empresa, Sucursal, Usuario, Empleado, Rol, EmpleadoXRol, SucursalXEmpleado | geografia |
| CAJA | Caja, SeccionCaja | organizacion |
| CATALOGO | Categoria, Marca, Unidad, Producto, ProductoXSucursal | organizacion |
| STOCK | Deposito, Stock, DetalleStock | catalogo, organizacion |
| PROVEEDORES | Proveedor, ProveedorXSucursal, ProductoXProveedor | catalogo, organizacion |
| PAGOS | MetodoPago | — |
| VENTAS | Cliente, Venta, DetalleVenta, Factura, MetodoPagoXVenta | caja, catalogo, pagos |
| COMPRAS | Compra, DetalleCompra, MetodoPagoXCompra | caja, catalogo, pagos |

Como es un solo archivo, **el orden importa**: cada clase debe definirse *después*
de los modelos que referencia. El orden actual de las secciones ya es válido; al
agregar un modelo, ubicarlo en su sección (mover la sección solo si es necesario).

### Modelo — reglas vigentes

Decisiones ya aplicadas en `migrations/0003_*`:

- **Todas las cantidades son `DecimalField(12,3)`**: `Stock.cantidad`,
  `Stock.cant_min`, `DetalleStock.cantidad`, `DetalleVenta.cantidad_venta` y
  `DetalleCompra.cantidad_compra`. La unidad del producto puede ser kilo, metro
  o litro.
- **`DetalleStock` es la fuente de verdad** del stock. `Stock.cantidad` es el
  **total** (producto + sucursal) y debe mantenerse igual a la suma de sus
  detalles. Lo recalculan los servicios dentro de la transacción.
- **`Compra.proveedor`** es una FK a `Proveedor`. Queda `null=True` para no
  romper compras históricas; los servicios deben exigirlo en compras nuevas.
- **Recepción de compras con depósito predeterminado**: `DetalleCompra` no
  tiene depósito ni lote. Cada `Deposito` pertenece a una `Sucursal` y puede
  marcarse `es_predeterminado=True` (uno solo por sucursal). El servicio de
  compras usa ese depósito.
- `Deposito.sucursal` es nullable por compatibilidad; un depósito predeterminado
  debe tener sucursal (lo valida el serializer).
- **`Factura` tiene `HistoricalRecords`**, igual que el resto de VENTAS.
- **Stock negativo controlado**: `Stock.cant_negativa_max` (default `-10`) es el
  piso permitido. Por debajo de ese piso la venta se rechaza. El faltante se
  guarda como un `DetalleStock` negativo sin lote en el depósito predeterminado,
  para que la suma de detalles siga igualando `Stock.cantidad`.
- **`MovimientoStock`** es el libro de movimientos (`VE` venta, `CA` cancelación,
  `CO` compra, `AJ` ajuste). Permite revertir una venta cancelada sobre los
  mismos lotes. Se registra dentro de la transacción del servicio.
- **`Venta.EstadoVenta`** incluye `CONFIRMADA` (`CO`). Una venta nace
  `PENDIENTE` y descuenta stock; si no se confirma en **30 minutos**
  (`VENTAS_MINUTOS_PARA_CONFIRMAR`) se cancela y restaura el stock.
- **`Compra.fecha_recepcion`** marca cuándo se repuso el stock. La compra se
  registra sin tocar stock y solo repone al recibirse.
- **Cierre de caja con teórico y real**: `SeccionCaja.monto_teorico` lo calcula
  el sistema y `monto_final` es lo contado por el usuario. El detalle por método
  de pago vive en `DetalleCierreCaja` (`monto_sistema` vs `monto_real`).
- **`MetodoPago.es_efectivo`** identifica el método que suma el `monto_inicial`
  de la sección al calcular el teórico.
- **`Rol.codigo`** identifica el rol funcional que usan los permisos
  (`AD`, `GE`, `CA`, `VE`, `ED`). Es único y nullable: los roles que no son
  funcionales (ej. Chofer) quedan sin código y solo permiten lectura. La
  `ocupacion` es el nombre visible y puede cambiar sin romper permisos.

### `services/` — lógica de negocio

Convención: un módulo por dominio, con el mismo nombre que su sección de `models.py`.

```text
services/stock.py    → movimientos, FEFO/FIFO, stock negativo y restauración
services/caja.py     → apertura, cálculo del teórico y cierre con montos reales
services/ventas.py   → crear/confirmar/cancelar ventas y auto-cancelación
services/compras.py  → registrar compra y reponer stock al recibirla
services/pagos.py    → registrar pagos de ventas/compras y recalcular estado
```

Funciones principales:

| Módulo | Funciones |
|---|---|
| `stock.py` | `obtener_stock`, `consumir_stock`, `reponer_stock`, `restaurar_stock`, `recalcular_stock`, `deposito_predeterminado` |
| `caja.py` | `abrir_seccion`, `calcular_teorico`, `cerrar_seccion`, `auditar_seccion` |
| `ventas.py` | `crear_venta`, `confirmar_venta`, `cancelar_venta`, `cancelar_ventas_vencidas` |
| `compras.py` | `registrar_compra`, `recibir_compra` |
| `pagos.py` | `registrar_pago_venta`, `registrar_pago_compra` |

Reglas que respetan:

- `services/stock.py` es el único que escribe `DetalleStock` y recalcula
  `Stock.cantidad` como la suma de los detalles, dentro de la transacción.
  Usa `select_for_update` (con `of=('self',)` cuando hay joins nullable).
- `services/ventas.py` descuenta stock al crear la venta y lo restaura al
  cancelarla, revirtiendo los `MovimientoStock` originales. Rechaza con
  `StockInsuficiente` si se supera `Stock.cant_negativa_max`.
- `services/compras.py` exige proveedor activo y repone en el `Deposito` con
  `es_predeterminado=True` de la sucursal de la caja.
- `services/caja.py` calcula el teórico como pagos de ventas − pagos de compras
  + `monto_inicial` del método `es_efectivo`, y guarda el detalle por método.
- `services/pagos.py` no permite pagar de más, ni sobre un documento anulado,
  ni con un método inactivo. Recalcula el estado a `PARCIAL` o `PAGADA`.
- La auto-cancelación de ventas corre con
  `manage.py cancelar_ventas_vencidas [--minutos 30]`. La tarea
  `Corralon\CancelarVentasVencidas` la ejecuta cada 10 minutos
  (`scripts/programar_cancelacion.bat`).

Las vistas deben validar la entrada y **delegar** en los servicios, para que la
lógica sea reutilizable y testeable sin HTTP.

`Stock`, `DetalleStock`, `MovimientoStock`, `DetalleVenta`, `Factura` y
`DetalleCompra` son de solo lectura. `Venta`, `Compra`, `SeccionCaja` y los
pagos se escriben únicamente a través de acciones que llaman a los servicios;
no aceptan `PUT`/`PATCH`/`DELETE`.

### Facturación electrónica (ARCA) — bloqueada

`Factura` existe y es de solo lectura: **no hay emisión**. La integración queda
pendiente hasta tener CUIT del emisor, certificado `.crt`/`.key` y punto de venta
habilitado en ARCA. Mientras tanto el frontend muestra la sección en
mantenimiento.

Cuando se retome, el flujo tiene dos capas:

1. **WSAA** — se firma el TRA (PKCS#7) y ARCA devuelve `token` + `sign` por ~12 h.
   Hay que cachearlos: pedir otro antes de tiempo se rechaza.
2. **WSFEv1** — `FECompUltimoAutorizado` para el número siguiente y
   `FECAESolicitar` para el CAE del comprobante.

Reglas a respetar: empezar por **homologación**, no reintentar a ciegas después
de un timeout (consultar `FECompConsultar` antes de repetir, porque la
numeración es secuencial) y contemplar RG 5616 (`CondicionIVAReceptorId`) y
RG 4892 (QR oficial). `Cliente.condicion_iva` es texto libre; habrá que
normalizarlo a los códigos de ARCA.

### API REST — configuración base

Todo cuelga de `/api/` (`config/urls.py` → `app/urls.py`).

| Pieza | Configuración |
|---|---|
| Autenticación | JWT con `djangorestframework-simplejwt` |
| Login | `POST /api/token/` — acepta `username` **o** `legajo` (lo resuelve `UsuarioBackend`) |
| Refresco | `POST /api/token/refresh/` — rota el refresh y blacklistea el anterior |
| Tokens | Access 60 min · Refresh 7 días · header `Authorization: Bearer <token>` |
| Permisos | `PermisoPorRol`: lectura para autenticados, escritura según el rol |
| Errores de negocio | `app.exceptions.corralon_exception_handler` — `StockInsuficiente`/`ValueError` → `400` con `codigo` |
| Perfil | `GET /api/perfil/` — usuario, empleado, roles y códigos activos |
| Dashboard | `GET /api/dashboard/?periodo=hoy\|7d\|mes&sucursal=<id>` — KPIs, comparaciones, alertas, serie de ventas, cajas abiertas, compras por recibir y stock crítico |
| Paginación | `PageNumberPagination`, `PAGE_SIZE = 20` |
| Filtros | `DjangoFilterBackend` + `SearchFilter` + `OrderingFilter` |
| Routers | `DefaultRouter` en `app/urls.py` — 34 viewsets + `perfil` y `dashboard` |

El esquema sirve para web (React) y mobile (React Native): el cliente solo
necesita los dos endpoints de token y el header `Authorization`.

#### Rutas de la Fase 1

| Dominio | Prefijos |
|---|---|
| GEOGRAFIA | `paises`, `provincias`, `localidades`, `ubicaciones` |
| ORGANIZACION | `empresas`, `sucursales`, `usuarios`, `empleados`, `roles`, `empleados-roles`, `sucursales-empleados` |
| CAJA | `cajas` (CRUD, gerencia), `secciones-caja` (abrir/cerrar/auditar) |
| CATALOGO | `categorias`, `marcas`, `unidades`, `productos`, `productos-sucursales` |
| STOCK | `depositos` (CRUD, con sucursal y predeterminado), `stocks`, `detalles-stock` y `movimientos-stock` (solo lectura) |
| PROVEEDORES | `proveedores`, `proveedores-sucursales`, `productos-proveedores` |
| PAGOS | `metodos-pago` |
| VENTAS | `clientes` (CRUD), `ventas` (crear/confirmar/cancelar), `detalles-venta` y `facturas` (solo lectura), `metodos-pago-ventas` (registrar pago) |
| COMPRAS | `compras` (registrar/recibir), `detalles-compra` (solo lectura), `metodos-pago-compras` (registrar pago) |

#### Endpoints de escritura (Fase 2)

| Endpoint | Acción | Servicio |
|---|---|---|
| `POST /api/ventas/` | Crear venta pendiente y descontar stock | `ventas.crear_venta` |
| `POST /api/ventas/{id}/confirmar/` | Confirmar venta | `ventas.confirmar_venta` |
| `POST /api/ventas/{id}/cancelar/` | Anular y restaurar stock (`motivo` opcional) | `ventas.cancelar_venta` |
| `POST /api/compras/` | Registrar compra (no toca stock) | `compras.registrar_compra` |
| `POST /api/compras/{id}/recibir/` | Reponer stock en el depósito predeterminado | `compras.recibir_compra` |
| `POST /api/secciones-caja/` | Abrir sección (`empleado` sale del usuario) | `caja.abrir_seccion` |
| `POST /api/secciones-caja/{id}/cerrar/` | Cerrar con `montos_reales` por método | `caja.cerrar_seccion` |
| `POST /api/secciones-caja/{id}/auditar/` | Auditar una sección cerrada | `caja.auditar_seccion` |
| `POST /api/metodos-pago-ventas/` | Registrar pago de venta | `pagos.registrar_pago_venta` |
| `POST /api/metodos-pago-compras/` | Registrar pago de compra | `pagos.registrar_pago_compra` |

Los errores de negocio devuelven `400` con `{"detail": "...", "codigo": "..."}`;
`codigo` es `stock_insuficiente`, `error_de_negocio`, `validacion` o
`no_encontrado`.

#### Permisos por rol

Los roles funcionales viven en `Rol.codigo` (`AD`, `GE`, `CA`, `VE`, `ED`). Un
`EmpleadoXRol` activo otorga el código; `is_superuser` y `AD` pueden todo.
Sin rol, el usuario queda en solo lectura.

| Módulo | Admin | Gerente | Cajero | Vendedor | Enc. depósito |
|---|---|---|---|---|---|
| Geografía / Organización | ✍️ | ✍️ | 👁 | 👁 | 👁 |
| Usuarios | ✍️ | — | — | — | — |
| Catálogo | ✍️ | ✍️ | 👁 | 👁 | 👁 |
| Depósitos | ✍️ | ✍️ | 👁 | 👁 | ✍️ |
| Stocks / movimientos | 👁 | 👁 | 👁 | 👁 | 👁 |
| Proveedores | ✍️ | ✍️ | 👁 | 👁 | ✍️ |
| Clientes | ✍️ | ✍️ | ✍️ | ✍️ | 👁 |
| Cajas (registro) | ✍️ | ✍️ | 👁 | 👁 | 👁 |
| Secciones: abrir/cerrar | ✍️ | ✍️ | ✍️ | — | — |
| Secciones: auditar | ✍️ | ✍️ | — | — | — |
| Ventas: crear/confirmar | ✍️ | ✍️ | ✍️ | ✍️ | — |
| Ventas: cancelar | ✍️ | ✍️ | ✍️ | — | — |
| Compras | ✍️ | ✍️ | — | — | ✍️ |
| Pagos | ✍️ | ✍️ | ✍️ | — | ✍️ |
| Métodos de pago | ✍️ | ✍️ | 👁 | 👁 | 👁 |

Reglas de escritura:

- `Usuario` exige `IsAdminUser`; la contraseña es write-only y se guarda con
  `set_password()` (nunca se devuelve). `is_superuser` es de solo lectura.
- `Producto` no expone `sucursales` (M2M con `through`); se gestiona con
  `productos-sucursales`.
- Las tablas puente tienen endpoint propio.
- Los viewsets de escritura transaccional son `GenericViewSet` con
  `Create`/`List`/`Retrieve`: no aceptan `PUT`, `PATCH` ni `DELETE`.

### Auditoría — `django-simple-history`

`HistoricalRecords()` en los modelos críticos:

- ORGANIZACION: `Usuario` (con `excluded_fields=['password']`) y `Empleado`
- CATALOGO: `Producto`
- STOCK: `Stock`, `DetalleStock`, `MovimientoStock`
- PROVEEDORES: `Proveedor`
- CAJA: `SeccionCaja`, `DetalleCierreCaja`
- VENTAS: `Cliente`, `Venta`, `DetalleVenta`, `Factura`, `MetodoPagoXVenta`
- COMPRAS: `Compra`, `DetalleCompra`, `MetodoPagoXCompra`

`HistoryRequestMiddleware` guarda el usuario autenticado en `history_user`
(solo cuando la operación pasa por una request; en shell queda `None`).
Las tablas `Historical*` se crean en `0002_*`, `0003_*` (`HistoricalFactura`) y
`0004_*` (`HistoricalDetalleCierreCaja`, `HistoricalMovimientoStock`).

### Autenticación — `app/backends.py`

- `AUTH_USER_MODEL = 'app.Usuario'` (definido en `models.py`, sección ORGANIZACION)
- `AUTHENTICATION_BACKENDS = ['app.backends.UsuarioBackend']`
- `Usuario` extiende `AbstractUser` **solo con datos de login**; los datos
  personales/laborales viven en `Empleado` (OneToOne con `related_name='empleado'`).
- El backend permite iniciar sesión con **`username` o `legajo`** del empleado
  (`Q(username=...) | Q(empleado__legajo=...)`).
- El nombre `backends.py` es el estándar de Django (`AUTHENTICATION_BACKENDS`).
  **No renombrar** ni mover esa lógica a otro módulo.

### Otros puntos de configuración

- `.env` en la **raíz**; `python-decouple` lo encuentra subiendo desde `config/settings.py`.
- `CORS_ALLOW_ALL_ORIGINS = True` (solo válido para desarrollo).
- Email en consola (`MAILERS` con `console.EmailBackend`).
- `TIME_ZONE = 'UTC'`, `LANGUAGE_CODE = 'en-us'` (sin traducir todavía).

## 6. Frontend

React 19 + Vite 8, JavaScript y `.jsx`. Tailwind 4 con los tokens de la
referencia visual, React Router 7, Tabler Icons, SweetAlert2 y react-hook-form.

```text
frontend/src/
├── api/client.js             # fetch con JWT, refresh automático y errores
├── api/auth.js               # login (usuario o legajo), perfil y logout
├── context/AuthContext.jsx   # proveedor de sesión real (JWT)
├── context/auth-context.js   # AuthContext + useAuth
├── data/menuConfig.js        # categorías, módulos, roles e íconos
├── components/MenuDesplegable.jsx
├── components/Encabezado.jsx
├── components/sidebar/       # Header, Category, Item, Footer
├── components/common/        # InputField, InputPassword, ButtonSubmit
├── pages/Login.jsx
├── pages/Inicio.jsx          # dashboard contra /api/dashboard/
├── pages/EnDesarrollo.jsx    # provisional para módulos sin conectar
├── pages/Facturacion.jsx     # mantenimiento ARCA
├── pages/CambiarContrasena.jsx
├── styles/                   # Login, MenuDesplegable, Encabezado, Inicio, Placeholder
├── utils/formato.js
├── App.jsx  index.css  main.jsx
```

- Rutas: `/login` es pública; el resto vive dentro del layout protegido
  `MenuDesplegable`. `/` es el dashboard, cada módulo del menú tiene su ruta
  (hoy provisional) y `/facturacion` muestra la pantalla de mantenimiento.
- `useAuth()` expone `user` normalizado (`nombre`, `legajo`, `rol`, `codigos`),
  `cargando`, `login`, `logout`, `puedeVer(modulo)` y `puedeEscribir(roles)`.
- El menú se filtra con los códigos de rol de `menuConfig.js` (`AD`, `GE`, `CA`,
  `VE`, `ED`); `is_superuser` y `AD` ven todo. Un usuario sin rol solo ve Inicio
  y Perfil.
- Tokens en `localStorage` (`corralon.acceso` / `corralon.refresco`). Ante un
  `401`, `pedir()` renueva el access y reintenta una vez; si el refresh falla,
  limpia la sesión.
- Vite hace proxy de `/api` a `http://localhost:8000` (`vite.config.js`). Para
  apuntar a otro backend se usa `VITE_API_URL`.
- El dashboard Admin consume `GET /api/dashboard/` con filtros de sucursal y
  período (Hoy por defecto). Muestra franja de alertas, seis KPIs, evolución de
  ventas, cajas abiertas, últimas ventas, stock crítico, compras por recibir y
  accesos rápidos, con estados de carga, error y actualización manual.
- Facturación se muestra con un cartel de **mantenimiento** hasta habilitar ARCA.
- Verificación: `npm run lint` (0 warnings) y `npm run build`.

> **Pendiente:** conectar los módulos de negocio (ventas, compras, caja,
> productos, empleados, proveedores, perfil y actividad) y reemplazar
> `EnDesarrollo` por las pantallas reales, manteniendo esta paleta y estructura.

## 7. Datos de prueba

```bash
cd backend
python manage.py seed_data [--reset] [--ventas 50] [--compras 20]
```

- Idempotente para el usuario admin; `--reset` borra las tablas de negocio antes de poblar.
- Es determinista (`random.seed(42)`).
- Genera 180 días de historial de ventas/compras.
- Los depósitos quedan repartidos entre las sucursales, con uno predeterminado
  por sucursal. Cada lote está en un depósito de la misma sucursal que su stock
  y `Stock.cantidad` coincide con la suma de sus detalles.
- Las compras se procesan **antes** que las ventas: reponen stock en el depósito
  predeterminado de la sucursal y después las ventas lo consumen, así ninguna
  venta se rechaza por `StockInsuficiente`.
- Ventas y compras generan sus `MovimientoStock` (`VE`/`CO`) con la fecha del
  documento, y cada lote de compra queda con `fecha_ingreso = fecha_recepcion`.
- El stock inicial arranca con 100–300 unidades por lote (1–2 lotes por
  producto/sucursal) y `fecha_ingreso` anterior a los 180 días de historial.
- Las ventas `PENDIENTE` quedan dentro de la ventana de auto-cancelación (25
  minutos como máximo) para que el barrido no las anule al ejecutarse.
- Crea los roles funcionales con su `codigo` y asigna los empleados demo
  (Gerente, Cajero, Vendedor, Encargado de depósito). El rol Chofer queda sin
  código (solo lectura).
- Credenciales que crea: superusuario `admin` / `admin1234` y empleados demo
  con contraseña `test1234` (se listan al final de la ejecución).
- Cancelar una venta del seed restaura stock como en producción, porque el
  libro de movimientos está completo. Cubierto por `tests/test_seed.py`.

## 8. Convenciones de código

- **Idioma:** nombres de modelos, campos, `db_table` y `verbose_name` en español.
- `db_table` en MAYÚSCULAS y plural (`USUARIOS`, `SECCIONES_CAJA`, `METODO_DE_PAGO_X_COMPRAS`).
- `Meta` siempre con `ordering`, `verbose_name` y `verbose_name_plural`.
- Comillas simples en Python.
- Los modelos usan `TextChoices` para los estados (ej. `Caja.EstadoCaja`).
- No se usa `default_auto_field` explícito en los `AppConfig` (configuración mínima).
- Frontend: JS (no TS), archivos `.jsx`.

## 9. Verificación antes de cerrar cualquier cambio

```bash
cd backend
python manage.py check                            # 0 issues
python manage.py makemigrations --check --dry-run # "No changes detected" si no se tocaron modelos
python manage.py migrate                          # aplicar migraciones pendientes
python manage.py test app                         # 57 tests

cd ../frontend
npm run lint                                      # 0 warnings
npm run build                                     # compila la SPA
```

Si se tocaron modelos, generar la migración correspondiente y **no** editar
migraciones a mano.

## 10. Seguimiento diario — `DIA_SIGUIENTE.md`

En la raíz del repo existe `DIA_SIGUIENTE.md`, con **solo** lo que quedó pendiente
al cerrar la sesión anterior.

- Al **empezar** a trabajar: leerlo primero. Es la lista de tareas del día.
- Al **cerrar**: reescribirlo con lo que quedó pendiente. Lo terminado o descartado
  se **borra**; no es un historial (para eso está git).
- Se actualiza **junto con** `AGENTS.md`: si cambia el estado del proyecto, cambian los dos.
- Si no queda nada pendiente, el archivo contiene solo: `Sin pendientes.`

El contexto estable (arquitectura, convenciones, deuda técnica) vive en `AGENTS.md`.
Las tareas del día viven en `DIA_SIGUIENTE.md`.

## 11. Reglas para agentes

- **No mover** la lógica de modelos/vistas/admin a `backends.py`. Ese archivo es
  solo autenticación.
- **No cambiar** `AUTH_USER_MODEL` ni el nombre de las tablas.
- **No crear** apps Django nuevas por dominio sin decidirlo explícitamente con el usuario.
- **No dividir** `models.py` en un paquete `models/`: el agrupamiento es por comentarios.
- Los endpoints nuevos se registran en el `router` de `app/urls.py`, no en `config/urls.py`.
- **No inventar** archivos vacíos "por si acaso"; se crean cuando hay contenido real.
- Antes de reorganizar: verificar con los comandos de la sección 9.
- Al cerrar la sesión: actualizar `AGENTS.md` y reescribir `DIA_SIGUIENTE.md` (sección 10).
