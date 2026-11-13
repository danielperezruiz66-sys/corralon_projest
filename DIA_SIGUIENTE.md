# Pendientes

> Solo lo pendiente. Lo terminado se borra. Contexto: `AGENTS.md`.

**Cerrado el:** 2026-11-12

**Hecho hoy (mini):** ajuste de stock por lote, transferencias y fixes UI
(commit `81712ae`). **Caja — módulo completo (Fases 1–5):** `Caja` física
(`nombre` único, sin sucursal), `SucursalXCaja`, `SeccionCaja.sucursal_caja` +
constraint 1 `AB` por asignación, migraciones `0021`/`0022`, `seed_data`,
servicios y API (`cajas`, `sucursales-cajas`, `GET /secciones-caja/{id}/teorico/`),
módulo `/caja` en React (encabezado con sucursal/caja/secciones abiertas, apertura,
cierre con arqueo por método y diferencias, auditoría, historial y gestión de
cajas/asignaciones solo `AD/GE`). Verificación automatizada: `check` y
`makemigrations --check` sin novedades, `migrate` y `test app` **175/175**, seed
determinista, constraint de `AB` única comprobado, lint (0 errores) y build.
Plan: `refaccioncaja.md`.

**Empezar por:** **QA visual manual en navegador** del módulo Caja (checklist en
la sección 0). Cuando esté OK: commit del módulo.

## 0. Caja — QA manual pendiente (usuario)

- [ ] Verificar que `/caja` abre para `AD/GE/CA` y no para `VE/ED` (menú/rutas).
- [ ] Encabezado: sucursal elegida, cajas físicas y secciones abiertas visibles;
      botón **Abrir seccion** solo con sucursal elegida; la misma caja física
      abierta en Salta y en Quijano a la vez (válido).
- [ ] Abrir: solo cajas habilitadas en la sucursal y sin `AB`; doble apertura en
      la misma sucursal-caja bloqueada (400).
- [ ] `CA` bloqueado al abrir en una sucursal no asignada; `AD/GE` pueden.
- [ ] Cierre: arqueo por método con teórico correcto, montos reales, diferencias
      en vivo, observaciones; **Efectivo** incluye el monto inicial; la sección
      pasa a Cerrada y se ve en el historial con diferencias.
- [ ] Auditoría: solo secciones `CE`, solo `AD/GE` → `AU`.
- [ ] Historial: filtros por estado/búsqueda/URL, paginación y export CSV;
      ancla `#cajas-abiertas` lleva al bloque correcto.
- [ ] Gestión (`AD/GE`): alta/edición de cajas físicas y asignaciones;
      habilitar/deshabilitar persiste.
- [ ] Ventas/Compras siguen operando con la sección abierta; dashboard enlaza a
      cajas abiertas (`#cajas-abiertas`).

## 1. QA en navegador

- [ ] **Datos de prueba:** correr `seed_data --reset` y verificar 2 sucursales
      (Salta Capital y Campo Quijano), 2 depósitos y 2 cajas físicas (Caja 1 y
      Caja 2) habilitadas en ambas sucursales, 4
      empleados por sucursal (Administrador, Cajero, Vendedor y Encargado de
      depósito), 30 productos con categoría, marca, unidad, precio de venta,
      costo y stock, y compras/ventas de los últimos 6 meses.
- [ ] **Ventas:** búsqueda en vivo (sin Enter, cancela requests viejas, sin
      parpadeo); presets de fecha, rango Desde/Hasta, día exacto y rango invertido;
      inputs a la derecha en escritorio y debajo en mobile; orden por fecha/monto;
      CSV; filtros persistidos en la URL (refrescar y volver atrás).
- [ ] **Ventas:** consumidor final con nombre libre visible en listado, detalle,
      cobro y presupuesto; pago parcial con varios métodos sigue Pendiente;
      completar saldo y confirmar; check **Confirmar la venta al registrar los
      pagos**; no superar el saldo; método inactivo no guarda; el vendedor no ve
      cobrar/confirmar/anular; presupuesto con varios productos y PDF.
- [ ] **Compras:** En camino con fecha estimada no mueve stock y la recepción lo
      repone; pago parcial y saldo con varios métodos → Parcial/Pagada; anular
      solo no recibida y sin pagos; filtros **Por recibir** y **En camino**
      juntos y alineados; filtros de fecha, orden, CSV y URL; exige precio de
      costo y fecha estimada, no usa el precio de venta; recibir con depósito
      elegido y sin elegir (debe usar el principal de la sucursal central);
      la fecha estimada no puede ser anterior a la compra; el selector solo
      muestra productos del proveedor y cambiar de proveedor con carrito pide
      confirmación y lo vacía; anular exige motivo y lo muestra en el detalle.
- [ ] **Clientes:** buscador en tiempo real con el mismo diseño que Ventas/Compras;
      editar datos fiscales y notas; cambiar estado desde la columna y desde el
      formulario; DNI/CUIT duplicado; filtrar activos/inactivos y que un inactivo
      no aparezca en el alta de venta; ficha con resumen de ventas, saldo,
      WhatsApp, email y nueva venta; alta sin documento/tipo/contacto rechazada;
      CSV con y sin filtros.
- [ ] **Inventario (stock/lotes/ajuste/transferencias):** lotes `LOT-`
      autogenerados (sin lote manual) en carga, recepción y ajustes/ingresos.
      Ajuste detallado: reducir por lote con **cantidad resultante** (0..actual)
      y agregar cantidad como ingreso en depósito → **nuevo lote**; verificar
      totales/movimientos `AJ` por detalle. Editar lote: `fecha_venc` y
      observaciones (nota automática de origen inborrable). Transferencias por
      `detalle_origen`: en tránsito descuenta origen; al recibir crea nuevo lote
      destino (copia vencimiento, observación procedencia + motivo); al cancelar
      devuelve al origen; ver lote origen/destino y fila resaltada al
      crear/recibir/cancelar. Atajo "Comprar" (AD/GE), orden productos
      (nombre/recientes/antiguos), configurar mínimos, filtros/alertas,
      depósitos/catálogos y atajos `+` sin perder datos. Probar casos inválidos
      (depósito otra sucursal, producto no activo).
- [ ] **Validaciones:** en Cliente, probar DNI con letras, CUIT incompleto,
      email/teléfono inválidos; en Proveedor, CUIT con letras; en Producto,
      código inválido, precio/costo; en Compra/Venta, cantidades, precios y
      fechas; en pagos, método/monto. Verificar borde rojo, mensaje debajo y que
      no permita guardar hasta corregir.
- [ ] **Proveedores:** crear/editar con sucursales; cambiar estado desde la tabla;
      asociar productos y costos.
- [ ] **Selectores con búsqueda:** en Ventas buscar cliente por nombre/DNI; en
      Compras buscar proveedor por nombre/CUIT; en Producto y Proveedores buscar
      proveedor/producto por código o nombre. Verificar teclado, limpiar y que
      el ítem creado quede seleccionado.
- [ ] **Sucursales y cajas:** buscar sucursal en el encabezado y en depósitos;
      buscar sección de caja en venta/compra; verificar que el filtro global se
      mantenga y que los formularios sigan funcionando.
- [ ] **Proveedor sin productos en compra:** crear proveedor desde el “+”,
      verificar el mensaje, abrir “Asociar productos”, cargar varias filas con
      costo, guardar y comprobar que los productos aparecen en la compra sin
      cerrar el formulario ni abrir otra pestaña.
- [ ] **Búsqueda remota:** verificar que Ventas, Compras, Producto y Proveedores
      no descarguen listas completas de clientes/proveedores/productos; que la
      búsqueda por DNI/CUIT/código/nombre funcione y que editar un registro con
      valor inicial lo muestre seleccionado. En Ventas, probar el buscador
      remoto de productos por sucursal.
- [ ] **General:** el selector de sucursal recarga dashboard, ventas, compras y
      stock; dashboard con ventas por vencer/vencidas y compras En camino; refresh
      automático del token y cierre de sesión.
- [ ] **Alertas del dashboard:** cada tarjeta abre su módulo con el filtro
      aplicado (`/ventas?alerta=...`, `/productos?tab=stock&alerta=...`,
      `/compras?por_recibir=1`); en stock, el producto abre resaltado y con
      scroll; la tarjeta de cajas lleva al panel de cajas abiertas.

## 2. Módulos frontend

- [ ] Desarrollar **Empleados**, **Perfil** y **Actividad**.
- [ ] Reemplazar `EnDesarrollo` por las pantallas reales.

## 3. Backend

- [ ] Restringir en la API las sucursales asignadas para usuarios no-admin.
- [ ] Endpoint de cambio de contraseña.
- [ ] Evaluar reversión de pagos para anular una venta pendiente con pago parcial.
- [ ] Aplicar `puedeEscribir` a las acciones de escritura de los módulos faltantes.

## 4. Dashboard V2

- [ ] Definir métricas: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.

## 5. Facturación (ARCA) — bloqueada

- [ ] Falta CUIT, certificado `.crt`/`.key` y punto de venta habilitado.
- [ ] No hay servicio ni endpoint para emitir `Factura` (hoy es solo lectura).

## 6. Operación

- [ ] **Barrido de ventas vencidas (manual):** no se ejecuta automáticamente. Las
      ventas pendientes sin pago que superan los 30 min se marcan como vencidas
      (alerta) pero no se anulan ni liberan stock; deben anularse manualmente.
      El comando `python manage.py cancelar_ventas_vencidas` queda disponible
      para uso manual si se decide correrlo. No programar la tarea
      `Corralon\CancelarVentasVencidas` en el servidor.
