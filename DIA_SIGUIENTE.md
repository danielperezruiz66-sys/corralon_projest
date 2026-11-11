# Pendientes

> Solo lo pendiente al cerrar la sesión anterior. Lo terminado o descartado se
> borra. Contexto del proyecto: `AGENTS.md`.

**Cerrado el:** 2026-11-11

**Empezar por:** probar en navegador Ventas, Compras, Clientes, Inventario y
Proveedores; si todo está bien, empezar un módulo nuevo.

## 1. QA en navegador

- [ ] **Datos de prueba:** correr `seed_data --reset` y verificar 2 sucursales
      (Salta Capital y Campo Quijano), 2 depósitos y 1 caja por sucursal, 4
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
- [ ] **Inventario:** crear/editar producto con sucursales, precio y costo (precio
      no menor al costo); configurar mínimo y ajustar stock con lotes y
      movimientos; filtros de stock por alerta y movimientos por fecha, producto,
      sucursal y tipo; transferencia entre depósitos de la misma sucursal y entre
      sucursales, confirmar una y cancelar otra; crear/editar depósitos y
      catálogos; no eliminar un depósito con stock. En el alta de producto,
      exigir proveedor y costo; probar los atajos `+` de categoría, marca,
      unidad y proveedor sin perder los datos cargados. En transferencias,
      buscar producto por código/nombre y depósito por nombre/sucursal. En
      ajuste de stock, buscar depósito; en los filtros de inventario y en el
      selector de productos, buscar categoría, marca y unidad. Al crear, recibir
      o cancelar una transferencia, verificar que la lista cambie al estado
      nuevo y resalte la fila.
- [ ] **Carga de stock:** en Inventario → Stock, probar “Cargar stock”:
      elegir sucursal y depósito, agregar varios productos, exigir lote,
      vencimiento opcional, cantidades mayores a cero y verificar que suma al
      stock y genera movimientos `AJ`. Probar con producto no activo en la
      sucursal y con depósito de otra sucursal.
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

- [ ] Desarrollar **Caja** (apertura, cierre, auditoría e historial).
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

- [ ] Verificar la tarea `Corralon\CancelarVentasVencidas` en un arranque sin
      sesión iniciada (registrarla con cuenta de servicio si hiciera falta).
