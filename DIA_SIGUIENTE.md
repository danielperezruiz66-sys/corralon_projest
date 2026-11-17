# Pendientes

> Solo lo pendiente (lo terminado se borra). Contexto: `AGENTS.md`.

**Última actualización:** 2026-11-16

## Pendientes

### Rendimiento y seguridad (rama `perf/carga-inicial-y-queries`)
- [ ] Revisar y mergear en `main` las fases 1–5 (lazy, CSS por componente,
      componentes presentacionales, `select_related`, `page_size` y caché de
      catálogos) junto con el cierre por inactividad y el hardening de la API.

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

### Seguridad
- [ ] Migrar los JWT de `localStorage` a cookies `HttpOnly` (`Secure`,
      `SameSite`): endpoints de token que setean/leen cookies, logout con
      blacklist, protección CSRF y CORS con credenciales. Mantener Bearer para
      tests/móvil. Tarea separada.
- [ ] Definir en producción el `CORS_ALLOWED_ORIGINS` real y
      `SECURE_HSTS_SECONDS` cuando se sirva por HTTPS. El HTML del frontend
      necesita además CSP y cabeceras en el servidor web.

### Módulos nuevos
- [ ] **Perfil** (personal).
- [ ] **Actividad** (historial de cambios del sistema).
- [ ] Reemplazar `EnDesarrollo` en `App.jsx`.

### Backend
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
