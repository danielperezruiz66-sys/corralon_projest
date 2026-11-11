# INSTRUCCIONES

Guía para instalar, ejecutar y cargar los datos de prueba de **Corralón Fer-Cons**.

El repositorio tiene dos partes independientes:

- `backend/` → API Django + PostgreSQL.
- `frontend/` → React + Vite.

Para arquitectura, modelos y reglas de negocio, ver `AGENTS.md`.

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

> Si PowerShell bloquea la activación:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

Editá `.env` (en la raíz) y configurá al menos `DB_PASSWORD`. Por defecto el
proyecto usa la base `corralon_bd`, usuario `postgres` y puerto **5433**. Si tu
PostgreSQL usa el puerto estándar, cambiá `DB_PORT=5432`.

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

`--reset` **borra los datos de negocio actuales** y genera un entorno completo:

- 2 sucursales en Salta: **Salta Capital** y **Campo Quijano**.
- 2 depósitos y 1 caja por sucursal.
- 4 empleados por sucursal (Administrador, Cajero, Vendedor y Encargado de depósito).
- 30 productos con categoría, marca, unidad, precio de venta, costo y stock.
- 6 meses de compras y ventas (240 ventas y 72 compras por defecto).

Para una carga más liviana:

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

Aplicación disponible en **http://localhost:5173/**.

Vite redirige `/api` a `http://localhost:8000`, así que el backend debe estar
corriendo. Para usar otra URL, definí `VITE_API_URL`.

## 4. Usuarios de prueba

El login acepta **usuario o legajo**. Todos los usuarios de sucursal usan la
contraseña `test1234`.

| Usuario | Rol | Legajo |
|---|---|---|
| `admin` / `admin1234` | Superusuario | — |
| `admin.salta` | Administrador | 0001 |
| `cajero.salta` | Cajero | 0002 |
| `vendedor.salta` | Vendedor | 0003 |
| `deposito.salta` | Encargado de depósito | 0004 |
| `admin.quijano` | Administrador | 0005 |
| `cajero.quijano` | Cajero | 0006 |
| `vendedor.quijano` | Vendedor | 0007 |
| `deposito.quijano` | Encargado de depósito | 0008 |

## 5. Comandos útiles

Desde `backend/`:

| Acción | Comando |
|---|---|
| Verificar configuración | `python manage.py check` |
| Aplicar migraciones | `python manage.py migrate` |
| Correr los tests | `python manage.py test app` |
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

## 7. Cancelación automática de ventas

Las ventas pendientes sin pagos se anulan según `VENTAS_MINUTOS_PARA_CONFIRMAR`
(30 minutos por defecto). El barrido debe ejecutarse cada 10 minutos.

**Windows:** ejecutar una vez:

```bat
scripts\programar_cancelacion.bat
```

**Linux:** agregar al cron:

```cron
*/10 * * * * cd /ruta/al/proyecto/backend && ../venv/bin/python manage.py cancelar_ventas_vencidas >> logs/cancelar_ventas_vencidas.log 2>&1
```
