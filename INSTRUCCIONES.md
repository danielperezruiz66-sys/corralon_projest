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

Para compilar la versión de producción:

```bash
npm run build
```

## Estructura del proyecto

```
corralon_projest/
├── backend/                # Entorno Backend (Python / Django)
│   ├── config/             # Configuración general del proyecto
│   │   ├── settings.py     # Ajustes (lee secretos desde ../.env)
│   │   ├── urls.py         # Rutas principales
│   │   ├── asgi.py         # Punto de entrada ASGI
│   │   └── wsgi.py         # Punto de entrada WSGI
│   ├── app/                # Aplicación principal (gestión)
│   │   ├── migrations/     # Migraciones de la base de datos
│   │   ├── management/     # Comandos personalizados (seed_data)
│   │   ├── models.py       # Modelos de datos (33) agrupados por dominio
│   │   ├── services/       # Lógica de negocio por dominio
│   │   ├── views.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── backends.py     # Autenticación (login por usuario o legajo)
│   │   └── tests.py
│   ├── manage.py           # Utilidad de línea de comandos de Django
│   └── requirements.txt    # Dependencias del proyecto
│
├── frontend/               # Entorno Frontend (React + Vite + JS)
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── .env.example            # Plantilla de variables de entorno
├── .gitignore              # Ignorados globales del repositorio
└── INSTRUCCIONES.md
```

## Módulos del sistema (modelos)

- **Geografía:** Países, Provincias, Localidades, Ubicaciones
- **Organización:** Empresas, Sucursales, Empleados, Roles, asignaciones
- **Catálogo:** Categorías, Marcas, Unidades, Productos
- **Stock:** Depósitos, Stock, Detalles de Stock, Productos por Sucursal
- **Cajas:** Cajas y Secciones de Caja (turnos)
- **Ventas / Compras:** Ventas, Detalles, Facturas, Compras, Detalles
- **Pagos:** Métodos de Pago y sus relaciones con Ventas/Compras
- **Proveedores:** Proveedores, Productos por Proveedor, Proveedores por Sucursal

## Comandos útiles

| Acción | Comando (desde `backend/`) |
|---|---|
| Verificar el proyecto | `python manage.py check` |
| Crear migraciones | `python manage.py makemigrations` |
| Aplicar migraciones | `python manage.py migrate` |
| Crear superusuario | `python manage.py createsuperuser` |
| Levantar servidor | `python manage.py runserver` |

| Acción | Comando (desde `frontend/`) |
|---|---|
| Instalar dependencias | `npm install` |
| Levantar servidor de desarrollo | `npm run dev` |
| Compilar para producción | `npm run build` |
| Analizar el código | `npm run lint` |
