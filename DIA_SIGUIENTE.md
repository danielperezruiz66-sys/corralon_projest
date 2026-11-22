# Pendientes

> Único lugar de pendientes. Contexto y reglas en `AGENTS.md`; instalación en
> `INSTRUCCIONES.md`; credenciales demo en `contraseñas.md`.
> Se trabaja módulo por módulo, sin fases cerradas: al terminar uno se corrige,
> se verifica y se actualizan estos pendientes.

## Contexto al cierre — 2026-11-22

- Solución #1 cerrada: constraints únicos en las 3 relaciones N:M, validadores
  de precio, bloqueo de costos duplicados con `PATCH` del existente y tests.
- Integración visual de `combinacion-etapas`: estilos compartidos, módulo
  Configuración, Perfil/Actividad/Facturación rediseñados y **toda la UI sin
  sucursales** (sin filtros, columnas ni checklists).
- `useCacheModulo` aplicado en todos los módulos: Inicio, Ventas, Compras,
  Inventario, Proveedores, Clientes, Caja, Empleados, Actividad, Facturación,
  Perfil y Configuración.
- QA de 12 rutas sin errores de consola; flujo de costo duplicado revalidado.
- Backend: 259 tests OK. Frontend: lint 0 warnings y build OK.
- La rama `main` quedó actualizada con este estado.

## Próximo módulo: Caja

- [ ] Revisar pantalla, secciones `AB`/`PA`/`CE`/`AU`, apertura, cierre,
      pausa, reanudación, auditoría y arqueo por método.
- [ ] Verificar montos sugeridos, notas inborrables y permisos (`CA` en sus
      sucursales, `AD/GE` en cualquiera).

## Ventas

- [ ] QA visual: estados `PE`/`PC`/`CO`/`AN`, pestañas, cobro/confirmación/
      anulación por rol, filtro Vencidas y atajos.
- [ ] Confirmar que la alerta de vencidas del Dashboard enruta a
      `/ventas?alerta=vencida` y que “Por vencer” no existe en la UI.
- [ ] QA: fechas (Desde tope ayer; Hasta y Un día tope hoy) y consumidor final
      obligatorio sin cliente / oculto con cliente, con nombre y documento en
      el selector.

## Revisión módulo por módulo

- [ ] Compras.
- [ ] Clientes.
- [ ] Inventario.
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
