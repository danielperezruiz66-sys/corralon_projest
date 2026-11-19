# Pendientes

> Único lugar de pendientes. Contexto y reglas en `AGENTS.md`; instalación en
> `INSTRUCCIONES.md`; credenciales demo en `contraseñas.md`.
> Se trabaja módulo por módulo, sin fases cerradas: al terminar uno se corrige,
> se verifica y se actualizan estos pendientes.

## Próximo módulo: Ventas

- [ ] Revisar pantalla, estados `PE`/`PC`/`CO`/`AN`, pestañas, acciones de
      cobro/confirmación/anulación, filtro Vencidas y atajos.
- [ ] Confirmar que “Por vencer” ya no existe en la UI y que la alerta de
      vencidas enruta a `/ventas?alerta=vencida`.
- [ ] Aplicar cache en memoria + actualización en segundo plano (patrón de
      Inicio) al módulo.

## Revisión módulo por módulo

- [ ] Caja.
- [ ] Compras.
- [ ] Clientes.
- [ ] Inventario.
- [ ] Proveedores.
- [ ] Empleados.
- [ ] Perfil y Actividad.
- [ ] Menú/encabezado y navegación general.
- [ ] En cada módulo revisado: cache en memoria, refresco en segundo plano,
      filtros/atajos correctos y coherencia con la API.
- [ ] QA visual final con `admin`, `gerente.salta`, `cajero.salta`,
      `vendedor.salta` y `deposito.salta`.

## Dashboard

- [ ] Verificar las 4 tarjetas (hoy, últimos 7 días, mes calendario, parciales).
- [ ] Verificar alertas: vencidas, stock negativo/bajo y compras por recibir;
      enrutamientos a las tarjetas secundarias y desde allí a los módulos.
- [ ] Verificar cache en memoria (15 s + foco de ventana) y el refresco al
      volver desde otro módulo.

## Backend

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
