# Usuarios y contraseñas demo

> Datos del seed local. Solo existe **Salta Capital**; no hay otras sucursales
> ni se pueden crear. Estas credenciales son de prueba, no de producción.

| Usuario | Contraseña | Rol | Legajo | Sucursal | Qué probar |
|---|---|---|---|---|---|
| `admin` | `admin1234` | Superuser | — | Salta Capital | Ve y puede hacer todo |
| `gerente.salta` | `test1234` | GE | 0009 | Salta Capital | Gestión completa; paga y anula compras |
| `admin.salta` | `test1234` | AD | 0001 | Salta Capital | Admin no-superuser |
| `cajero.salta` | `test1234` | CA | 0002 | Salta Capital | Caja, ventas, compras, clientes, consulta de stock/proveedores y facturación |
| `vendedor.salta` | `test1234` | VE | 0003 | Salta Capital | Ventas, compras, clientes y consulta de stock/proveedores |
| `deposito.salta` | `test1234` | ED | 0004 | Salta Capital | Compras, stock y proveedores |

## Notas

- Pagar y anular compras es solo de `AD`/`GE`. No hay solicitudes de pago.
- Inventario y proveedores los ven todos, pero solo `AD`/`GE`/`ED` los editan.
- El cajero no entra a Empleados; el vendedor no ve Administración.
- La caja se pausa con motivo y se reanuda con la contraseña del dueño.
- Con la caja abierta no se puede cerrar sesión.
- Ventas: sin pago queda `PE`, con pago parcial `PC` y con pago total `CO`.
- La base demo se regenera con `seed_data --reset`; el seed es determinista.
