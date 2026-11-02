# Pendientes

> Se reescribe al cerrar cada sesión. Solo contiene lo pendiente de la sesión
> anterior; lo terminado o descartado se borra. No es un historial.
> Contexto del proyecto: ver `AGENTS.md`.

**Cerrado el:** 2026-11-02

## 1. Endpoints de escritura (delegando en `services/`)

Los servicios ya están implementados y probados; falta exponerlos por HTTP.

- [ ] `POST /api/ventas/` → `services.ventas.crear_venta` (items + cliente).
- [ ] `POST /api/ventas/{id}/confirmar/` y `POST /api/ventas/{id}/cancelar/`.
- [ ] `POST /api/compras/` → `services.compras.registrar_compra`.
- [ ] `POST /api/compras/{id}/recibir/` → `services.compras.recibir_compra`.
- [ ] `POST /api/secciones-caja/` (abrir) y `POST /api/secciones-caja/{id}/cerrar/`
      con los montos reales por método de pago.
- [ ] Traducir `StockInsuficiente` y `ValueError` a `400` con mensaje claro
      (hoy serían `500` si se llamaran desde una vista).

## 2. Scheduler de auto-cancelación

- [ ] Programar `manage.py cancelar_ventas_vencidas` cada 5–10 minutos
      (cron en Linux o Task Scheduler en Windows). El comando existe y está
      probado; solo falta instalarlo en el entorno.

## 3. API y permisos

- [ ] Definir permisos de escritura por rol. Hoy cualquier usuario autenticado
      puede escribir catálogo; solo `Usuario` exige `IsAdminUser`.
- [ ] Revisar si `SeccionCajaViewSet` debe exponer las acciones de caja o si
      conviene un endpoint aparte.

## 4. Tests automatizados

- [ ] `APITestCase` de autenticación, permisos y endpoints principales.
- [ ] Servicios: venta descuenta stock; cancelación manual y automática lo
      restauran sobre los mismos lotes; venta rechazada al superar
      `cant_negativa_max`; compra no toca stock hasta `recibir_compra`; caja no
      cierra dos veces y calcula teórico vs real.
- [ ] Regresión: `select_for_update` con joins nullable (bug corregido en
      `restaurar_stock` y `recibir_compra`).

## 5. Frontend

- [ ] Cliente HTTP con JWT (login + refresh automático) en React.
- [ ] Proxy de Vite hacia el backend en desarrollo.
- [ ] Pantalla de login (usuario o legajo) y listado de productos con búsqueda
      y paginación.
