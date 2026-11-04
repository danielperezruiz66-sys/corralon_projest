# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-04

## 1. Frontend — dashboard Admin V2 y Clientes

**Hecho en esta sesión**

- Dashboard Admin:
  - Filtro por sucursal (Todas por defecto).
  - Sin selector de período ni botón Actualizar.
  - Refresco automático cada 30 s y al volver a la pestaña/ventana.
  - Cinco KPIs fijos: Ventas de hoy, Ventas de la semana (lunes a hoy, con
    comparación), Pendientes, Cajas abiertas y Compras por recibir.
  - Se quitó el KPI de Ventas del mes y el panel de Accesos rápidos.
  - Franja de alertas y paneles de evolución, últimas ventas, stock crítico,
    cajas abiertas y compras por recibir.
  - El detalle de cajas muestra `Caja X` + `Sección #ID` + sucursal/empleado.
  - Acciones arriba: **Nueva venta**, **Registrar cliente** y
    **Nuevo presupuesto**.
- Sección **Clientes**:
  - Búsqueda, listado paginado y alta contra `/api/clientes/`.
  - Formulario en modal; el acceso rápido del dashboard abre el modal con
    `?nuevo=1`.
  - Nuevo ítem “Clientes” en el menú Comercial.
- Backend: se agregó `ventas.semana` (lunes a hoy) y su comparación con la
  semana anterior. Total **57/57 tests** pasando.
- Commits previos: `205e89e`, `b67e98b`, `983bed4`.

**Pendiente inmediato**

- [ ] Desarrollar el módulo **Ventas**: listado, filtros, creación, confirmación
      y cancelación.
- [ ] Implementar **Nuevo presupuesto** dentro del flujo de venta:
      - armar el detalle como un borrador,
      - no guardar nada en la base,
      - generar un PDF imprimible con el detalle,
      - disponible antes de confirmar la venta como pendiente.
- [ ] Conectar los botones **Nueva venta** y **Nuevo presupuesto** al formulario
      real de Ventas (hoy abren la pantalla provisional).
- [ ] Definir métricas V2 del dashboard: top productos, formas de pago, ventas
      por sucursal, diferencias de caja y actividad reciente.
- [ ] Cambiar contraseña: **requiere endpoint nuevo en backend**.
- [ ] Actividad: definir fuente (recomendado: movimientos + ventas + compras).
- [ ] Aplicar `puedeEscribir` a todas las acciones de escritura.
- [ ] Probar en navegador el refresh automático del token y el cierre de sesión.

## 2. Decisiones tomadas

- La semana se calcula de **lunes a hoy**.
- “Ventas del mes” se saca del dashboard; se retoma cuando trabajemos Ventas y
  sus filtros.
- El dashboard se refresca **cada 30 segundos** y al recuperar el foco.
- “Registrar cliente” navega a **Clientes** y abre el formulario.
- “Presupuesto” es un **borrador de venta no persistido**: se arma como una
  venta, se genera un PDF imprimible y no se guarda ni queda pendiente.
- Se elimina el panel de accesos rápidos; quedan solo las tres acciones arriba.
- Por ahora se trabaja solo la vista de **Administrador**.
- Pedidos y Presupuestos como módulos del menú siguen omitidos; Presupuesto es
  un atajo dentro de Ventas.
- `prop-types`: **no se instala**.

## 3. Facturación (ARCA)

- [ ] **Bloqueado:** no hay CUIT, certificado `.crt`/`.key` ni punto de venta
      habilitado. La integración WSAA + WSFEv1 queda documentada en `AGENTS.md`.
- [ ] No hay servicio ni endpoint para emitir `Factura` (hoy es solo lectura).

## 4. Operación del barrido

- [ ] Verificar la tarea `Corralon\CancelarVentasVencidas` en un arranque sin
      sesión iniciada (registrarla con cuenta de servicio si hiciera falta).

## 5. Commit

- [x] Commits previos: `205e89e`, `b67e98b`, `983bed4`.
- [ ] Commit del dashboard V3 + Clientes.
