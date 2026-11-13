# Pendientes

> Solo lo pendiente (lo terminado se borra). Contexto: `AGENTS.md`.

**Última actualización:** 2026-11-13

**Qué se hizo (2026-11-13):** módulo **Caja** completo — cajas físicas
reutilizables entre sucursales; `SeccionCaja` con apertura propia o a nombre
de otro habilitado (`AD`/`GE`); sugerencia de monto inicial del último cierre;
cierre con el campo Contado precargado al teórico por método; nota del sistema
inborrable en observaciones si hay diferencia; "Imprimir arqueo"; un empleado no
puede tener dos secciones abiertas (constraint `una_seccion_abierta_por_empleado`);
apertura a nombre de otro queda en el historial. Módulo **Empleados** completo
(`/empleados`, solo `AD`/`GE`) — listado con búsqueda viva, filtro de estado,
paginación, export CSV y filtro por sucursal del encabezado; alta con acceso
opcional (usuario + contraseña letras+números+símbolo, sin mínimo fijo);
edición con sync de roles/sucursales (AC↔IN); creación de acceso desde la
edición para empleados sin usuario; cambio de contraseña solo `AD` con doble
verificación (Swal + modal con tu contraseña); suspensión/inactividad cierra
sesiones; API devuelve 401 a no-`AC`; validación en tiempo real en alta y
edición; suite backend **218/218** y build/lint en verde.

## Pendientes

### QA visual manual (usuario)
- [ ] **Caja**: selector "A nombre de" solo con habilitados en la sucursal
      (CA asignado o AD/GE); apertura propia y a nombre de otro; sugerencia
      de monto inicial; observación de apertura obligatoria al diferir;
      contado precargado al teórico; nota inborrable del arqueo; **Imprimir
      arqueo**; auditoría desde el detalle (sin botón duplicado); historial
      con filtros/URL/CSV.
- [ ] **Empleados**: `/empleados` para `AD`/`GE` (no para `CA/VE/ED`);
      búsqueda viva, filtro de estado/sucursal, paginación, CSV; alta con y
      sin acceso; duplicados rechazados; sync de roles/sucursales; creación
      de acceso desde la edición para empleados huérfanos; contraseña solo
      `AD` (doble verificación, cierra sesiones); suspensión bloquea acceso.
- [ ] **General QA (previos)**: seed determinista y consistente; flujo
     Ventas/Compras/Clientes/Inventario verificado con el selector de sucursal;
      búsqueda viva remota; validaciones congruentes en cada formulario.
- [ ] **General**: rutas `/login`, `/caja`, ventas, compras, dashboard; el
      usuario de prueba `admin`/`admin1234` y los de sucursal (`*_salta`,
      `*_quijano`) con contraseña `test1234` login OK; sin rol → solo Inicio y
      Perfil.
- [ ] Cuando ambos QA OK → **commit** de los módulos.

### Módulos nuevos
- [ ] **Perfil** (personal).
- [ ] **Actividad** (historial de cambios del sistema).
- [ ] Reemplazar `EnDesarrollo` en `App.jsx`.

### Backend
- [ ] Endpoint de cambio de contraseña del propio usuario (`/cambiar-contrasena`).
- [ ] Restringir datos por sucursal en la API para usuarios no-admin.
- [ ] Evaluar reversión de pagos para anular ventas pendientes con pago parcial.
- [ ] Aplicar `puedeEscribir` a los módulos que falten.

### Dashboard V2
- [ ] Definir métricas: top productos, formas de pago, ventas por sucursal,
      diferencias de caja, actividad reciente.

### Facturación (ARCA)
- [ ] Sigue bloqueada por falta de CUIT del emisor, certificado y punto de venta
      habilitado. La hoja de ruta (homologación, WSAA, WSFEv1) está en `AGENTS.md`.

### Operación
- [ ] El barrido de ventas vencidas es **manual** (`cancelar_ventas_vencidas`).
      No programarlo automáticamente en el servidor.
