# Refacción del módulo Caja

Plan original: pasar de "una caja por sucursal" a **cajas físicas
reutilizables entre sucursales**, con el conteo de dinero siempre aislado por
`SeccionCaja`.

**Estado:** implementado y verificado (migraciones `0021`–`0025`, servicios,
API, frontend `/caja`). El contexto operativo está en `AGENTS.md` §3 (reglas de
`SeccionCaja`) y §5 (permisos).

**Pendiente:** QA visual manual en navegador.
