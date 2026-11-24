# AGENTS.md — Corralón Fer-Cons

> Contexto permanente y reglas del proyecto. Al empezar una sesión, leer
> `DIA_SIGUIENTE.md`. Reglas de documentación en §10.

**Última actualización:** 2026-11-23

## 1. Stack

- `backend/`: Django 6.1 + DRF + PostgreSQL 16 (puerto 5433 por defecto),
  Python 3.14. Venv en la raíz (`venv/`).
- `frontend/`: React 19 + Vite 8 + JavaScript (sin TypeScript) + Tailwind 4,
  React Router 7, Tabler Icons, SweetAlert2 y react-hook-form. Node 20+.
- API en `http://localhost:8000`; Vite en `http://localhost:5173`.
- `.env` en la raíz (no se commitea); plantilla en `.env.example`.

Estado: backend consolidado (35 modelos, 34 viewsets, suite en `app.tests`),
una sola sucursal operativa por empresa. Frontend con Dashboard, Ventas,
Compras, Clientes, Inventario, Proveedores, Caja, Empleados, Perfil, Actividad
y Configuración (solo AD/superuser). Falta la revisión/QA visual módulo por
módulo y las métricas del Dashboard V2. Facturación ARCA está bloqueada.

## 2. Estructura

```text
backend/
├── config/                 # settings, urls, asgi, wsgi
└── app/                    # ÚNICA app Django
    ├── models.py           # un solo archivo, 35 modelos por dominio
    ├── services/           # stock, caja, ventas, compras, pagos,
    │                       # proveedores, empleados
    ├── management/commands/# seed_data, cancelar_ventas_vencidas
    ├── migrations/         # 0001 esquema + 0002/0003 estado Parcial
    ├── tests/              # suite en app.tests (255 tests)
    ├── permissions.py  backends.py  exceptions.py
    └── serializers.py  views.py  urls.py
frontend/src/
├── api/  context/  pages/  components/  styles/
├── data/menuConfig.js  hooks/  utils/
└── App.jsx  index.css  main.jsx
```

Reglas fijas:

- Una sola app Django (`app`). No crear apps por dominio.
- `models.py` es un solo archivo; no dividirlo en un paquete `models/`.
- No cambiar `AUTH_USER_MODEL` (`app.Usuario`) ni los `db_table`.
- Endpoints nuevos en `app/urls.py`, no en `config/urls.py`.
- Una sola `Sucursal` por `Empresa` (validada, sin constraint de base).
- No crear archivos vacíos "por si acaso".
- Frontend: JavaScript y `.jsx` (no TypeScript).

## 3. Backend: reglas de negocio

### Stock

- Cantidades `DecimalField(12,3)`; importes `DecimalField(10,2)`.
- `DetalleStock` es la fuente de verdad; `Stock.cantidad` es la suma de sus
  detalles. Solo `services/stock.py` modifica detalles y recalcula.
- Lotes `LOT-{NNNNNN}` autogenerados; los ingresos crean lote nuevo. Un lote
  vive en un solo depósito y se mueve completo con `mover`.
- Piso negativo por `Stock.cant_negativa_max` (default `-10`).
- `Deposito.es_predeterminado`: uno por sucursal; la compra sin depósito usa
  el central.
- `GET /api/stocks/` sin `?sucursal=` muestra todas las sucursales (lectura
  estratégica). Operar (vender, ajustar, recibir) sigue atado a la sucursal.
- Ajuste detallado por lote: `POST /api/stocks/{id}/ajustar/`.

### Catálogo

- `Cliente`: activo/inactivo; al crear exige documento y al menos un contacto.
  Un cliente inactivo no se ofrece ni se acepta en ventas.
- `Producto`: precio > 0 y al menos una sucursal activa; al crear por API exige
  proveedor y costo. El precio debe superar el costo activo más alto.
- `Proveedor`: CUIT, nombre, razón social y al menos una sucursal activa. Los
  costos viven en `ProductoXProveedor.precio_lista`.

### Ventas

- Estados: `PE` Pendiente (sin pagos), `PC` Parcial (pagos parciales), `CO`
  Confirmada (pagada y confirmada son lo mismo), `AN` Anulada.
- Nace `PE` y descuenta stock. Pago parcial → `PC`; pago total → `CO`
  automáticamente.
- Solo `PE` sin pagos vence a los 30 min (`VENTAS_MINUTOS_PARA_CONFIRMAR`) y
  puede anularse manualmente. `PC`/`CO` no vencen y requieren reversión de pagos
  para anular (pendiente).
- La alerta de vencimiento se muestra a `AD/GE/CA`.
- `Venta.cliente_venta` es el nombre libre opcional del consumidor final.

### Compras

- `estado_entrega`: `PE` Pendiente, `EC` En camino, `RE` Recibida.
- Estado de pago: `PE`/`PC`/`PA`/`AN`, independiente de la entrega.
- Registrar o poner en camino no mueve stock; `recibir` repone `Compra.deposito`
  (o el central) con lote nuevo y deja `RE`.
- `fecha_estimada_llegada` obligatoria en `EC` y no anterior a `fecha_compra`.
- Anular solo si no está recibida y no tiene pagos, con motivo.
- Crear/registrar, en-camino y recibir: `AD/GE/ED/CA/VE`; `ED` registra en
  `PE` sin fecha estimada. Pagar y anular: solo `AD/GE`.

### Caja

- `Caja` tiene FK a `Sucursal` y `numero_caja` único por sucursal. No se
  elimina: solo cambia de estado (`AC`/`IN`/`MT`); la API no acepta `DELETE`.
- `MovimientoCaja` es la sesión: `AB` abierta, `PA` en pausa, `CE` cerrada,
  `AU` auditada. Máximo 1 `AB`/`PA` por caja y por empleado.
- Pausar exige motivo; reanudar acepta la contraseña del dueño o la del gestor
  (`AD/GE`). Cerrar exige la contraseña del usuario autenticado y observaciones
  de al menos 10 caracteres. `AD/GE` pueden auditar.
- Solo `CA` abre en sucursales asignadas; `AD/GE` en cualquiera y pueden abrir
  a nombre de otro empleado habilitado (queda auditado).
- En pausa no se venden, cobran ni arquear; primero se reanuda.
- `DetalleCierreCaja` guarda sistema vs. real por método. Al cerrar, “Contado”
  arranca en el teórico; una diferencia genera nota inborrable en
  `observaciones`.
- Monto inicial sugerido = efectivo del último cierre de esa caja; si difiere,
  `observaciones_apertura` es obligatoria.

### Roles

| Módulo | AD | GE | CA | VE | ED |
|---|---|---|---|---|---|
| Ventas | ✔ | ✔ | ✔ | ✔ | ✖ |
| Compras | ✔ | ✔ | ✔ | ✔ | ✔ |
| Clientes | ✔ | ✔ | ✔ | ✔ | ✖ |
| Inventario | ✔ | ✔ | consulta | consulta | ✔ |
| Proveedores | ✔ | ✔ | consulta | consulta | ✔ |
| Caja | ✔ | ✔ | ✔ | ✖ | ✖ |
| Empleados | ✔ | ✔ | ✖ | ✖ | ✖ |
| Facturación | ✔ | ✔ | ✔ | ✖ | ✖ |
| Perfil / Actividad | ✔ | ✔ | perfil | perfil | perfil |
| Configuración | ✔ | ✖ | ✖ | ✖ | ✖ |

Cobrar/confirmar/anular ventas: `AD/GE/CA`. Pagar/anular compras: `AD/GE`.
`is_superuser` y `AD` pueden todo. Sin rol = solo lectura. Un empleado
suspendido/inactivo no accede (login y API). El cambio de contraseña de un
empleado es solo `AD` y exige `password_admin`. En caja, `CA` y roles no gestión
solo ven sus propios movimientos; `GE` ve los de sus sucursales.

### Auditoría e idempotencia

- `django-simple-history` en modelos críticos; `HistoryRequestMiddleware`
  registra el usuario. El motivo se guarda en `instancia._change_reason`.
- `RegistroActividad` consolida los cambios y se consulta en
  `GET /api/actividad/` y `/api/actividad/resumen/`.
- Pagos y cierre de caja aceptan `clave` de idempotencia; reintentar con la
  misma clave no duplica la operación.

## 4. Servicios y escrituras

La lógica vive en `backend/app/services/`; las vistas validan y delegan.

| Módulo | Funciones principales |
|---|---|
| `stock.py` | `obtener_stock`, `consumir_stock`, `reponer_stock`, `restaurar_stock`, `recalcular_stock`, `ajustar_stock_detallado`, `cargar_stock_sucursal`, `mover_lote` |
| `empleados.py` | `sincronizar_roles`, `sincronizar_sucursales`, `cambiar_password` |
| `caja.py` | `sugerir_apertura`, `abrir_seccion`, `calcular_teorico`, `cerrar_seccion`, `auditar_seccion`, `pausar_seccion`, `reanudar_seccion` |
| `ventas.py` | `crear_venta`, `confirmar_venta`, `cancelar_venta`, `cancelar_ventas_vencidas` |
| `compras.py` | `registrar_compra`, `anular_compra`, `marcar_en_camino`, `recibir_compra` |
| `pagos.py` | `registrar_pago_venta`, `registrar_pagos_venta`, `registrar_pago_compra`, `registrar_pagos_compra` |
| `proveedores.py` | `asociar_productos` |

`Stock`, `DetalleVenta`, `Factura`, `DetalleCompra` y `MovimientoCaja` no se
editan con `PUT`/`PATCH`/`DELETE` general. `DetalleStock` solo permite editar
`fecha_venc` y `observaciones` (la nota de origen no se borra). Ventas, compras,
caja y pagos se escriben mediante acciones/servicios.

Los pagos no permiten pagar de más, pagar documentos anulados ni usar métodos
inactivos; `registrar_pagos_*` guarda varios métodos en una sola transacción.

## 5. API y permisos

- JWT: `POST /api/token/` (usuario o legajo) y `/api/token/refresh/`.
- Paginación 20; filtros DjangoFilter + Search + Ordering.
- Errores: `400 {"detail": "...", "codigo": "..."}` con `stock_insuficiente`,
  `error_de_negocio`, `validacion`, `no_encontrado` o `protegido`.
- 34 viewsets en `app/urls.py` + `GET /api/perfil/`, `GET /api/dashboard/`,
  `GET /api/actividad/` y `/api/actividad/resumen/`. `GET /api/perfil/`
  devuelve `dni`, `telefono`, `estado`, `estado_detalle` e `is_active` del
  empleado/usuario.
- `/api/empresas/` es de lectura y escritura solo para `AD`/superuser; el CUIT
  es único y se normaliza antes de validar. Un rol `AD` ve solo la empresa de
  sus sucursales asignadas; el superuser ve todas.
- El dashboard respeta las sucursales permitidas (superuser/AD ven todas; una
  sucursal ajena devuelve 403), devuelve `bloques` por rol y separa
  `ventas.pendientes` (`PE`) de `ventas.parciales` (`PC`).
- Escrituras clave:
  - `POST /api/ventas/`, `/{id}/cobrar/`, `/{id}/confirmar/`, `/{id}/cancelar/`.
  - `PATCH /api/stocks/{id}/` (mínimos) y `POST /api/stocks/{id}/ajustar/`.
  - `POST /api/detalles-stock/{id}/mover/`.
  - `POST /api/compras/`, `/{id}/en-camino/`, `/{id}/recibir/`, `/{id}/pagar/`,
    `/{id}/anular/`.
  - `POST /api/movimientos-caja/`, `/{id}/cerrar/`, `/{id}/pausar/`,
    `/{id}/reanudar/`, `/{id}/auditar/`, `/{id}/teorico/`, `/mia/`,
    `/sugerencia/`.
  - `POST /api/empleados/`, `/{id}/cambiar-password/`.
- `Usuario` exige `IsAdminUser`; contraseña write-only. Editar el propio perfil
  (`PATCH /usuarios/{id}/`) exige `AD`/superuser y usa `UsuarioPerfilSerializer`.
  `Producto` acepta `sucursales` y sincroniza `ProductoXSucursal`.

## 6. Frontend

- Rutas protegidas; `/login` pública. `useAuth()` expone `user`, `login`,
  `logout`, `puedeVer(modulo)` y `puedeEscribir(roles)`.
- Sin selector de sucursal en el encabezado: `SucursalContext` usa la única
  sucursal asignada y los listados filtran con `sucursalActiva`.
- Tokens en `localStorage` (`corralon.acceso` / `corralon.refresco`); ante 401,
  `pedir()` renueva y reintenta una vez.
- Módulos: Dashboard, Ventas, Compras, Clientes, Inventario, Proveedores, Caja,
  Empleados, Perfil, Actividad y Configuración. Facturación muestra mantenimiento.
- El menú lateral inicia cerrado (solo iconos) y las categorías arrancan
  colapsadas al entrar; el usuario las abre a mano.
- **Cache en memoria + actualización en segundo plano**: patrón obligatorio en
  cada módulo que se revise. Se cachea la última respuesta por usuario y
  sucursal, se muestra al volver y se refresca sin bloquear. Inicio y
  Configuración ya lo hacen (refresco cada 15 s y al enfocar la ventana).
- Perfil y Configuración comparten `frontend/src/styles/DatosCuenta.css`:
  cabecera con avatar, grilla de campos inline y edición solo para
  `AD`/superuser. DNI/CUIT, legajo y estado son solo lectura.
- Ventas: pestañas Pendientes/Parciales/Confirmadas/Anuladas y filtro Vencidas.
  Pago parcial → Parcial; pago total → Confirmada. El cobro no pide confirmación
  extra. No existe “Por vencer” en la UI.
- Dashboard: 4 tarjetas (hoy, últimos 7 días, mes calendario, parciales).
  Alertas: vencidas → Ventas con filtro; stock negativo/bajo → tarjeta Stock
  crítico; compras por recibir → tarjeta Compras por recibir. Sin alerta de
  cajas. Los mini-datos y las filas de stock crítico no navegan.
- Inventario: alta/edición de producto exige proveedor y costo; selectores con
  atajo `+`; stock con lotes, ajuste detallado y “mover lote”; filtros de stock
  visibles en el select (sin tarjeta “Filtro del dashboard”).
- Compras: el selector muestra solo productos del proveedor; recepción con
  depósito; pagar/anular solo `AD/GE`.
- Convenciones UI: búsqueda con debounce, filtros en la URL, cobro
  multi-método, validaciones en `utils/validaciones.js`, `CampoSelectorBuscable`
  con búsqueda remota y alta rápida.

## 7. Facturación

`Factura` existe y es solo lectura; no hay emisión. Falta CUIT del emisor,
certificado `.crt`/`.key` y punto de venta. Al retomar: homologación, WSAA
(token/sign cacheados), WSFEv1 (`FECompUltimoAutorizado` + `FECAESolicitar`),
consultar `FECompConsultar` ante timeout, RG 5616 y RG 4892 (QR).

## 8. Comandos y verificación

```bash
cd backend
../venv/Scripts/python.exe manage.py check
../venv/Scripts/python.exe manage.py makemigrations --check --dry-run
../venv/Scripts/python.exe manage.py migrate
../venv/Scripts/python.exe manage.py test app              # 255 tests
../venv/Scripts/python.exe manage.py seed_data [--reset] [--ventas 240] [--compras 72]
../venv/Scripts/python.exe manage.py cancelar_ventas_vencidas [--minutos 30]

cd ../frontend
npm run lint                                               # 0 warnings
npm run build
```

Antes de cerrar un cambio: check, makemigrations, migrate, tests, lint y build.
No editar migraciones a mano. Seed determinista (`random.seed(42)`): una
sucursal (Salta Capital), `admin`/`admin1234`, empleados demo
`admin.salta`, `gerente.salta`, `cajero.salta`, `vendedor.salta` y
`deposito.salta` con `test1234`, 6 meses de compras/ventas en `PE`/`PC`/`CO`.
El barrido de vencidas es manual; no programar tarea.

## 9. Convenciones

- Modelos, campos, `db_table` y `verbose_name` en español.
- `db_table` en MAYÚSCULAS y plural (`USUARIOS`, `MOVIMIENTOS_CAJA`).
- `Meta` con `ordering`, `verbose_name` y `verbose_name_plural`.
- Comillas simples en Python; `TextChoices` para estados.
- Frontend: JavaScript y `.jsx`.

## 10. Documentación y cierre

| Archivo | Uso | Regla |
|---|---|---|
| `AGENTS.md` | Arquitectura, reglas de negocio, API y convenciones | Fuente de verdad. Actualizar solo si cambia el estado o una regla. No copiar pendientes. |
| `DIA_SIGUIENTE.md` | Único lugar de pendientes | Leer al empezar. Reescribir al cerrar solo con lo que falta; lo terminado se borra. Sin arquitectura. |
| `INSTRUCCIONES.md` | Instalación, ejecución y seed para el equipo | Actualizar si cambian comandos, dependencias, puertos o datos del seed. Sin pendientes. |
| `contraseñas.md` | Credenciales demo | Mantener alineado al seed. Nunca secretos de producción. |
| `frontend/README.md` | Boilerplate de Vite | Ignorar como fuente del proyecto. |

Cierre de sesión:

1. Leer `DIA_SIGUIENTE.md` al empezar.
2. Actualizar `AGENTS.md` si cambió el estado o una regla.
3. Reescribir `DIA_SIGUIENTE.md` solo con lo pendiente; si no queda nada,
   escribir `Sin pendientes.`
4. No duplicar contenido entre archivos: cada dato vive en el archivo de la
   tabla de arriba.
