# Refacción del módulo Caja

Plan acordado para pasar de "una caja por sucursal" a **cajas físicas
reutilizables entre sucursales**, con el conteo de dinero siempre aislado por
`SeccionCaja`.

**Estado:** Fases 1 a 5 completadas (modelo/migraciones/seed, servicios, API,
frontend `/caja` y verificación automatizada). Resta el QA visual manual en
navegador a cargo del usuario.

## Modelo objetivo

### `Caja` (caja física, `CAJAS`)
- `id`
- `nombre` `CharField(50)` **único** (ej. `"Caja 1"`), identifica la caja física.
- `estado` `AC` Activa / `IN` Inactiva / `MT` En mantenimiento (default `AC`).
- **Sin** `sucursal`: la caja física es un activo reutilizable.

### `SucursalXCaja` (`SUCURSALES_X_CAJAS`)
Asignación/habilitación de una caja física en una sucursal.
- `id`
- `sucursal` FK → `Sucursal` (PROTECT)
- `caja` FK → `Caja` (PROTECT)
- `habilitada` `BooleanField(default=True)`
- `UNIQUE(sucursal, caja)`

### `SeccionCaja` (`SECCIONES_CAJA`)
Sesión/conteo de una caja física en una sucursal concreta.
- `id`
- `sucursal_caja` FK → `SucursalXCaja` (PROTECT) — reemplaza `caja`.
  La sucursal y la caja se derivan de `sucursal_caja`.
- `empleado` FK → `Empleado` (PROTECT)
- `fecha_hora_apertura`, `fecha_hora_cierre`
- `monto_inicial`, `monto_final`, `monto_teorico`
- `observaciones`
- `estado`: `AB` Abierta / `CE` Cerrada / `AU` Auditada
- `history`
- `UNIQUE(sucursal_caja) WHERE estado='AB'` — máx. **1 sección abierta por
  (caja, sucursal)**. La misma caja física puede estar abierta en Salta y en
  Quijano a la vez (son asignaciones distintas).

### `DetalleCierreCaja` (`DETALLES_CIERRE_CAJA`) — sin cambios
Desglose del arqueo por método de pago:
- `seccion_caja` FK (CASCADE)
- `metodo_pago` FK (PROTECT)
- `monto_sistema` (teórico), `monto_real` (contado), `diferencia` (propiedad)
- `UNIQUE(seccion_caja, metodo_pago)`
- `history`

Sirve para comparar el total del sistema contra lo contado **por método**. No
se mueve a `SeccionCaja` porque la cantidad de métodos es variable.

## Reglas de negocio

- **Apertura:** `AD/GE/CA`. `CA` solo en sucursales donde su empleado tiene
  `SucursalXEmpleado` activo; `AD/GE` en cualquier sucursal. La caja elegida
  debe existir en `SucursalXCaja` habilitada para esa sucursal y estar `AC`.
- **Concurrencia:** 1 sección `AB` por `sucursal_caja`.
- **Cierre:** solo `AB`; calcula `monto_teorico` y detalles por método, guarda
  `monto_final`, `fecha_hora_cierre`, observaciones y pasa a `CE`.
- **Auditoría:** solo `CE` → `AU` (`AD/GE`).
- **Gestión** de cajas físicas y asignaciones: solo `AD/GE`.
- El dinero se registra en `SeccionCaja` / `DetalleCierreCaja`; la caja física
  no guarda montos.

## Fases de implementación

### Fase 1 — Modelo, migraciones y datos base
1. `models.py`: quitar `Caja.sucursal`, agregar `Caja.nombre` único; crear
   `SucursalXCaja`; cambiar `SeccionCaja.caja` → `sucursal_caja` y agregar el
   constraint condicional.
2. Migración nueva (`0021+`) + `HistoricalSeccionCaja` actualizado.
3. `seed_data.py`: cajas físicas ("Caja 1", "Caja 2"), asignarlas a Salta y
   Quijano vía `SucursalXCaja`, secciones referenciando `sucursal_caja`.
4. Verificar `makemigrations`, `migrate`, `check`, `seed_data --reset`.

### Fase 2 — Servicios
- `abrir_seccion(caja, sucursal, empleado, monto_inicial)` transaccional:
  resuelve/valida `SucursalXCaja`, caja `AC`, sin otra `AB`, empleado `CA`
  asignado a la sucursal.
- `calcular_teorico`, `cerrar_seccion`, `auditar_seccion` operan sobre la
  sección (sucursal vía `sucursal_caja`).
- Tests de servicio.

### Fase 3 — API, serializers y vistas
- `CajaSerializer/ViewSet`: caja física (`nombre`, `estado`), gestión `AD/GE`.
- Nuevo `SucursalXCajaSerializer/ViewSet` (gestión `AD/GE`).
- `SeccionCajaSerializer`: exponer `sucursal_caja` y derivados
  `caja`/`sucursal` + detalle, `detalles_cierre`.
- `AperturaCajaSerializer` recibe `caja` + `sucursal` + `monto_inicial`.
- `GET /secciones-caja/{id}/teorico/` para el cierre (preview por método).
- Adaptar usos de `caja__sucursal` / `seccion.caja.sucursal` en ventas,
  compras, dashboard y filtros.
- Tests de API (permisos, concurrencia, teórico, cierre, auditoría).

### Fase 4 — Frontend `/caja`
- `pages/Caja.jsx` (reemplaza `EnDesarrollo`).
- Encabezado: sucursal + caja física + sección actual + secciones anteriores.
- `#cajas-abiertas` (ancla del dashboard) con acción Cerrar.
- Apertura (caja habilitada en la sucursal, sin `AB`), cierre (teórico por
  método + reales + diferencias), auditoría, historial y detalle.
- Gestión de cajas físicas y asignaciones solo `AD/GE`.
- Filtros URL, búsqueda con debounce, export CSV, `puedeEscribir`.

### Fase 5 — Verificación y documentación
- `check`, `makemigrations --check`, `migrate`, `test app`, `lint`, `build`.
- QA manual: misma caja abierta en dos sucursales, doble `AB` bloqueada, `CA`
  limitado a su sucursal, cierre con diferencias, auditoría, historial.
- Actualizar `AGENTS.md` y `DIA_SIGUIENTE.md`.
