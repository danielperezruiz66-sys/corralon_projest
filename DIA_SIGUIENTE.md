# Pendientes

> Único lugar de pendientes. Contexto y reglas en `AGENTS.md`; instalación en
> `INSTRUCCIONES.md`; credenciales demo en `contraseñas.md`.

## Estado actual — 2026-11-24

- Seed nativo restaurado: una sucursal (Salta Capital), 30 productos, 72
  compras y 238 ventas; 6 usuarios demo con las claves de `contraseñas.md`.
  Caja 1 y Caja 2 quedan abiertas.
- Cierre de caja con Cobrado / Pagado / Neto por método, teórico y real;
  efectivo siempre visible y los demás métodos solo si se usaron. Migración
  0012 aplicada. 313 tests OK.
- QA E2E de un día normal con todos los roles: ventas `PE/PC/CO`, compra
  `PE/RE/PA`, stock, caja, pausa/reanudación, permisos y auditoría, sin 500.

## Caja

- [ ] Definir si una diferencia de cierre distinta de cero exige observación
      obligatoria; hoy genera la nota automática y la observación es opcional.

## Ventas

- [ ] Confirmar que la alerta de vencidas del Dashboard enruta a
      `/ventas?alerta=vencida` (hoy no hay ventas vencidas para probarlo).

## Compras

- [ ] Definir si un costo de compra superior al precio de venta debe
      bloquearse, actualizar `precio_unidad` o solo advertir.
- [ ] Definir si la compra necesita un campo de observaciones.

## Inventario

- [ ] Definir si un producto debe poder desactivarse desde la UI. Hoy no hay
      acción de baja y el `DELETE` de la API se bloquea por las asociaciones.

## Proveedores

- [ ] Definir si “Productos y costos” necesita una vista de detalle separada.
      Hoy la ficha completa se ve en el mismo modal de “Editar costo”.

## Revisión fina

- [ ] QA funcional de Clientes, Proveedores, Empleados, Perfil y Actividad
      (más allá del smoke test de carga).
- [ ] QA visual final con `admin`, `gerente.salta`, `cajero.salta`,
      `vendedor.salta` y `deposito.salta`.

## Dashboard

- [ ] Verificar alertas (vencidas, stock crítico, compras por recibir) y sus
      enrutamientos.
- [ ] Verificar cache en memoria (15 s + foco de ventana) y el refresco al
      volver desde otro módulo.
- [ ] Omitir desde la API los bloques del dashboard que el rol no puede ver.

## Backend

- [ ] Revisar en Compras el mismo N+1 de `movimiento_caja__caja__sucursal`
      que se corrigió en el listado de Ventas.
- [ ] Reversión de pagos para poder anular ventas `PC`/`CO` y compras pagadas.
- [ ] Dashboard V2: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.
- [ ] Evaluar `django-axes` para limitar el login por usuario además del
      límite por IP.
- [ ] Probar que una pestaña duplicada no pierda la sesión al rotar el refresh.

## Facturación y operación

- [ ] ARCA bloqueada: CUIT del emisor, certificado `.crt`/`.key`, punto de
      venta; homologación, WSAA, WSFEv1 y QR.
- [ ] El barrido de ventas vencidas sigue siendo manual.
