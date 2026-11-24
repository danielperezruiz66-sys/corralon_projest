# INSTRUCCIONES

Guía para instalar, ejecutar y cargar los datos de prueba de **Corralón
Fer-Cons**. Arquitectura y reglas de negocio en `AGENTS.md`; credenciales en
`contraseñas.md`.

El repositorio tiene dos partes independientes:

- `backend/` → API Django + PostgreSQL.
- `frontend/` → React + Vite.

## 1. Requisitos

- **Python 3.14+**
- **PostgreSQL 16+**
- **Node.js 20+**
- **Git**

En Windows, al instalar Python marcá **“Add Python to PATH”**.

## 2. Instalar el proyecto

### 2.1 Clonar

```bash
git clone <URL-del-repositorio>
cd corralon_projest
```

### 2.2 Backend

Desde la raíz del repositorio:

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
copy .env.example .env
```

**Windows (CMD):**
```cmd
python -m venv venv
venv\Scripts\activate.bat
pip install -r backend\requirements.txt
copy .env.example .env
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
```

Editá `.env` (en la raíz) y configurá al menos `SECRET_KEY` y
`DB_PASSWORD`. Por defecto el proyecto usa la base `corralon_bd`, usuario
`postgres` y puerto **5433**. Si tu PostgreSQL usa el puerto estándar, cambiá
`DB_PORT=5432`.

`CORS_ALLOWED_ORIGINS` es opcional: por defecto permite `localhost` y
`127.0.0.1` en los puertos 5175, 5173 y 4173. Si el frontend usa otro origen,
agregalo ahí.

### 2.3 Crear la base de datos

```sql
CREATE DATABASE corralon_bd WITH ENCODING 'UTF8';
```

O desde consola:

```bash
createdb -U postgres -p 5433 corralon_bd
```

### 2.4 Migrar y cargar datos de prueba

```bash
cd backend
python manage.py migrate
python manage.py seed_data --reset
```

`--reset` **borra los datos de negocio actuales** y genera el entorno demo:

- 1 sucursal: **Salta Capital**.
- 2 depósitos y 2 cajas físicas (`Caja 1` y `Caja 2`); el seed las deja
  abiertas.
- 6 usuarios: `admin` (superuser) y los 5 empleados demo con sus roles.
- 30 productos con categoría, marca, unidad, precio de venta, costo y stock.
- 6 meses de compras y ventas (238 ventas y 72 compras por defecto).

El comando imprime las credenciales generadas; también están en
`contraseñas.md`. Para una carga más liviana:

```bash
python manage.py seed_data --reset --ventas 50 --compras 20
```

> Ejecutá `seed_data` únicamente sobre una base de desarrollo: reemplaza todos
> los datos de negocio.

### 2.5 Levantar el backend

```bash
python manage.py runserver
```

API disponible en **http://127.0.0.1:8000/**.

## 3. Frontend

En otra terminal, desde la raíz:

```bash
cd frontend
npm install
npm run dev
```

Vite muestra el puerto en la terminal (5173 por defecto; el equipo suele usar
**5175**). Vite redirige `/api` a `http://localhost:8000`, así que el backend
debe estar corriendo. Para usar otra URL, definí `VITE_API_URL`.

## 4. Iniciar sesión

Abrí `http://localhost:<puerto>/login`. El login acepta **usuario o legajo** y
la contraseña. La tabla completa está en `contraseñas.md`.

| Usuario | Contraseña | Legajo | Rol |
|---|---|---|---|
| `admin` | `admin1234` | — | Superuser |
| `gerente.salta` | `test1234` | 0009 | Gerente |
| `admin.salta` | `test1234` | 0001 | Administrador |
| `cajero.salta` | `test1234` | 0002 | Cajero |
| `vendedor.salta` | `test1234` | 0003 | Vendedor |
| `deposito.salta` | `test1234` | 0004 | Depósito |

> Al cambiar una contraseña, la política exige letra + número + símbolo. El
> `test1234` es solo la clave del seed.

## 5. Comandos útiles

Desde `backend/`:

| Acción | Comando |
|---|---|
| Verificar configuración | `python manage.py check` |
| Aplicar migraciones | `python manage.py migrate` |
| Correr los tests | `python manage.py test app` (313 tests) |
| Cargar datos de prueba | `python manage.py seed_data --reset` |
| Cancelar ventas vencidas | `python manage.py cancelar_ventas_vencidas --minutos 30` |

Desde `frontend/`:

| Acción | Comando |
|---|---|
| Desarrollo | `npm run dev` |
| Compilar producción | `npm run build` |
| Analizar el código | `npm run lint` |

## 6. Actualizar el proyecto

Después de un `git pull`:

```bash
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
cd ../frontend
npm install
```

Si querés volver a los datos demo, recién ahí:

```bash
cd backend
python manage.py seed_data --reset
```

## 7. Cancelación de ventas vencidas (manual)

Las ventas pendientes sin pagos **no se anulan automáticamente** tras
`VENTAS_MINUTOS_PARA_CONFIRMAR` (30 minutos). Se muestran como alerta en el
dashboard y en el módulo de ventas; el stock sigue reservado hasta que se
anulan manualmente.

El comando queda disponible para uso manual en desarrollo o si se decide
correrlo manualmente:

```bash
python manage.py cancelar_ventas_vencidas --minutos 30
```

> **No programar** la tarea `Corralon\CancelarVentasVencidas` (ni cron
> equivalente) en el servidor.
