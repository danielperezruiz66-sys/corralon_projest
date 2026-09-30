# INSTRUCCIONES

Guía para levantar el backend del proyecto **Corralón Fer-Cons** en tu equipo.

## Requisitos previos

Antes de empezar, asegurate de tener instalado:

- **Python 3.14** o superior — https://www.python.org/downloads/
- **MySQL Server 8** — https://dev.mysql.com/downloads/mysql/
- **Git** — https://git-scm.com/downloads

> Al instalar Python en Windows, marcá la casilla **"Add Python to PATH"**.

## 1. Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd corralon_projets
```

## 2. Crear y activar el entorno virtual

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

## 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

## 4. Configurar las variables de entorno

1. Copiá el archivo de ejemplo:
   ```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # Linux/Mac
   ```
2. Abrí `.env` y completá los valores:
   - `SECRET_KEY`: una clave secreta cualquiera (en desarrollo sirve la que trae).
   - `DB_PASSWORD`: tu contraseña de MySQL.
   - El resto de valores (`DB_NAME`, `DB_USER`, etc.) dejá los que vienen por defecto salvo que uses otros.

> El archivo `.env` es privado de cada desarrollador y **no se sube** al repositorio.

## 5. Crear la base de datos en MySQL

Ingresá a MySQL y creá la base:

```sql
CREATE DATABASE corralon_bd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Desde consola:
```bash
mysql -u root -p -e "CREATE DATABASE corralon_bd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## 6. Aplicar migraciones

```bash
python manage.py migrate
```

## 7. Levantar el servidor

```bash
python manage.py runserver
```

El servidor queda disponible en: **http://127.0.0.1:8000/**

---

## Estructura del proyecto

```
corralon_projets/
├── manage.py               # Utilidad de línea de comandos de Django
├── requirements.txt        # Dependencias del proyecto
├── .env.example            # Plantilla de variables de entorno
├── config/                 # Configuración general del proyecto
│   ├── settings.py         # Ajustes (lee secretos desde .env)
│   ├── urls.py             # Rutas principales
│   ├── wsgi.py / asgi.py   # Puntos de entrada del servidor
└── app/                    # Aplicación principal (gestion)
    ├── models.py           # Modelos de datos (32 modelos)
    └── migrations/         # Migraciones de la base de datos
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

| Acción | Comando |
|---|---|
| Verificar el proyecto | `python manage.py check` |
| Crear migraciones | `python manage.py makemigrations` |
| Aplicar migraciones | `python manage.py migrate` |
| Crear superusuario | `python manage.py createsuperuser` |
| Levantar servidor | `python manage.py runserver` |
