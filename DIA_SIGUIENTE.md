# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-01

## 1. Serializers + viewsets

- [ ] Crear `serializers.py` y `views.py` únicos, con secciones `# ==== DOMINIO ====`.
- [ ] Registrar los viewsets en el `router` de `app/urls.py`.
- [ ] Orden: GEOGRAFIA → ORGANIZACION → CATALOGO → PAGOS → PROVEEDORES → STOCK/CAJA (solo lectura).
- [ ] Casos especiales: `Usuario` (password write-only), `Producto` (`through=ProductoXSucursal`), tablas puente con serializer propio.

## 2. Decisiones de modelo (antes de implementar compras)

- [ ] Agregar FK a `Proveedor` en `Compra`.
- [ ] Definir depósito/lote en `DetalleCompra` para reponer stock.
- [ ] Definir la fuente de verdad del stock: `Stock.cantidad` o `DetalleStock.cantidad`.

## 3. Lógica de negocio

- [ ] `services/ventas.py`: registrar venta, totales, descuento de stock, factura.
- [ ] `services/caja.py`: apertura/cierre de sección.
- [ ] `services/compras.py`: registro y reposición de stock.

## 4. Frontend y tests

- [ ] Cliente HTTP con JWT (login + refresh) en React.
- [ ] Proxy de Vite hacia el backend en desarrollo.
- [ ] Tests de servicios críticos (ventas, caja).
