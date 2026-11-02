# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-02

## 1. Lógica de negocio (`services/`)

- [ ] `services/stock.py`: alta y movimiento de `DetalleStock`, recálculo de
      `Stock.cantidad` como suma de sus detalles, con `select_for_update` para
      evitar carreras.
- [ ] `services/caja.py`: apertura/cierre de `SeccionCaja` (una abierta por
      caja, montos y fechas obligatorias al cerrar).
- [ ] `services/ventas.py`: venta + detalles + descuento de `DetalleStock` +
      recálculo de `Stock.cantidad` + factura, todo en `transaction.atomic`.
- [ ] `services/compras.py`: compra + detalles + reposición en el `Deposito`
      predeterminado de la sucursal de la caja. Exigir `Compra.proveedor`.
- [ ] Endpoints de escritura para ventas/compras/stock que deleguen en los
      servicios (hoy son de solo lectura).

## 2. API y permisos

- [ ] Definir permisos de escritura por rol. Hoy cualquier usuario autenticado
      puede escribir catálogo; solo `Usuario` exige `IsAdminUser`.
- [ ] Validar en los servicios que la sucursal tenga depósito predeterminado y
      que el proveedor esté activo.

## 3. Frontend

- [ ] Cliente HTTP con JWT (login + refresh automático) en React.
- [ ] Proxy de Vite hacia el backend en desarrollo.
- [ ] Pantalla de login (usuario o legajo) y listado de productos con búsqueda
      y paginación.

## 4. Tests

- [ ] `APITestCase` de autenticación, permisos y endpoints principales.
- [ ] Tests de servicios: venta descuenta stock y recalcula el total; caja no
      cierra dos veces; compra repone en el depósito predeterminado y exige
      proveedor.
- [ ] Test de que no se pueden crear dos depósitos predeterminados en la misma
      sucursal.
