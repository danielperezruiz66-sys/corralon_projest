# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-02

## 1. Modelo — migración `0003`

Decisiones tomadas:

- [ ] Pasar a `DecimalField` todas las cantidades: `Stock.cantidad`,
      `Stock.cant_min`, `DetalleStock.cantidad`, `DetalleVenta.cantidad_venta`
      y `DetalleCompra.cantidad_compra`. Definir `max_digits`/`decimal_places`
      (propuesta: `12,3`).
- [ ] Dejar `DetalleStock` como **fuente de verdad** del stock. Resolver
      `Stock.cantidad`: eliminarlo y exponer la suma de sus detalles, o
      mantenerlo como caché que recalculan los servicios.
- [ ] Actualizar `seed_data` y generar la migración con `makemigrations`.

Decisiones a cerrar con el usuario:

- [ ] `Compra.proveedor`: agregar FK (recomendado) o derivarlo desde
      `ProductoXProveedor`. Ojo: `ProductoXProveedor` dice qué proveedores
      pueden vender un producto, no a quién se le compró esa compra.
- [ ] `DetalleCompra.deposito`/`lote`: agregarlos para saber en qué
      `DetalleStock` entra la mercadería, o definir un depósito por defecto por
      sucursal y que el servicio lo resuelva.

## 2. Lógica de negocio (`services/`)

- [ ] `services/stock.py`: alta y movimiento de `DetalleStock`, recálculo de
      `Stock`, con `select_for_update` para evitar carreras.
- [ ] `services/caja.py`: apertura/cierre de `SeccionCaja` (una abierta por
      caja, montos y fechas obligatorias al cerrar).
- [ ] `services/ventas.py`: venta + detalles + descuento de stock + factura,
      todo en `transaction.atomic`.
- [ ] `services/compras.py`: compra + detalles + reposición en depósito/lote.
- [ ] Endpoints de escritura para ventas/compras/stock que deleguen en los
      servicios (hoy son de solo lectura).

## 3. API y permisos

- [ ] Definir permisos de escritura por rol. Hoy cualquier usuario autenticado
      puede escribir catálogo; solo `Usuario` exige `IsAdminUser`.
- [ ] Evaluar `HistoricalRecords` para `Factura`.

## 4. Frontend

- [ ] Cliente HTTP con JWT (login + refresh automático) en React.
- [ ] Proxy de Vite hacia el backend en desarrollo.
- [ ] Pantalla de login (usuario o legajo) y listado de productos con búsqueda
      y paginación.

## 5. Tests

- [ ] `APITestCase` de autenticación, permisos y endpoints principales.
- [ ] Tests de servicios: venta descuenta stock, caja no cierra dos veces,
      compra repone en el depósito correcto.
