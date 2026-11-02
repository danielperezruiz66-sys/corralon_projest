# AGENTS.md — Contexto del proyecto

> **Cómo mantener este archivo:** refleja el **estado real** del proyecto, no el ideal.
> Al terminar cada sesión de trabajo: actualizar "Estado actual" y borrar lo que ya
> no sea cierto o ya no aporte. Si algo deja de ser verdad, **se elimina** (no se deja
> tachado ni "histórico").
>
> Lo que **falta hacer** no va acá: va en `DIA_SIGUIENTE.md` (ver sección 9), que se
> reescribe en cada sesión y solo contiene lo pendiente del día anterior.
>
> `INSTRUCCIONES.md` es otra cosa: es la guía de instalación para el equipo.
> No mezclar ambos documentos.

**Última actualización:** 2026-11-01

---

## 1. Qué es el proyecto

**Corralón Fer-Cons** — sistema de gestión para un corralón de materiales de construcción.

Cubre: geografía, organización (empresas/sucursales/empleados), catálogo de
productos, stock por depósito, cajas y turnos, ventas, compras, facturación,
pagos y proveedores.

Arquitectura **desacoplada**:

- `backend/` → API REST con Django + DRF, PostgreSQL
- `frontend/` → React con Vite (JavaScript, sin TypeScript)

## 2. Estado actual (2026-11-01)

| Área | Estado |
|---|---|
| Estructura del repo (`backend/` + `frontend/`) | ✅ Hecha |
| Modelos de datos (33) en `models.py` por secciones | ✅ Hechos |
| Migración inicial (`0001_initial`) | ✅ Consistente con los modelos (`makemigrations --check` sin cambios) |
| Autenticación (login por usuario **o** legajo) | ✅ Funcional |
| Comando de datos de prueba (`seed_data`) | ✅ Funcional |
| Admin de Django | ✅ Configurado (Usuario + Empleado inline) |
| API REST — configuración base (JWT, paginación, permisos, filtros) | ✅ Lista — `/api/token/` y `/api/token/refresh/` funcionando |
| API REST — serializers, viewsets y rutas de negocio | ❌ **No empezada** |
| Lógica de negocio (`services/`) | ❌ **No empezada** — el paquete existe pero está vacío |
| Frontend | ❌ Scaffold de Vite sin tocar (sin llamadas a la API) |
| Tests | ❌ Solo el archivo `tests.py` vacío |

**Lo que sigue está en `DIA_SIGUIENTE.md`.**

> Estado del repo: la reestructuración (`backend/`, `frontend/`) está
> en el working tree **sin commitear**. Hay un solo commit previo (`30cadfb bd y migraciones`).

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
│   │   ├── models.py      # 33 modelos, agrupados por dominio con comentarios
│   │   ├── services/      # lógica de negocio (vacío por ahora)
│   │   ├── management/commands/seed_data.py
│   │   ├── migrations/    # 0001_initial + 0002 (tablas de historial)
│   │   ├── admin.py  apps.py  backends.py  urls.py  views.py  tests.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/              # scaffold Vite estándar
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

### Deuda conocida del modelo

Hechos del esquema actual (la acción de resolverlos está en `DIA_SIGUIENTE.md`):

- `Compra` no tiene FK a `Proveedor`: una compra no registra a quién se le compró.
- `DetalleCompra` no tiene depósito ni lote, así que al reponer stock no se sabe
  en qué `DetalleStock` entra.
- El stock está duplicado: `Stock.cantidad` (total por producto/sucursal) y
  `DetalleStock.cantidad` (por depósito/lote). Falta definir la fuente de verdad.

### `services/` — lógica de negocio

Convención: un módulo por dominio, con el mismo nombre que su sección de `models.py`.

```text
services/ventas.py   → registrar venta, calcular totales, aplicar pagos
services/caja.py     → abrir/cerrar sección de caja
services/stock.py    → movimientos y actualización de stock
```

Las vistas deben validar la entrada y **delegar** en los servicios, para que la
lógica sea reutilizable y testeable sin HTTP.

### API REST — configuración base

Todo cuelga de `/api/` (`config/urls.py` → `app/urls.py`).

| Pieza | Configuración |
|---|---|
| Autenticación | JWT con `djangorestframework-simplejwt` |
| Login | `POST /api/token/` — acepta `username` **o** `legajo` (lo resuelve `UsuarioBackend`) |
| Refresco | `POST /api/token/refresh/` — rota el refresh y blacklistea el anterior |
| Tokens | Access 60 min · Refresh 7 días · header `Authorization: Bearer <token>` |
| Permisos | `IsAuthenticated` global; solo los endpoints de token son públicos |
| Paginación | `PageNumberPagination`, `PAGE_SIZE = 20` |
| Filtros | `DjangoFilterBackend` + `SearchFilter` + `OrderingFilter` |
| Routers | `DefaultRouter` en `app/urls.py` (todavía sin viewsets registrados) |

El esquema sirve para web (React) y mobile (React Native): el cliente solo
necesita los dos endpoints de token y el header `Authorization`.

### Auditoría — `django-simple-history`

`HistoricalRecords()` en los modelos críticos:

- ORGANIZACION: `Usuario` (con `excluded_fields=['password']`) y `Empleado`
- CATALOGO: `Producto`
- STOCK: `Stock`, `DetalleStock`
- PROVEEDORES: `Proveedor`
- CAJA: `SeccionCaja`
- VENTAS: `Cliente`, `Venta`, `DetalleVenta`, `MetodoPagoXVenta`
- COMPRAS: `Compra`, `DetalleCompra`, `MetodoPagoXCompra`

`HistoryRequestMiddleware` guarda el usuario autenticado en `history_user`
(solo cuando la operación pasa por una request; en shell queda `None`).
Las tablas `Historical*` se crean en `migrations/0002_*`.

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

## 6. Datos de prueba

```bash
cd backend
python manage.py seed_data [--reset] [--ventas 50] [--compras 20]
```

- Idempotente para el usuario admin; `--reset` borra las tablas de negocio antes de poblar.
- Es determinista (`random.seed(42)`).
- Genera 180 días de historial de ventas/compras.
- Credenciales que crea: superusuario `admin` / `admin1234` y empleados demo
  con contraseña `test1234` (se listan al final de la ejecución).

## 7. Convenciones de código

- **Idioma:** nombres de modelos, campos, `db_table` y `verbose_name` en español.
- `db_table` en MAYÚSCULAS y plural (`USUARIOS`, `SECCIONES_CAJA`, `METODO_DE_PAGO_X_COMPRAS`).
- `Meta` siempre con `ordering`, `verbose_name` y `verbose_name_plural`.
- Comillas simples en Python.
- Los modelos usan `TextChoices` para los estados (ej. `Caja.EstadoCaja`).
- No se usa `default_auto_field` explícito en los `AppConfig` (configuración mínima).
- Frontend: JS (no TS), archivos `.jsx`.

## 8. Verificación antes de cerrar cualquier cambio

```bash
cd backend
python manage.py check                         # 0 issues
python manage.py makemigrations --check --dry-run  # "No changes detected" si no se tocaron modelos
python manage.py migrate                       # aplicar migraciones pendientes
```

Si se tocaron modelos, generar la migración correspondiente y **no** editar
migraciones a mano.

## 9. Seguimiento diario — `DIA_SIGUIENTE.md`

En la raíz del repo existe `DIA_SIGUIENTE.md`, con **solo** lo que quedó pendiente
al cerrar la sesión anterior.

- Al **empezar** a trabajar: leerlo primero. Es la lista de tareas del día.
- Al **cerrar**: reescribirlo con lo que quedó pendiente. Lo terminado o descartado
  se **borra**; no es un historial (para eso está git).
- Se actualiza **junto con** `AGENTS.md`: si cambia el estado del proyecto, cambian los dos.
- Si no queda nada pendiente, el archivo contiene solo: `Sin pendientes.`

El contexto estable (arquitectura, convenciones, deuda técnica) vive en `AGENTS.md`.
Las tareas del día viven en `DIA_SIGUIENTE.md`.

## 10. Reglas para agentes

- **No mover** la lógica de modelos/vistas/admin a `backends.py`. Ese archivo es
  solo autenticación.
- **No cambiar** `AUTH_USER_MODEL` ni el nombre de las tablas.
- **No crear** apps Django nuevas por dominio sin decidirlo explícitamente con el usuario.
- **No dividir** `models.py` en un paquete `models/`: el agrupamiento es por comentarios.
- Los endpoints nuevos se registran en el `router` de `app/urls.py`, no en `config/urls.py`.
- **No inventar** archivos vacíos "por si acaso"; se crean cuando hay contenido real.
- Antes de reorganizar: verificar con los comandos de la sección 8.
- Al cerrar la sesión: actualizar `AGENTS.md` y reescribir `DIA_SIGUIENTE.md` (sección 9).
