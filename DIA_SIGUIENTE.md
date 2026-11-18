# Pendientes

> Solo lo pendiente (lo terminado se borra). Contexto: `AGENTS.md`.

**Última actualización:** 2026-11-18

**Qué se hizo (2026-11-18):** **Perfil** (`/perfil`) con modo lectura, edición
en modal, cambio de contraseña propio (todos los roles con empleado) y
validaciones. **Actividad** (`/actividad`, `AD`/`GE`): modelo
`RegistroActividad` alimentado por simple-history, slugs de modelo, filtros por
tipo de tarea (acción), usuario y fechas (sin filtro por módulo), y
`GET /api/actividad/resumen/` para KPIs reales; el signal se corrigió para
simple-history 3.x (`history_instance` en kwargs). La tabla usa una columna
**Detalle** con el motivo o el diff legible de los campos cambiados (sin
passwords), en lugar de Campo/Valor anterior/Valor nuevo. Se agregó historial
a `ProductoXProveedor` para auditar el precio de costo.

## Pendientes

### QA visual manual (usuario)
- [ ] **Roles**: con `cajero.salta`/`vendedor.salta`/`deposito.salta`/
      `gerente.salta`/`admin` revisar el menú: quién ve Ventas, Compras,
      Clientes, Inventario, Proveedores, Caja, Empleados y Facturación, y que
      Inventario/Proveedores abran sin botones de edición para `CA`/`VE`.
- [ ] **Compras**: `CA`/`VE`/`ED` registran, ponen en camino y reciben; el
      botón "Solicitar pago"/"Solicitar anulación" pide motivo (mín. 10
      caracteres); la compra queda con badge "Solicitud pendiente"; con la
      solicitud abierta no aparece "Registrar pago"; en la pestaña
      **Solicitudes** `AD`/`GE` pagan, anulan o rechazan y queda quién resolvió.
- [ ] **Caja**: pausar con motivo (queda el motivo en el detalle y el estado
      "Pausada"); reanudar pide contraseña y falla con la incorrecta; en pausa
      no se pueden registrar ventas ni cerrar; el filtro "En pausa" y el badge
      del sidebar; el aviso al intentar cerrar sesión con la caja abierta.
- [ ] **Alcance de caja**: con `cajero.salta` solo debe verse **su propia**
      sección y solo lo de su sucursal; el gerente ve sus sucursales y el admin
      ve todo. Pedir otra sucursal por URL da 403.
- [ ] **Empleados**: `AD`/`GE` filtran por rol (Admin, Gerente, Cajero,
      Vendedor, Depósito) además de por estado y sucursal.
- [ ] **Stock entre sucursales**: en Inventario → Stock, el check "Ver el
      stock de todas las sucursales" muestra las filas de ambas sucursales; en
      Ventas, al buscar un producto, la columna Stock muestra la cantidad de la
      sucursal propia y debajo la de las demás (`Quijano: 5`). Verificar que
      vender/solicitar siga usando solo el stock de la sucursal propia.
- [ ] **Facturación**: el cajero ve el cascarón (emitir deshabilitado +
      comprobantes) y `AD`/`GE` además los datos de emisión.
- [ ] **Dashboard**: que cada rol vea solo sus bloques (ventas, compras,
      stock, caja, equipo) y los avisos por rol.
- [ ] **Actividad**: editar un producto/venta/compra y verificar que aparezca
      el registro con modelo, objeto, acción y usuario (incluye modelos
      relacionados, ej. pago de venta); probar los filtros por tipo de tarea,
      usuario y fechas, y que los KPIs coincidan con el total.
- [ ] **Perfil**: editar datos (con empleado y con superuser sin empleado),
      cambiar la propia contraseña desde roles `CA`/`VE`/`ED`/`AD`/`GE` y que un
      no-admin no pueda cambiar la de otro.
- [ ] **Caja** (QA previo): selector "A nombre de" solo con habilitados en la
      sucursal; apertura propia y a nombre de otro; sugerencia de monto inicial;
      observación de apertura obligatoria al diferir; contado precargado al
      teórico; nota inborrable del arqueo; **Imprimir arqueo**; auditoría desde
      el detalle; historial con filtros/URL/CSV.
- [ ] **Empleados** (QA previo): `/empleados` para `AD`/`GE` (no para
      `CA/VE/ED`); búsqueda viva, filtro de estado/sucursal, paginación, CSV;
      alta con y sin acceso; duplicados rechazados; sync de roles/sucursales;
      creación de acceso desde la edición; contraseña solo `AD`; suspensión
      bloquea acceso.
- [ ] **General**: rutas `/login`, `/caja`, ventas, compras, dashboard, perfil,
      actividad; usuarios de prueba (`admin`/`admin1234`; `*_salta`,
      `*_quijano` y `gerente.salta` con `test1234`); sin rol → solo Inicio y
      Perfil.

### Backend
- [ ] Restringir datos por sucursal en el resto de la API (hoy solo el
      dashboard lo hace).
- [ ] Reversión de pagos: hoy una compra con pagos no se puede anular; hace
      falta el camino para revertir y después anular.
- [ ] El dashboard por rol ya devuelve `bloques`; falta que la API **omita**
      los bloques que el rol no puede ver (hoy los oculta el frontend).

### Dashboard V2
- [ ] Métricas pendientes: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.

### Candidatos para la lógica entre sucursales
- [ ] Dashboard: el KPI de stock crítico por sucursal vs. total.
- [ ] Compras: ver las compras pendientes de recibir de la otra sucursal
      (para derivar mercadería antes de comprar de más).
- [ ] Proveedores/costos: mostrar el costo por sucursal junto al global.

### Facturación (ARCA)
- [ ] Sigue bloqueada por falta de CUIT del emisor, certificado y punto de venta
      habilitado. La hoja de ruta (homologación, WSAA, WSFEv1) está en
      `AGENTS.md` §7. El módulo ya tiene el cascarón y los permisos.

### Operación
- [ ] El barrido de ventas vencidas es **manual** (`cancelar_ventas_vencidas`).
      No programarlo automáticamente en el servidor.
