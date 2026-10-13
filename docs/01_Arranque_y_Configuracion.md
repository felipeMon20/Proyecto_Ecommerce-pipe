# 01 — Arranque y Configuración

Archivo: `SistemaVentas/settings.py`. Ver también [[04_Autenticacion_y_Seguridad]].

## 1. Variables de entorno (`.env`)

`settings.py` carga `BASE_DIR/.env` con `python-dotenv`. Plantilla en `.env.example`:

| Variable | Uso |
|---|---|
| `SECRET_KEY` | Clave de Django. Si falta, vale `None` y Django no arranca. |
| `DEBUG` | Solo es `True` si el valor es exactamente `True`. Default `False`. |
| `ALLOWED_HOSTS` | Lista separada por comas. |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Cuenta Gmail para SMTP (smtp.gmail.com:587, TLS). |
| `CORS_ALLOWED_ORIGINS` | Orígenes del frontend (ej. `http://localhost:5173`). |

## 2. Configuración relevante

- **BD:** SQLite en `BASE_DIR/db.sqlite3`.
- **Apps:** `corsheaders`, `rest_framework`, `rest_framework_simplejwt`, `gestion`. **No** está `rest_framework_simplejwt.token_blacklist`.
- **DRF:** autenticación por `JWTAuthentication` y `SessionAuthentication`. Solo afecta a vistas DRF; ver [[04_Autenticacion_y_Seguridad]] §3.
- **JWT:** access 60 min, refresh 1 día, `ROTATE_REFRESH_TOKENS` y `BLACKLIST_AFTER_ROTATION` activos.
- **Sesión:** `SESSION_COOKIE_AGE = 600` (10 min), se renueva en cada request, expira al cerrar el navegador.
- **Media:** `MEDIA_URL=/media/`, `MEDIA_ROOT=BASE_DIR/media`; se sirve solo con `DEBUG=True`.
- **Regional:** `LANGUAGE_CODE='en-us'`, `TIME_ZONE='UTC'` (no está ajustado a Chile).
- **CORS:** solo `CORS_ALLOWED_ORIGINS`; no hay `CORS_ALLOW_CREDENTIALS`.
- **Faltan:** `STATIC_ROOT`, `DEFAULT_PERMISSION_CLASSES`, configuración de producción (HTTPS, cookies seguras).

## 3. Dependencias

Existe `ecommerce_backend/requirements.txt` (creado 12-10-2026). El `readme.txt` solo lista `django reportlab djangorestframework djangorestframework-simplejwt`, pero el código además importa **`python-dotenv`, `django-cors-headers`, `Pillow`, `transbank-sdk`**. Ver [[06_Estado_del_Backend_y_Pendientes]].

## 4. Entorno virtual

El entorno vive en `ecommerce_backend/.venv` (ignorado por git), creado con Python 3.14 e instalado con `requirements.txt` (versiones fijadas el 12-10-2026, Django 6.1.2). Crearlo de nuevo en otro equipo: `python -m venv .venv` y `.venv\Scripts\pip install -r requirements.txt`.

## 5. Levantar el servidor

Desde `ecommerce_backend/SistemaVentas/`, con venv activo y dependencias instaladas, `.env` creado desde `.env.example`:

```
python manage.py migrate
python manage.py runserver
```

Hay 13 migraciones (`0001`–`0013`), todas aplicadas en `db.sqlite3`. Verificado el 12-10-2026: `manage.py check` sin problemas y `makemigrations --check` sin cambios pendientes.

Los fixtures `usuarios.json` y `productos.json` se cargan por los endpoints `reemplazar` (ver [[03_API_Endpoints]]), no con `loaddata` como dice el readme (el formato de `usuarios.json` no es de fixture de Django).
