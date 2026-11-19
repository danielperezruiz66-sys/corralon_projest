# Pendientes

> Solo lo pendiente (lo terminado se borra). Contexto: `AGENTS.md`.

**Última actualización:** 2026-11-19

## Backend (rama `experimental/cambio-180`)

- [ ] **Resetear la base local** (las migraciones se consolidaron en `0001`):
      `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`, luego
      `manage.py migrate` y `manage.py seed_data --reset`. Es destructivo.
- [ ] Commitear el backend reestructurado (caja, bajas y migración consolidada).

## Frontend — adaptación obligatoria a la nueva API

- [ ] **Caja**: `Caja` ahora lleva `sucursal` + `numero_caja`;
      `/api/secciones-caja/` → `/api/movimientos-caja/`; el cierre exige
      `password` del usuario autenticado; quitar el selector/CRUD de
      `sucursales-cajas`.
- [ ] **Compras**: quitar pestaña **Solicitudes**, badge "Solicitud pendiente"
      y botones de solicitud; agregar selector de **depósito** en el alta y
      mostrar `Compra.deposito`.
- [ ] **Inventario**: quitar pestañas **Movimientos** y **Transferencias**;
      agregar acción **Mover lote** (`/api/detalles-stock/{id}/mover/`) entre
      depósitos de la misma sucursal.
- [ ] **Dashboard**: panel de cajas abiertas sobre `MovimientoCaja`
      (`caja`, `caja.sucursal`).

## QA visual manual (usuario)

- [ ] Caja: abrir propia y a nombre de otro, sugerencia de monto inicial,
      observación obligatoria al diferir, cerrar con contraseña (correcta e
      incorrecta), pausar/reanudar, auditoría, alcance por rol.
- [ ] Compras: alta con depósito, recepción en ese depósito, pago/anulación
      solo `AD/GE`, sin solicitudes.
- [ ] Inventario: mover lote completo entre depósitos; rechazo a depósito de
      otra sucursal; lote negativo no se mueve.
- [ ] Ventas: anular una venta y verificar que el stock vuelve a los mismos
      lotes.

## Backend pendientes

- [ ] Restringir la operación a una sola sucursal (validación en serializer /
      servicio, no constraint), manteniendo la estructura multi-sucursal.
- [ ] Reversión de pagos: hoy una compra con pagos no se puede anular.
- [ ] Dashboard V2: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.
- [ ] El dashboard por rol ya devuelve `bloques`; falta que la API omita los
      bloques que el rol no puede ver.

## Facturación (ARCA)

- [ ] Bloqueada por falta de CUIT del emisor, certificado `.crt`/`.key` y punto
      de venta. Hoja de ruta en `AGENTS.md` §7.

## Operación

- [ ] El barrido de ventas vencidas es **manual**
      (`cancelar_ventas_vencidas`). No programarlo automáticamente.
