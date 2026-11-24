# Cierre de caja con Cobrado / Pagado / Neto por método

## Intención

Hoy el cierre de caja compara un solo neto por método de pago. Si una compra
se paga con tarjeta o transferencia desde esa caja, el neto del método queda
negativo y el formulario no permite cerrar porque el campo “Contado” rechaza
negativos. Se quiere separar, por método, **lo cobrado, lo pagado y el neto**,
con teórico y real, para poder cerrar siempre y ver comisiones o diferencias
sin inventar un “sobrante”.

## Decisiones acordadas

- **Efectivo:** un solo **Real contado**. El cajón es un solo montón; no se
  puede separar cuánto de lo contado es cobro y cuánto pago. El neto teórico
  incluye el monto inicial (`inicial + cobrado − pagado`).
- **Crédito / Transferencia / QR:** dos reales, **Real cobrado** y
  **Real pagado**. Ambos son importes positivos. Neto real =
  `real cobrado − real pagado`.
- **Venta con recargo por comisión:** la venta se registra al **precio
  normal**. El recargo se cobra fuera del sistema y no se registra. Si el banco
  acredita el precio normal, la diferencia es 0; si acredita menos, la
  diferencia es la comisión.
- **Diferencia:** se compara el neto real contra el neto teórico. Para
  efectivo, el neto teórico incluye el monto inicial. Para no efectivos, es
  `cobrado − pagado`, sin inicial.

## Modelo de datos

`DetalleCierreCaja` agrega cuatro campos (`DecimalField(12, 2)`, default 0):

- `cobrado_sistema`
- `pagado_sistema`
- `cobrado_real`
- `pagado_real`

Se mantienen `monto_sistema` y `monto_real` como el **neto** de cada método,
para no romper reportes, impresiones ni históricos. Para los cierres nuevos:

- `monto_sistema = cobrado_sistema − pagado_sistema` (más el inicial en
  efectivo, como hoy).
- `monto_real = cobrado_real − pagado_real` (en efectivo, el real contado).

La migración de datos rellena los campos nuevos de los históricos según el
signo del neto: si `monto_sistema` es positivo va a `cobrado_sistema`; si es
negativo, su valor absoluto va a `pagado_sistema`. Lo mismo para el real. Los
históricos siguen mostrando el neto; el desglose exacto solo existe para los
cierres nuevos.

## API

`GET /api/movimientos-caja/{id}/teorico/` devuelve por método:

- `metodo_pago`, `metodo_pago_detalle`, `es_efectivo`
- `cobrado_sistema`, `pagado_sistema`, `neto_sistema`
- `monto_sistema` (compatibilidad: neto, con inicial en efectivo)

`POST /api/movimientos-caja/{id}/cerrar/` acepta:

```json
{
  "montos_reales": {
    "11": "38500.00",
    "13": { "cobrado": "27001.00", "pagado": "55000.00" },
    "14": { "cobrado": "8500.00", "pagado": "104000.00" }
  },
  "password": "...",
  "observaciones": "...",
  "clave": "..."
}
```

- Efectivo: un número (el real contado).
- No efectivo: objeto con `cobrado` y `pagado`, ambos `>= 0`.
- Compatibilidad: un número para un método no efectivo se interpreta como neto
  y se reparte por signo entre `cobrado_real` y `pagado_real`.

## UI de cierre

```
MÉTODO         COBRADO              PAGADO               NETO
               Teórico  Real        Teórico  Real        Teórico   Real     Dif.
Efectivo       $13.500  —           $0       —           $38.500*  [____]   $0
Crédito        $27.001  [____]      $55.000  [____]      -$27.999  $ ...    $ ...
Transferencia  $8.500   [____]      $104.000 [____]      -$95.500  $ ...    $ ...

* El neto de efectivo incluye el monto inicial.
```

- Efectivo: el único input real está en la columna Neto.
- No efectivos: inputs en Real cobrado y Real pagado; el neto real y la
  diferencia se calculan solos.
- Los inputs arrancan con el teórico (así el cierre por defecto da diferencia
  0) y el usuario los ajusta contra el banco/terminal.
- El total y la diferencia se calculan sobre los netos.
- El detalle y la impresión del arqueo muestran el desglose; para históricos
  sin desglose, muestran el neto.

## Fuera de alcance

- No se agrega un campo de recargo/percepción en la venta.
- No se cambia la regla de que un pago no puede superar el total de la venta.
- No se toca la pausa, la sucursal ni la apertura de caja.

## Pruebas

- `calcular_teorico` separa cobrado/pagado/neto con ventas y compras.
- Cierre con compra pagada por transferencia: no bloquea, diferencia correcta.
- Comisión: venta $103,09, real cobrado $100 → diferencia −$3,09.
- Payload viejo (un número por método) sigue funcionando.
- Efectivo: el real contado se compara contra `inicial + cobrado − pagado`.
- Históricos: la migración deja el neto y el desglose por signo.
- `seed_data` sigue generando cierres coherentes.

## Riesgos

- `calcular_teorico` lo usan el endpoint, el seed y los tests; hay que
  actualizar los tres.
- La impresión del arqueo y la tabla de detalle deben tolerar históricos sin
  desglose.
- La migración no debe alterar `monto_sistema`/`monto_real` de los históricos.
