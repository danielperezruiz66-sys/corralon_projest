# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-03

## 1. Frontend — rediseño (en curso)

**Hecho en esta sesión**

- Fase 0: Tailwind 4 + `@tailwindcss/vite`, react-router-dom 7, Tabler Icons,
  SweetAlert2 y react-hook-form. Tokens de color y fuente Abel en `index.css`.
- Fase 1: `context/AuthContext.jsx` con la lógica JWT real, `user` normalizado,
  `puedeVer` y `puedeEscribir`; rutas protegidas con `BrowserRouter`.
- Fase 2: layout con sidebar colapsable, drawer móvil, menú por categorías y
  roles reales (`AD`, `GE`, `CA`, `VE`, `ED`), `Encabezado` y footer de usuario.
- Login rediseñado con el formato de `Fer-Cons-feature-api-rest-auth`.
- Inicio convertido en **dashboard estadístico** contra `GET /api/dashboard/`:
  KPIs de ventas/compras/stock/caja, serie de 7 días, últimas ventas, stock
  crítico y accesos rápidos.
- Backend: endpoint `GET /api/dashboard/` + 2 tests (total **53/53** pasando).
- Commit de resguardo del estado anterior: `205e89e`.

**Pendiente inmediato**

- [ ] Validar el diseño del login y del dashboard con el usuario.
- [ ] Definir los campos de cada módulo mirando la paleta y los componentes ya
      creados.
- [ ] Fase 3: componentes comunes que faltan (tabla genérica, búsqueda, filtros,
      modal, FAB, paginación "ver más") a medida que se conecten las pantallas.
- [ ] Fase 4: Perfil, Empleados y Proveedores contra la API real.
- [ ] Cambiar contraseña: **requiere endpoint nuevo en backend**.
- [ ] Actividad: definir fuente (recomendado: movimientos + ventas + compras).
- [ ] Fase 5: Ventas, Compras, Caja, Productos/Stock y Facturación.
- [ ] Aplicar `puedeEscribir` a todas las acciones de escritura.
- [ ] Probar en navegador el refresh automático del token y el cierre de sesión.

## 2. Decisiones tomadas

- Pedidos y Presupuestos: **se omiten** del menú (no existen en el backend).
- `prop-types`: **no se instala** (se usan parámetros por defecto).
- El alcance inicial es login + layout + dashboard; el resto se analiza por tandas.
- El menú muestra todos los módulos disponibles; los que aún no tienen pantalla
  real abren `EnDesarrollo` y Facturación abre la pantalla de mantenimiento.

## 3. Facturación (ARCA)

- [ ] **Bloqueado:** no hay CUIT, certificado `.crt`/`.key` ni punto de venta
      habilitado. La integración WSAA + WSFEv1 queda documentada en `AGENTS.md`.
- [ ] No hay servicio ni endpoint para emitir `Factura` (hoy es solo lectura).

## 4. Operación del barrido

- [ ] Verificar la tarea `Corralon\CancelarVentasVencidas` en un arranque sin
      sesión iniciada (registrarla con cuenta de servicio si hiciera falta).

## 5. Commit

- [x] Commit del estado previo al rediseño (`205e89e`).
- [ ] Commit de la implementación del rediseño, después de la revisión visual.
