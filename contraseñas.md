# Usuarios y contraseñas demo

> Datos del seed local. Solo existe **Salta Capital**. Estas credenciales son
> de prueba, no de producción. `seed_data --reset` las vuelve a dejar así.

## Cómo iniciar sesión

1. **Backend** (API en `http://127.0.0.1:8000`):

   ```bash
   cd backend
   ..\venv\Scripts\python.exe manage.py runserver
   ```

2. **Frontend** (Vite muestra el puerto en la terminal; por defecto 5173, el
   equipo suele usar 5175):

   ```bash
   cd frontend
   npm run dev
   ```

3. Abrí `http://localhost:<puerto>/login`.
4. El login acepta **usuario o legajo** y la contraseña.

## Credenciales

| Usuario | Contraseña | Legajo | Rol | Qué probar |
|---|---|---|---|---|
| `admin` | `admin1234` | — | Superuser | Ve y puede hacer todo |
| `gerente.salta` | `test1234` | 0009 | GE | Gestión completa; paga y anula compras |
| `admin.salta` | `test1234` | 0001 | AD | Administrador no-superuser |
| `cajero.salta` | `test1234` | 0002 | CA | Caja, ventas, compras, clientes, consulta de stock/proveedores y facturación |
| `vendedor.salta` | `test1234` | 0003 | VE | Ventas, compras, clientes y consulta de stock/proveedores |
| `deposito.salta` | `test1234` | 0004 | ED | Compras, stock y proveedores |

## Notas

- El seed deja **Caja 1 y Caja 2 abiertas** para operar.
- La sesión vive en `sessionStorage`: se mantiene con la pestaña abierta y se
  cierra al cerrar la pestaña.
- Con una caja abierta el sistema no deja cerrar sesión: primero pausá o
  cerrá la caja.
- Cobrar/confirmar/anular ventas: `AD/GE/CA`. Pagar/anular compras: `AD/GE`.
- Un cliente inactivo no se ofrece ni se acepta en ventas.
- Al cambiar una contraseña, la política exige **letra + número + símbolo**
  (por ejemplo `Test1234!`). `test1234` es solo la clave del seed; si la
  cambiás desde Perfil, usá una que cumpla la política.
- La base demo se regenera con `seed_data --reset`; el seed es determinista.
