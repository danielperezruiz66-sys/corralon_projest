# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-04

## 1. Frontend — sección Comercial

**Hecho en esta sesión**

- **Ventas**:
  - listado con búsqueda por **N.º de venta, cliente, DNI o sección de caja**,
    filtros por estado y paginación;
  - **cuatro estados**: Pendiente, Parcial, Confirmada y Anulada; se eliminó
    Pagada de ventas;
  - el pago deja la venta pendiente hasta que el cajero la confirma. Al
    confirmar queda Parcial o Confirmada según el total cobrado;
  - acción **Cobrar** en la lista y en el detalle: elige método de pago y monto,
    registra el pago y confirma la venta;
  - la venta pendiente sin pagos se auto-anula a los 30 minutos; el cajero
    también puede anularla manualmente;
  - detalle de la venta con productos, totales y pagos registrados;
  - alta de venta con sección de caja, cliente y detalle de productos; el botón
    dice **Crear venta**;
  - **Generar presupuesto**: arma un PDF imprimible con el borrador actual,
    sin guardar la venta ni descontar stock.
- **Compras**:
  - listado con búsqueda por **N.º de compra, proveedor, CUIT o sección de
    caja**, filtros por estado y “Por recibir”;
  - detalle de la compra;
  - alta de compra sin reponer stock;
  - recepción de compra con reposición en el depósito predeterminado.
- **Selector de productos** (venta y compra):
  - lista filtrable por código, nombre, categoría, marca o unidad;
  - muestra precio y stock de la sucursal de la caja;
  - cantidades y precios editables en el detalle.
- **Clientes**:
  - búsqueda, listado paginado y alta en modal contra `/api/clientes/`;
  - el acceso rápido del dashboard abre el formulario.
- **Dashboard Admin**:
  - cinco KPIs fijos, auto-refresh cada 30 s, alertas, cajas con ID de sección,
    compras por recibir y acciones arriba.
  - se quitaron el selector de período, el botón Actualizar, Ventas del mes y
    el panel de accesos rápidos.
- **Menú de navegación**:
  - se eliminó el “Perfil” duplicado del pie del sidebar (ya está en Sistema);
  - las rutas de módulo ahora validan `puedeVer`, igual que el menú.
- **Backend**:
  - se eliminó `PAGADA` de `Venta.EstadoVenta`; migración `0008` convierte las
    ventas históricas `PA` a `CO`;
  - el pago de una venta no cambia su estado: queda `PENDIENTE` hasta que se
    llama a `confirmar`; la confirmación exige al menos un pago;
  - la auto-cancelación ignora ventas pendientes que ya tienen pagos;
  - `ventas.semana` (lunes a hoy) en `/api/dashboard/`;
  - búsqueda de ventas/compras por ID, cliente/proveedor, DNI/CUIT y sección;
  - `SeccionCajaSerializer` expone `sucursal` y `sucursal_detalle`;
  - filtro `?por_recibir=1` en `/api/compras/`;
  - total **61/61 tests** pasando.
- Commits previos: `205e89e`, `b67e98b`, `983bed4`, `908add1`.

**Pendiente inmediato**

- [ ] Probar en navegador el flujo completo de venta: crear, cobrar parcial,
      completar pago, confirmar y anular.
- [ ] Probar el PDF de presupuesto con una venta de varios productos.
- [ ] Probar el flujo completo de compra: crear, recibir y verificar stock.
- [ ] Desarrollar **Caja** (apertura, cierre, auditoría y pagos).
- [ ] Desarrollar **Stock/Productos** y **Proveedores**.
- [ ] Desarrollar **Empleados**, **Perfil** y **Actividad**.
- [ ] Definir métricas V2 del dashboard: top productos, formas de pago, ventas
      por sucursal, diferencias de caja y actividad reciente.
- [ ] Cambiar contraseña: **requiere endpoint nuevo en backend**.
- [ ] Aplicar `puedeEscribir` a todas las acciones de escritura.
- [ ] Probar el refresh automático del token y el cierre de sesión.

## 2. Decisiones tomadas

- La semana se calcula de **lunes a hoy**.
- El dashboard se refresca **cada 30 segundos** y al recuperar el foco.
- “Registrar cliente” navega a **Clientes** y abre el formulario.
- “Presupuesto” es un **borrador no persistido** con PDF imprimible; se genera
  desde el formulario de venta antes de registrarla como pendiente.
- Se eliminó el panel de accesos rápidos; quedan tres acciones arriba:
  Nueva venta, Registrar cliente y Nuevo presupuesto.
- Por ahora se trabaja solo la vista de **Administrador**.
- Pedidos y Presupuestos como módulos del menú siguen omitidos; Presupuesto es
  un atajo dentro de Ventas.
- `prop-types`: **no se instala**.
- El buscador de ventas/compras incluye ID, cliente/proveedor, DNI/CUIT y
  sección de caja. Se puede escribir `#473` para buscar por número.
- La grilla de productos reemplaza al `<select>`: se filtra por código, nombre,
  categoría, marca o unidad y muestra precio y stock de la sucursal.
- **Ventas queda con 4 estados**:
  - Pendiente: creada, stock descontado, sin pago ni confirmación.
  - Parcial: pago parcial y venta confirmada, con saldo.
  - Confirmada: pago total y venta confirmada.
  - Anulada: cancelada y stock restaurado.
- El pago no cambia el estado por sí solo: la venta sigue Pendiente hasta que
  el cajero confirma. La confirmación exige al menos un pago.
- Compras conserva sus estados actuales (incluido Pagada) hasta que se trabaje
  ese módulo.

## 3. Facturación (ARCA)

- [ ] **Bloqueado:** no hay CUIT, certificado `.crt`/`.key` ni punto de venta
      habilitado. La integración WSAA + WSFEv1 queda documentada en `AGENTS.md`.
- [ ] No hay servicio ni endpoint para emitir `Factura` (hoy es solo lectura).

## 4. Operación del barrido

- [ ] Verificar la tarea `Corralon\CancelarVentasVencidas` en un arranque sin
      sesión iniciada (registrarla con cuenta de servicio si hiciera falta).

## 5. Commit

- [x] Commits previos: `205e89e`, `b67e98b`, `983bed4`, `908add1`.
- [ ] Commit de Ventas, Compras y correcciones del menú.
