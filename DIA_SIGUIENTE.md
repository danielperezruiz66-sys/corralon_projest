# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-03

## 1. Frontend — migrar al diseño de `Fer-Cons-feature-api-rest-auth`

**Estado:** planificado, **sin implementar**. La base actual del front (login JWT,
perfil, productos, facturación en mantenimiento) sigue siendo la que corre.

**Referencia:** `C:\Users\Fernando\Desktop\Fer-Cons-feature-api-rest-auth`
(React 18 + Vite 5 + Tailwind 4 + Tabler + react-router 6 + SweetAlert2 +
react-hook-form; datos mock, login falso contra `fakestoreapi.com`).

### 1.1 Qué se copia y qué no

Se copia el **formato visual y la estructura de componentes**: paleta,
tipografía, login, layout con sidebar, encabezado, tablas, búsqueda, filtros,
modal, FAB, paginación "ver más", perfil y actividad.

**No** se copia la lógica mock: el login, el perfil y los listados se conectan a
la API Django real que ya existe.

### 1.2 Diseño a replicar

Tokens Tailwind (`@theme`):

| Token | Hex | Uso |
|---|---|---|
| `--color-login` | `#326f7a` | fondo del login |
| `--color-campo` | `#5ba8b0` | inputs del login |
| `--color-oscuro` | `#0f2a30` | texto, botones, activos |
| `--color-sidebar` | `#4a9da8` | sidebar |
| `--color-fondo` | `#dff0f3` | fondo general |
| `--color-tarjeta` | `#cfeff3` | tarjetas |
| `--color-circulo` | `#a9e0ea` | detalles |
| `--color-navy` | `#1f3a8a` | acento secundario |

- Fuente **Abel** (Google Fonts) en `index.html`, aplicada al `body`.
- **Login:** pantalla completa `#326f7a`, 4 círculos blancos translúcidos,
  tarjeta central de 28rem, logo blanco, inputs pill `#5ba8b0` con ícono y ojo
  para ver contraseña, botón pill oscuro de 18rem, enlaces blancos.
- **Layout:** sidebar `#4a9da8` sticky `100vh`, 16rem abierto / 6rem colapsado,
  visible desde 768px; en móvil header con menú superpuesto. Fondo `#dff0f3`.
- **Sidebar:** logo + toggle, categorías colapsables, ítems con ícono + nombre +
  detalle, footer con avatar de iniciales, usuario, cambiar contraseña y cerrar
  sesión (confirmación SweetAlert).
- **Encabezado:** título + subtítulo y tarjeta con nombre/legajo a la derecha;
  acepta botón "volver" en móvil.
- **Tabla:** blanca, `rounded-2xl`, sombra suave, header con borde, celdas
  centradas, `min-width: 800px` con scroll horizontal.
- **SearchBar:** pill blanca con lupa. **FilterTabs:** pills, activo oscuro.
  **FilterSelect:** select con chevron. **Modal:** overlay oscuro, tarjeta
  blanca, X, validación con SweetAlert. **FAB:** circular flotante. **LoadMore:**
  pill "Ver más registros".
- **Perfil:** cabecera con avatar de iniciales, badge de rol y estado
  activo/inactivo; grilla de campos con ícono; edición solo Admin y aviso de
  solo lectura para el resto.
- SweetAlert2 con `confirmButtonColor: '#0d9488'`.

### 1.3 Estructura objetivo

```text
frontend/src/
├── main.jsx                  # BrowserRouter > AuthProvider > App
├── App.jsx                   # rutas declarativas
├── index.css                 # Tailwind 4 + tokens + body
├── context/AuthContext.jsx   # auth real (JWT) con la interfaz de la referencia
├── data/menuConfig.js        # menú por categorías, roles e íconos
├── hooks/usePagination.js
├── components/
│   ├── MenuDesplegable.jsx
│   ├── Encabezado.jsx
│   ├── ActividadItem.jsx
│   ├── sidebar/              # Header, Category, Item, Footer
│   └── common/               # Table, SearchBar, FilterTabs, FilterSelect,
│                             # ModalForm, Fab, LoadMore, InputField,
│                             # InputPassword, ButtonSubmit
├── pages/                    # Login, Inicio, Actividad, Empleados,
│                             # Proveedores, Perfil, CambiarContrasena
└── styles/                   # un CSS por componente/página
```

Se conservan `api/client.js` (JWT + refresh + errores) y `api/auth.js`.
`auth/*` se reemplaza por `context/AuthContext.jsx` con la misma lógica.

### 1.4 Fases

**Fase 0 — Dependencias y configuración**
- [ ] Instalar `react-router-dom` (v7), `@tabler/icons-react`, `sweetalert2`,
      `react-hook-form`.
- [ ] Instalar dev `tailwindcss` + `@tailwindcss/vite`.
- [ ] `vite.config.js`: plugin Tailwind + mantener proxy `/api`.
- [ ] `index.html`: `lang="es"`, fuente Abel, título.
- [ ] `index.css`: `@import "tailwindcss"` + `@theme` con los 8 tokens + `body`.
- [ ] Quitar `App.css` y estilos viejos cuando cada pantalla esté reemplazada.
- [ ] **Verificar** compatibilidad de `@tailwindcss/vite` con Vite 8.3.5. Si
      falla, fijar la versión de Tailwind que soporte Vite 8 o usar PostCSS.

**Fase 1 — Auth + rutas**
- [ ] `context/AuthContext.jsx` con `user`, `login`, `logout`; `user` desde
      `/api/perfil/`.
- [ ] `main.jsx` con `BrowserRouter` + `AuthProvider`.
- [ ] `App.jsx`: `/login` pública, `/cambiar-contrasena` protegida, layout
      protegido con `Outlet` y catch-all.
- [ ] Helper `puedeVer(modulo, roles)` para menú y rutas.
- [ ] Roles reales: **Administrador, Gerente, Cajero, Vendedor, Encargado de
      depósito**.

**Fase 2 — Layout y menú**
- [ ] Copiar `MenuDesplegable`, `sidebar/*` y su CSS.
- [ ] Reescribir `menuConfig.js` con módulos reales:
      Principal (Inicio), Comercial (Ventas, Compras), Inventario
      (Stock/Productos, Proveedores), Administración (Caja, Empleados,
      Facturación en mantenimiento), Sistema (Perfil, Actividad).
- [ ] `Encabezado` con nombre y legajo reales.

**Fase 3 — Componentes comunes**
- [ ] Copiar `GenericTable`, `SearchBar`, `FilterTabs`, `FilterSelect`,
      `GenericModalForm`, `GenericFab`, `LoadMoreButton`, `InputField`,
      `InputPassword`, `ButtonSubmit`, `ActividadItem`, `Encabezado` y
      `usePagination`, con sus CSS.
- [ ] Agregar estado vacío, de carga y de error (la referencia no los tiene).

**Fase 4 — Páginas (primera tanda)**
- [ ] Login (`POST /api/token/` + SweetAlert).
- [ ] Inicio (`/api/perfil/` + resumen de ventas/stock).
- [ ] Perfil (`/api/perfil/`, `/api/empleados/:id`).
- [ ] Cambiar contraseña — **requiere endpoint nuevo en backend** (hoy no existe).
- [ ] Empleados (`/api/empleados/`, `/api/roles/`, `/api/sucursales/`).
- [ ] Proveedores (`/api/proveedores/`).
- [ ] Actividad — depende de la decisión 1.5.3.

**Fase 5 — Módulos de negocio (segunda tanda)**
- [ ] Productos/Stock re-estilizado con `/api/productos/` y `/api/stocks/`.
- [ ] Ventas con `/api/ventas/` + confirmar/cancelar.
- [ ] Compras con `/api/compras/` + registrar/recibir.
- [ ] Caja con `/api/secciones-caja/` + cierre.
- [ ] Facturación visible y bloqueada con cartel de mantenimiento (ARCA).

### 1.5 Decisiones a tomar antes de implementar

1. **Alcance de la primera tanda:** ¿Fase 0–4 completa (login, inicio, perfil,
   empleados, proveedores) o solo esqueleto visual (login + layout + inicio)
   para validar el diseño?
2. **Pedidos y Presupuestos:** no existen en el backend. ¿Omitirlos del menú
   (recomendado) o mostrarlos como "mantenimiento"?
3. **Actividad:** no hay endpoint de historial. ¿Alimentarla con
   `movimientos-stock` + ventas + compras (sin tocar backend) o agregar un
   endpoint nuevo de `simple-history` (requiere backend)?
4. **`prop-types`:** la referencia lo usa en `Encabezado`. ¿Instalarlo por
   fidelidad o quitarlo para no sumar dependencia?
5. **Confirmación:** reemplazar la estructura actual del front conservando
   `api/client.js` y la lógica de `AuthProvider`. ¿Correcto?

### 1.6 Límites de la referencia (no copiar)

- Login falso contra `fakestoreapi.com`; sin JWT ni persistencia.
- Todos los listados con datos mock.
- Links muertos: Ventas, Pedidos, Presupuestos, Stock, Facturación y Caja no
  tienen página.
- Perfil y Cambiar contraseña no llaman a ninguna API.
- Roles simplificados a Administrador/Empleado.
- Sin estados de carga/error/vacío ni tests.

## 2. Frontend — funcionalidad de negocio pendiente

- [ ] Ventas: crear, confirmar y cancelar (usan `POST /api/ventas/` y las acciones).
- [ ] Caja: abrir/cerrar sección y registrar pagos por método.
- [ ] Compras: registrar y recibir.
- [ ] Alta/edición de productos (solo Admin/Gerente, con `puedeEscribir`).
- [ ] Aplicar `puedeEscribir` a las acciones de escritura cuando existan.
- [ ] Probar en el navegador el refresh automático del token y el cierre de sesión.

## 3. Facturación (ARCA)

- [ ] **Bloqueado:** no hay CUIT, certificado `.crt`/`.key` ni punto de venta
      habilitado. La integración WSAA + WSFEv1 queda documentada en `AGENTS.md`.
- [ ] No hay servicio ni endpoint para emitir `Factura` (hoy es solo lectura).

## 4. Operación del barrido

- [ ] Verificar la tarea `Corralon\CancelarVentasVencidas` en un arranque sin
      sesión iniciada (registrarla con cuenta de servicio si hiciera falta).

## 5. Commit

- [ ] Commitear la Fase 2 del backend, el seed con movimientos y la base del
      frontend (sin commitear todavía por decisión del usuario).
