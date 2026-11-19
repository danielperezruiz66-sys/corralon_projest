# Pendientes por fases

> Solo lo pendiente. Contexto: `AGENTS.md`. Backend cerrado en `524875e`
> (más la restricción de una sola sucursal). Base local reseteada y sembrada.

## Fase 1 — Frontend Caja

- [ ] `Caja` con `sucursal` + `numero_caja`; eliminar `FormularioAsignacionCaja`
      y la pestaña de asignaciones.
- [ ] `/api/secciones-caja/` → `/api/movimientos-caja/` en página, componentes,
      menú y CSV.
- [ ] El cierre pide `password` del usuario autenticado.
- [ ] Ajustar apertura, detalle y acciones (`pausar`, `reanudar`, `auditar`).

## Fase 2 — Frontend Ventas y Compras

- [ ] Selectores de sesión: `seccion_caja` → `movimiento_caja` en venta y compra.
- [ ] Compra: selector de `deposito` y mostrar el depósito de la compra.
- [ ] Quitar pestaña **Solicitudes**, badge y acciones de solicitud.

## Fase 3 — Frontend Inventario

- [ ] Quitar pestañas **Movimientos** y **Transferencias** y
      `FormularioTransferencia`.
- [ ] Agregar acción **Mover lote** (`/api/detalles-stock/{id}/mover/`).

## Fase 4 — Dashboard, menú y QA

- [ ] Panel de cajas abiertas sobre `MovimientoCaja`.
- [ ] `npm run lint` y `npm run build`.
- [ ] QA visual de las fases 1–3.

## Backend (después del frontend)

- [ ] Reversión de pagos para poder anular compras pagadas.
- [ ] Dashboard V2: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.
- [ ] Omitir desde la API los bloques del dashboard que el rol no puede ver.

## Facturación y operación

- [ ] ARCA bloqueada (CUIT del emisor, certificado y punto de venta).
- [ ] El barrido de ventas vencidas sigue siendo manual.
