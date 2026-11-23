# Pendientes

> Único lugar de pendientes. Contexto y reglas en `AGENTS.md`; instalación en
> `INSTRUCCIONES.md`; credenciales demo en `contraseñas.md`.
> Se trabaja módulo por módulo, sin fases cerradas: al terminar uno se corrige,
> se verifica y se actualizan estos pendientes.

## Contexto al cierre — 2026-11-23

- Filtros de fecha de Ventas y Compras unificados en una sola tarjeta, con
  topes de fecha, aviso de ajuste y rango inválido sin datos viejos.
- QA E2E de Ventas: pestañas, presets y búsqueda; alta sin cliente; cliente
  rápido con documento inválido/duplicado; cantidades y stock; cobro parcial
  y total; idempotencia con doble clic; anulación con restauración de stock,
  Inventario y Actividad.
- Backend: consumidor final obligatorio sin cliente, mensaje de documento
  duplicado y tests (263 OK). Frontend: lint 0 warnings y build OK.
- Compras: filtros de pago y entrega separados; alta rápida de proveedor con
  validación en vivo de CUIT, nombre, razón social, teléfono y email, más
  duplicados; compra con validación de cantidades/costos, pagos idempotentes,
  recepción, anulación y permisos por rol verificados contra stock, lotes y
  Actividad. Backend de proveedores: 19 tests OK.
- Inventario: validación en vivo en producto, catálogos, stock, depósitos,
  carga/ajuste de stock, lotes y movimientos; duplicados bloqueados en
  categorías, marcas, unidades, código y nombre+marca de producto y nombre de
  depósito por sucursal; filtros de productos en la URL. Se quitaron los CSV y
  se agregó comprobante interno imprimible en el detalle de venta/compra.
- Unidades: `permite_decimales` en base, formulario que obliga a elegir entero o
  decimales y validaciones de cantidades usando el flag de la unidad.
- Proveedores · Productos y costos: búsqueda, paginación, asociación, alta
  rápida, regla de margen, duplicados y edición verificados; corregida la
  validación del código de proveedor (máximo 30, caracteres permitidos) en
  frontend y backend. Sin errores 500; solo 400 controlados en duplicados.
- Backend: migraciones 0006 (CUIT 3–13) y 0007 (unicidad de catálogo/stock);
  suite completa 275 tests OK. Frontend: lint 0 warnings y build OK.

## Próximo módulo: Caja

- [ ] Revisar pantalla, secciones `AB`/`PA`/`CE`/`AU`, apertura, cierre,
      pausa, reanudación, auditoría y arqueo por método.
- [ ] Verificar montos sugeridos, notas inborrables y permisos (`CA` en sus
      sucursales, `AD/GE` en cualquiera).

## Ventas

- [ ] Confirmar que la alerta de vencidas del Dashboard enruta a
      `/ventas?alerta=vencida`. “Por vencer” ya no existe en la UI.

## Compras

- [ ] Definir si un costo de compra superior al precio de venta debe
      bloquearse, actualizar `precio_unidad` o solo advertir (hoy advierte y no
      actualiza el catálogo).
- [ ] Definir si la compra necesita un campo de observaciones (hoy no existe).

## Inventario

- [ ] Definir si un producto debe poder desactivarse desde la UI. Hoy no hay
      acción de baja y el `DELETE` de la API se bloquea si tiene stock o
      historial (`protegido`).

## Proveedores

- [ ] Definir si “Productos y costos” necesita una vista de detalle separada.
      Hoy la ficha completa se ve en el mismo modal de “Editar costo”.

## Revisión módulo por módulo

- [ ] Clientes.
- [ ] Proveedores.
- [ ] Empleados.
- [ ] Perfil y Actividad.
- [ ] Menú/encabezado y navegación general.
- [ ] En cada módulo revisado: cache con `useCacheModulo`, refresco en segundo
      plano, filtros/atajos correctos y coherencia con la API.
- [ ] QA visual final con `admin`, `gerente.salta`, `cajero.salta`,
      `vendedor.salta` y `deposito.salta`.

## Dashboard

- [ ] Verificar las 4 tarjetas (hoy, últimos 7 días, mes calendario, parciales).
- [ ] Verificar alertas: vencidas, stock negativo/bajo y compras por recibir;
      enrutamientos a las tarjetas secundarias y desde allí a los módulos.
- [ ] Verificar cache en memoria (15 s + foco de ventana) y el refresco al
      volver desde otro módulo.

## Backend

- [ ] Revisar en Compras el mismo N+1 de `movimiento_caja__caja__sucursal`
      que se corrigió en el listado de Ventas.

- [ ] Reversión de pagos para poder anular ventas `PC`/`CO` y compras pagadas.
- [ ] Dashboard V2: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.
- [ ] Omitir desde la API los bloques del dashboard que el rol no puede ver.

## Documentación

- [ ] Sincronizar `INSTRUCCIONES.md` con la base actual: una sucursal, sin
      usuarios de Campo Quijano.

## Facturación y operación

- [ ] ARCA bloqueada: CUIT del emisor, certificado y punto de venta.
- [ ] El barrido de ventas vencidas sigue siendo manual.
