# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-04

## 1. Frontend — dashboard Admin (V1 cerrado)

**Hecho en esta sesión**

- Fase 0: Tailwind 4 + `@tailwindcss/vite`, react-router-dom 7, Tabler Icons,
  SweetAlert2 y react-hook-form. Tokens de color y fuente Abel en `index.css`.
- Fase 1: `context/AuthContext.jsx` con la lógica JWT real, `user` normalizado,
  `puedeVer` y `puedeEscribir`; rutas protegidas con `BrowserRouter`.
- Fase 2: layout con sidebar colapsable, drawer móvil, menú por categorías y
  roles reales (`AD`, `GE`, `CA`, `VE`, `ED`), `Encabezado` y footer de usuario.
- Login rediseñado con el formato de `Fer-Cons-feature-api-rest-auth`.
- **Dashboard Admin V1**:
  - Filtro por sucursal (Todas por defecto) y período Hoy / 7 días / Mes.
  - Franja de alertas: ventas por vencer, stock negativo/bajo, compras sin
    recibir y cajas abiertas.
  - Seis KPIs: ventas del período (con comparación), ticket promedio, ventas del
    mes, pendientes, cajas abiertas y compras por recibir.
  - Evolución de ventas (7 días o mes), cajas abiertas con sección en curso,
    últimas ventas, stock crítico, compras por recibir y accesos rápidos.
  - Solo enlaces a módulos; sin acciones rápidas de negocio.
- Backend: `GET /api/dashboard/` ampliado con `periodo`, `sucursal`, comparación
  contra el período anterior, alertas, cajas abiertas y compras por recibir.
  Total **57/57 tests** pasando.
- Commits: `205e89e` (resguardo) y `b67e98b` (rediseño inicial).

**Pendiente inmediato**

- [ ] Revisar el dashboard con el usuario y ajustar textos/orden si hace falta.
- [ ] Definir las métricas V2 del dashboard: top productos, formas de pago,
      ventas por sucursal, diferencias de caja y actividad reciente.
- [ ] Elegir el próximo módulo del menú para desarrollar (Ventas, Compras, Caja,
      Stock/Productos, Proveedores, Empleados, Perfil o Actividad).
- [ ] Fase 3: componentes comunes que falten (tabla genérica, búsqueda, filtros,
      modal, FAB, paginación "ver más") a medida que se conecten las pantallas.
- [ ] Cambiar contraseña: **requiere endpoint nuevo en backend**.
- [ ] Actividad: definir fuente (recomendado: movimientos + ventas + compras).
- [ ] Aplicar `puedeEscribir` a todas las acciones de escritura.
- [ ] Probar en navegador el refresh automático del token y el cierre de sesión.

## 2. Decisiones tomadas

- El Inicio Admin usa **Hoy** como período por defecto.
- El Admin ve **todas las sucursales** y puede elegir una con el selector.
- El dashboard solo tiene **enlaces** a los módulos, sin acciones de escritura.
- Se incluyen **Cajas abiertas** (secciones en curso) y **Compras por recibir**.
- Las métricas V2 se definen más adelante.
- Por ahora se trabaja solo la vista de **Administrador**; los demás roles se
  replantean después de consolidar Admin.
- Pedidos y Presupuestos: **se omiten** del menú (no existen en el backend).
- `prop-types`: **no se instala** (se usan parámetros por defecto).

## 3. Facturación (ARCA)

- [ ] **Bloqueado:** no hay CUIT, certificado `.crt`/`.key` ni punto de venta
      habilitado. La integración WSAA + WSFEv1 queda documentada en `AGENTS.md`.
- [ ] No hay servicio ni endpoint para emitir `Factura` (hoy es solo lectura).

## 4. Operación del barrido

- [ ] Verificar la tarea `Corralon\CancelarVentasVencidas` en un arranque sin
      sesión iniciada (registrarla con cuenta de servicio si hiciera falta).

## 5. Commit

- [x] Commit del estado previo al rediseño (`205e89e`).
- [x] Commit del rediseño inicial (`b67e98b`).
- [ ] Commit del dashboard Admin V1.
