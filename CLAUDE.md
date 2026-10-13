# CLAUDE.md — Instrucciones operativas del agente

Este archivo define **cómo debe trabajar Claude en este repositorio**. No contiene conocimiento de dominio, arquitectura ni reglas de negocio — eso vive en `/docs`. Este documento es una capa de comportamiento, no una capa de conocimiento.

---

## 1. Jerarquía de fuentes de verdad

1. **El código actual** (`ecommerce_backend/SistemaVentas/`) es la única fuente de verdad sobre el comportamiento real del sistema.
2. **`/docs`** es la documentación oficial del backend: configuración, modelos, endpoints, seguridad, ventas/pagos y estado conocido.
3. **`/docs` es un Vault de Obsidian.** Sus archivos Markdown son documentación viva (wikilinks, grafo). No editar `docs/.obsidian/`.
4. Si algo en `/docs` o en `ecommerce_backend/readme.txt` contradice lo que el código hace, **el código gana**. Señala la contradicción explícitamente; no "corrijas" el código para que coincida con el documento.

Este archivo **no debe duplicar** conocimiento que ya existe en `/docs`.

---

## 2. Alcance del proyecto

- **Backend (Django + DRF + SQLite)**: en alcance. Es lo único documentado y auditado.
- **Frontend (`pixelappstore/`, React + Vite)**: en alcance desde el 12-10-2026 (pantallas de compra y pago). Documentado en [[07_Frontend_y_Guia_de_Pruebas]]. Usa proxy de Vite + sesión por cookie.

---

## 3. Antes de trabajar

- Antes de cambios importantes de código, consulta el documento relevante en `/docs` (ver mapa).
- Distingue siempre tres niveles de certeza:
  - **Comportamiento confirmado por el código** (verificado leyendo los fuentes).
  - **Información documentada pero no verificada** (afirmaciones de `/docs` o `readme.txt` que no confirmaste contra el código en la tarea actual).
  - **Propuestas o arquitectura futura** (aún no existen en el código).
- No mezcles estos niveles al comunicar hallazgos ni al escribir documentación.

---

## 4. Cuándo tocar documentación

Cuando un cambio modifique arquitectura, modelos, endpoints, seguridad, reglas de negocio o el flujo de pago:

- Si la tarea **incluye documentación** → actualiza el/los documentos afectados.
- Si la tarea es **solo de código** → no edites `/docs` por iniciativa propia; identifica qué documento quedó desactualizado y **propón** la actualización.
- No modifiques documentación ajena a la tarea ni "limpies" secciones no solicitadas.
- No crees nuevos `.md` en `/docs` ni renombres/fusiones documentos sin autorización.
- No dupliques información entre documentos: enlaza con `[[wikilinks]]`.
- El estado de bugs y pendientes vive **solo** en [[06_Estado_del_Backend_y_Pendientes]]. Al corregir algo de esa lista, márcalo ahí como corregido con fecha.

---

## 5. Mapa de documentación (`/docs`)

| Documento | Contenido |
|---|---|
| `docs/README.md` | Portada del Vault y navegación. |
| `docs/01_Arranque_y_Configuracion.md` | `settings.py`, `.env`, dependencias, cómo levantar el servidor. |
| `docs/02_Modelos_de_Datos.md` | Modelos de `gestion/models.py` y señales. |
| `docs/03_API_Endpoints.md` | Tabla de todas las rutas con el control de acceso **real** del código. |
| `docs/04_Autenticacion_y_Seguridad.md` | Login 2FA, bloqueo, JWT vs sesión, recuperación de clave, permisos. |
| `docs/05_Ventas_Carrito_y_Webpay.md` | Carrito, POS, flujo de pago Webpay, cupones, stock. |
| `docs/06_Estado_del_Backend_y_Pendientes.md` | Auditoría: fallas, riesgos y pendientes priorizados. |
| `docs/07_Frontend_y_Guia_de_Pruebas.md` | Pantallas del frontend, arquitectura (proxy/sesión) y pasos para probar el flujo de compra. |

---

## 6. Mapa de código

| Ruta | Contenido |
|---|---|
| `ecommerce_backend/SistemaVentas/manage.py` | Entrada de Django. |
| `.../SistemaVentas/settings.py` | Configuración (lee `.env`). |
| `.../gestion/models.py` | Modelos y señales. |
| `.../gestion/urls.py` | Todas las rutas de la API (sin prefijo). |
| `.../gestion/permisos.py` | Decoradores `requiere_staff` / `requiere_superusuario` para vistas Django planas. |
| `.../gestion/views/` | `views_productos`, `views_usuarios`, `views_ventas`, `views_webpay`, `views_dashboard`. |
| `.../gestion/fixtures/` | `usuarios.json`, `productos.json` (usados por endpoints "reemplazar"). |
| `.../db.sqlite3`, `.../media/` | Base de datos e imágenes locales. **Tratar con precaución.** |
| `pixelappstore/` | Frontend React + Vite (`src/pages`, `src/components`, `src/contexto`, `src/api.js`). Instalar con caché y TEMP en D:. |

---

## 7. Reglas de seguridad y manejo de datos

- **Nunca imprimir ni copiar valores de `.env`** (contiene `SECRET_KEY` y la clave de aplicación de Gmail). Si necesitas verificar que existe una variable, comprueba solo su presencia.
- **No modificar `.env`** ni `db.sqlite3` salvo que la tarea lo requiera explícitamente.
- **No ejecutar los endpoints `reemplazar` / `eliminar-todos`** contra la base real: borran productos o usuarios. Usar una copia de la BD.
- **No eliminar archivos o datos** sin autorización explícita.
- **Node/npm:** `node_modules/` se instala en el proyecto (D:), pero el caché de npm va por defecto a C:; usar `npm_config_cache` y `TEMP` apuntando a D: y borrar esas carpetas al terminar.
- **Instalaciones solo en D:** el disco C: no tiene espacio. Nunca instalar paquetes de forma global. Si hace falta Django u otra dependencia, usar un venv dentro del proyecto (`python -m venv ecommerce_backend\.venv`) y apuntar el caché y temporales a D: (`pip install --cache-dir D:\pip-cache`, `TMP`/`TEMP` en D:). Pedir confirmación antes de instalar.
- Antes de **cambios estructurales** (migraciones, cambios de modelo, refactors que toquen varias vistas), explicar qué archivos se afectan y esperar confirmación si la instrucción no lo cubre.
- Las credenciales de `fixtures/usuarios.json` son de desarrollo; no reutilizarlas ni citarlas como válidas en producción.

---

## 8. Testing

Hoy **no existen tests** (`gestion/tests.py` está vacío). Regla:

- **No crear tests automáticamente.** Solo cuando el usuario lo solicite explícitamente, incluso al agregar funcionalidad.
- Validar cambios con revisión del código, `python manage.py check`, y pruebas manuales del endpoint (curl/Postman) sobre una copia de la BD.
- Informar claramente qué tipo de validación se hizo. No afirmar que algo está "probado" si no se ejecutó.
- Si el usuario pide tests, usar el runner de Django (`python manage.py test`).

---

## 9. Regla fundamental
> Coloca pocos comentarios en el código y en español.
> Antes de cambiar código, entiende el contexto.
> Antes de cambiar arquitectura, revisa la documentación.
> Después de cambiar comportamiento, verifica (revisión del flujo, `manage.py check`, prueba manual). No crear tests sin autorización.
> Después de cambiar comportamiento documentado, identifica qué documentación quedó afectada.
> No inventes conocimiento.
> No dupliques documentación.
> No amplíes el alcance de una tarea sin autorización.
