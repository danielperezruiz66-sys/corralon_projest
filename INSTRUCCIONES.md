# INSTRUCCIONES

Guía para levantar el proyecto **Corralón Fer-Cons** en tu equipo.

El repositorio está dividido en dos entornos independientes:

- `backend/` → API Django (Python)
- `frontend/` → Aplicación React (Vite + JavaScript)

## Requisitos previos

Antes de empezar, asegurate de tener instalado:

- **Python 3.14** o superior — https://www.python.org/downloads/
- **PostgreSQL 16** o superior — https://www.postgresql.org/download/
- **Node.js 20** o superior — https://nodejs.org/
- **Git** — https://git-scm.com/downloads

> Al instalar Python en Windows, marcá la casilla **"Add Python to PATH"**.

## 1. Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd corralon_projest
```

## 2. Backend (Django)

### 2.1 Crear y activar el entorno virtual

Desde la raíz del repositorio:

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
python -m venv venv
venv\Scripts\activate.bat
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

> Si PowerShell bloquea el script de activación, ejecutá una vez:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### 2.2 Instalar dependencias

Con el entorno virtual activado, entrá a `backend/` e instalá:

```bash
cd backend
pip install -r requirements.txt
```

### 2.3 Configurar las variables de entorno

El archivo `.env` vive en la **raíz del repositorio** (Django lo lee automáticamente
desde `backend/config/settings.py`).

1. Copiá el archivo de ejemplo:
   ```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # Linux/Mac
   ```
2. Abrí `.env` y completá los valores:
   - `SECRET_KEY`: una clave secreta cualquiera (en desarrollo sirve la que trae).
   - `DB_PASSWORD`: tu contraseña de PostgreSQL.
   - El resto de valores (`DB_NAME`, `DB_USER`, etc.) dejá los que vienen por defecto salvo que uses otros.

> El archivo `.env` es privado de cada desarrollador y **no se sube** al repositorio.

### 2.4 Crear la base de datos en PostgreSQL

Ingresá a PostgreSQL y creá la base:

```sql
CREATE DATABASE corralon_bd WITH ENCODING 'UTF8';
```

Desde consola:
```bash
createdb -U postgres corralon_bd
```

> Por defecto el proyecto apunta al puerto **5433** (`DB_PORT` en `.env`).
> Si tu PostgreSQL escucha en el puerto estándar, cambiá `DB_PORT=5432`.

### 2.5 Aplicar migraciones

```bash
python manage.py migrate
```

### 2.6 Levantar el servidor

```bash
python manage.py runserver
```

El servidor queda disponible en: **http://127.0.0.1:8000/**

## 3. Frontend (React + Vite)

En otra terminal, desde la raíz del repositorio:

```bash
cd frontend
npm install
npm run dev
```

El servidor de Vite queda disponible en: **http://localhost:5173/**

Vite redirige las llamadas a `/api` hacia el backend en **http://localhost:8000**,
así que el servidor de Django tiene que estar levantado. Para apuntar a otro
backend, definí `VITE_API_URL` al iniciar Vite.

La pantalla de login acepta **usuario o legajo**. Con los datos de `seed_data`
podés entrar con `admin` / `admin1234` o con `maria.gomez` / `test1234`.

Para compilar la versión de producción:

```bash
npm run build
```

## Estructura del proyecto

```
corralon_projest/
├── backend/                # Django + DRF
│   ├── config/             # settings, urls, asgi, wsgi
│   ├── app/                # única app: models, services, views, serializers,
│   │                       # migrations, tests, management/commands
│   ├── logs/               # salida del barrido (no se commitea)
│   ├── manage.py
│   └── requirements.txt
├── frontend/               # React + Vite (src/api, context, pages, components)
├── scripts/                # tareas programadas de Windows
├── .env.example
├── AGENTS.md               # contexto y reglas para agentes
├── DIA_SIGUIENTE.md        # pendientes de la sesión anterior
└── INSTRUCCIONES.md        # esta guía
```

Los dominios, modelos y reglas de negocio están en `AGENTS.md`.

## Comandos útiles

| Acción | Comando (desde `backend/`) |
|---|---|
| Verificar el proyecto | `python manage.py check` |
| Crear migraciones | `python manage.py makemigrations` |
| Aplicar migraciones | `python manage.py migrate` |
| Crear superusuario | `python manage.py createsuperuser` |
| Levantar servidor | `python manage.py runserver` |
| Correr los tests | `python manage.py test app` |
| Cancelar ventas vencidas | `python manage.py cancelar_ventas_vencidas --minutos 30` |
| Cargar datos de prueba | `python manage.py seed_data --reset` |

| Acción | Comando (desde `frontend/`) |
|---|---|
| Instalar dependencias | `npm install` |
| Levantar servidor de desarrollo | `npm run dev` |
| Compilar para producción | `npm run build` |
| Analizar el código | `npm run lint` |

## Tareas programadas

Las ventas `PENDIENTE` se cancelan solas cuando superan el umbral configurado en
`.env` (`VENTAS_MINUTOS_PARA_CONFIRMAR`, 30 minutos por defecto). El barrido
debe correr cada `VENTAS_BARRIDO_MINUTOS` (10 minutos por defecto).

**Windows (Programador de tareas).** Ejecutar una vez:

```bat
scripts\programar_cancelacion.bat
```

Crea la tarea `Corralon\CancelarVentasVencidas`, que corre
`scripts\cancelar_ventas_vencidas.bat` cada 10 minutos y escribe el resultado
en `backend\logs\cancelar_ventas_vencidas.log`.

> Por defecto la tarea corre con la sesión del usuario abierta. Si el servidor
> queda sin sesión iniciada, registrarla con las credenciales de una cuenta de
> servicio (`schtasks /Create ... /RU USUARIO /RP CONTRASEÑA`).

**Linux (cron).** Agregar al crontab del usuario que corre el backend:

```cron
*/10 * * * * cd /ruta/al/proyecto/backend && ../venv/bin/python manage.py cancelar_ventas_vencidas >> logs/cancelar_ventas_vencidas.log 2>&1
```
