# Pendientes

> Único lugar de pendientes. Contexto y reglas en `AGENTS.md`; instalación en
> `INSTRUCCIONES.md`; credenciales demo en `contraseñas.md`.

## QA visual

- [ ] QA visual final con `admin`, `gerente.salta`, `cajero.salta`,
      `vendedor.salta` y `deposito.salta`.
- [ ] Confirmar que **Configuración** aparece solo para `admin`/superusuario y
      que guarda datos de la empresa sin errores.
- [ ] Confirmar que **Perfil** y **Configuración** se ven parecidos y que solo
      `admin`/superusuario edita campos; los demás roles ven todo en lectura.
- [ ] Confirmar que al iniciar sesión el menú lateral arranca cerrado (solo
      iconos) y las categorías aparecen colapsadas.

## Backend

- [ ] Reversión de pagos para poder anular ventas `PC`/`CO` y compras pagadas.
- [ ] Dashboard V2: top productos, formas de pago, ventas por sucursal,
      diferencias de caja y actividad reciente.
- [ ] Omitir desde la API los bloques del dashboard que el rol no puede ver.

## Documentación

- [ ] Sincronizar `INSTRUCCIONES.md` con la base actual: una sucursal, sin
      usuarios de Campo Quijano.

## Facturación y operación

- [ ] ARCA bloqueada: certificado y punto de venta.
- [ ] El barrido de ventas vencidas sigue siendo manual.

## Control de cambios

- [ ] Commitear en `combinacion-etapas` los cambios de Configuración, la unificación
      visual de Perfil/Configuración, los permisos de perfil y el arreglo de
      `Login.css`; no incluir `HISTORIAL_CHAT_ANTERIOR.md`.
- [ ] Confirmar push de `combinacion-etapas`.
