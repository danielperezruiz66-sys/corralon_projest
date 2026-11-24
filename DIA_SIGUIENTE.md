# Pendientes

> Único lugar de pendientes. Contexto y reglas en `AGENTS.md`; instalación en
> `INSTRUCCIONES.md`; credenciales demo en `contraseñas.md`.

## Estado auditado — 2026-11-24

- Auditoría funcional de reglas de negocio sobre todos los módulos:
  validaciones `400` controladas, sin `500`, sin fuga de hashes y XSS escapado.
  Suite backend actualizada; agregado `test_seguridad_roles` para roles,
  sucursal y caja. La QA visual módulo por módulo sigue pendiente.
- Endurecido: lectura por rol (`roles_lectura`), `GE` ya no asigna ni edita el
  rol `AD`, `is_staff` no se cambia por API, alcance por sucursal en ventas,
  compras, caja, stock, depósitos y empleados, y la caja en pausa bloquea ventas
  y pagos. `/api/token/` y `/api/token/refresh/` tienen límite por IP.
- La caja pasa a ser de la sucursal: `/api/movimientos-caja/abiertas/` permite
  que vendedor y depósito operen contra la caja abierta por el cajero.
- Sesión en `sessionStorage`: se mantiene con la pestaña abierta y se descarta
  al cerrar el navegador. Cada usuario cambia su contraseña desde Perfil con la
  actual; solo `AD` cambia la de terceros.
- Los pagos guardan la caja donde se cobraron (`movimiento_caja`): el saldo de
  una venta/compra parcial se puede pagar aunque su caja original esté cerrada
  y cae en el arqueo de la caja nueva. Probado contra la base demo y con tests.
  Los modales de cobro/pago permiten elegir la caja entre las abiertas.
- Login: autofill de Chrome neutralizado con sombra interior y contraste de
  íconos/campo ajustado. Corregido el `cargar` inexistente de Perfil.
- Verificado en Chrome (Vite en `:5175`): login, dashboard de cajero y cobro de
  una venta parcial sin errores de consola. La prueba de cobro dejó un pago de
  $1 sobre la venta demo #718, imputado a la caja abierta #799.

## Caja

- [ ] Completar QA de pausa/reanudación con un movimiento `PA` real; hoy no
      hay datos en pausa.
- [ ] Probar en vivo el flujo vendedor/depósito contra la caja abierta por el
      cajero y confirmar que el cierre incluye esas ventas.
- [ ] Definir si una diferencia de cierre distinta de cero exige observación
      obligatoria; hoy genera la nota automática y la observación es opcional.

## Ventas

- [ ] Confirmar que la alerta de vencidas del Dashboard enruta a
      `/ventas?alerta=vencida` (hoy no hay ventas vencidas para probarlo).

## Compras

- [ ] Definir si un costo de compra superior al precio de venta debe
      bloquearse, actualizar `precio_unidad` o solo advertir (hoy advierte y no
      actualiza el catálogo).
- [ ] Definir si la compra necesita un campo de observaciones (hoy no existe).

## Inventario

- [ ] Definir si un producto debe poder desactivarse desde la UI. Hoy no hay
      acción de baja y el `DELETE` de la API se bloquea por las asociaciones.

## Proveedores

- [ ] Definir si “Productos y costos” necesita una vista de detalle separada.
      Hoy la ficha completa se ve en el mismo modal de “Editar costo”.

## Revisión módulo por módulo

- [ ] Clientes.
- [ ] Proveedores.
- [ ] Empleados.
- [ ] Perfil y Actividad.
- [ ] En cada módulo revisado: cache con `useCacheModulo`, refresco en segundo
      plano, filtros/atajos correctos y coherencia con la API.
- [ ] QA visual final con `admin`, `gerente.salta`, `cajero.salta`,
      `vendedor.salta` y `deposito.salta`.

## Dashboard

- [ ] Verificar alertas: vencidas, stock negativo/bajo y compras por recibir;
      enrutamientos a las tarjetas secundarias y desde allí a los módulos.
- [ ] Verificar cache en memoria (15 s + foco de ventana) y el refresco al
      volver desde otro módulo.
- [ ] Omitir desde la API los bloques del dashboard que el rol no puede ver.

## Backend

- [ ] Revisar en Compras el mismo N+1 de `movimiento_caja__caja__sucursal`
      que se corrigió en el listado de Ventas.
- [ ] Reversión de pagos para poder anular ventas `PC`/`CO` y compras pagadas.
- [ ] Dashboard V2: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.
- [ ] Revisar el límite de login por IP en la nube: si varios locales comparten
      salida NAT, evaluar límite por usuario (`django-axes`) además del de IP.
- [ ] Probar que una pestaña duplicada no pierda la sesión al rotar el refresh
      (hoy cada pestaña tiene su propio `sessionStorage`).

## Documentación

- [ ] Sincronizar `INSTRUCCIONES.md` con la base actual: una sucursal, sin
      usuarios de Campo Quijano.

## Facturación y operación

- [ ] ARCA bloqueada: CUIT del emisor, certificado y punto de venta.
- [ ] El barrido de ventas vencidas sigue siendo manual.
