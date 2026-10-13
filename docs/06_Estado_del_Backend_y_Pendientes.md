# 06 — Estado del Backend y Pendientes

Auditoría del 12-10-2026. **Certeza:** hallazgos confirmados leyendo el código; **no ejecutados** (Django no instalado en el equipo). Cada punto se marcará como corregido aquí con su fecha cuando se arregle. Contexto en [[03_API_Endpoints]], [[04_Autenticacion_y_Seguridad]] y [[05_Ventas_Carrito_y_Webpay]].

**Veredicto:** la lógica de negocio (modelos, flujo de venta, 2FA, dashboard) está bastante completa, pero el backend **no es seguro ni está listo para conectarse a un frontend**. Los problemas más graves son de autorización y del flujo de pago.

## 1. Pago Webpay: por qué "en código salía y en la interfaz no"

Causas confirmadas:
1. El frontend no implementa el pago: `pixelappstore/src/pages/CheckoutPage.jsx` es solo un `<h1>`.
2. El backend solo entrega `url_webpay` + `token`; alguien debe hacer el POST/redirect a Webpay con `token_ws`. Nada lo hace.
3. El retorno (`http://127.0.0.1:8000/webpay/confirmar`) está fijo y responde **JSON**, no redirige a la tienda: el usuario terminaría viendo JSON crudo.
4. La sesión no llegará al backend desde `localhost:5173` (falta `CORS_ALLOW_CREDENTIALS`) y las vistas ignoran el JWT (ver §2). La venta se crea sin usuario, así que no hay correo, ni "mis compras", ni valoraciones.

## 2. Críticos (corregir antes de exponer el backend)

| # | Problema | Dónde |
|---|---|---|
| C1 | ✅ *Corregido 12-10-2026 (BYPASS solo con `DEBUG=True`).* **Token `BYPASS_<id>` marca cualquier venta como pagada sin pasar por Transbank.** | `views_webpay.confirmar_pago` |
| C2 | ✅ *Corregido 12-10-2026 (decoradores en `gestion/permisos.py`).* **Sin control de acceso** en crear/editar/eliminar productos, carga masiva, `eliminar-todos`, `productos/reemplazar`, `usuarios/reemplazar` y `ventas/registrar`. Cualquiera anónimo puede borrar el catálogo, **borrar todos los usuarios y recrear `admin_felipe/admin123` como superusuario**, o registrar ventas pagadas. | `views_productos`, `views_usuarios`, `views_ventas` |
| C3 | **JWT no se aplica** en vistas Django planas: el login entrega tokens que ninguna vista reconoce; no hay refresh endpoint. Con frontend en otro origen la sesión por cookie tampoco funciona. | `settings.py`, todas las vistas |
| C4 | 🟡 *`.gitignore` corregido 12-10-2026; revisión previa a subir el 12-10-2026: no hay secretos en archivos versionables; falta `SECRET_KEY` nueva, correo nuevo y repo limpio (sin historial con el `.env` viejo).* `.gitignore` solo ignora `node_modules/`: `.env` (SECRET_KEY y clave Gmail), `db.sqlite3`, `media/` y fixtures con correos y claves en texto plano pueden estar en GitHub. | `.gitignore` raíz |

Si el repo ya se subió, hay que **rotar la clave de aplicación de Gmail y la `SECRET_KEY`** aunque se borre el archivo después (queda en el historial).

## 3. Altos

- **Cliente cobrado y venta sin pagar:** si `confirmar_pago` lanza "Stock insuficiente" tras el `commit` de Transbank, la transacción se revierte y la venta queda `pendiente` con el dinero ya cobrado. `iniciar_pago` no valida stock.
- ✅ *Corregido 12-10-2026:* **`cantidad` sin validar** en `iniciar_pago`: un valor negativo reducía el total. Ahora exige entero ≥ 1 y valida stock al iniciar (el descuento de stock sigue ocurriendo solo al confirmar).
- **Cupones:** el porcentaje ya se limita a 0-100 al aplicarlo (12-10-2026); sigue sin límite de usos y nunca se "consume".
- **`confirmar_pago`:** si el usuario aborta en Webpay llega `TBK_TOKEN`, no `token_ws`, y responde 400 sin tocar la venta; una venta rechazada queda `pendiente` para siempre (el estado `rechazado` nunca se usa); un refresco repite `commit` y falla; `correo_enviado: True` se devuelve siempre aunque el envío falle.
- **2FA débil:** el código no expira (`creado_en` sin usar), `login-paso2` no limita intentos (6 dígitos fuerza-bruteables sin bloqueo), usa `random` en vez de `secrets`, y si falla el SMTP el error se traga (`except: pass`) y el usuario queda sin poder entrar.
- **Enumeración de usuarios** en `login-paso1` (distintos mensajes si el usuario no existe).
- **Borrar un usuario borra sus ventas** (`Venta.usuario` en `CASCADE`): se pierde historial financiero.
- **`productos/eliminar-todos` y `reemplazar`** fallan con 500 en cuanto existan ventas (`DetalleVenta.producto` es `PROTECT`) y `reemplazar` no restaura imágenes.
- **Descuento de stock sin bloqueo** en `confirmar_pago` (condición de carrera entre dos pagos simultáneos); el POS sí usa `select_for_update`.
- ✅ *Corregido 12-10-2026:* `iniciar_pago` devolvía `None` (500) si el método no era POST; ahora responde 405.

## 4. Medios

- `registrar_usuario`: no valida contraseña (validators), no comprueba `username` duplicado (IntegrityError → 500 con el mensaje interno), devuelve `str(e)` al cliente en muchas vistas (fuga de detalles).
- `confirmar_cambio_password` no aplica validadores; el correo de recuperación manda UID/TOKEN, no un enlace.
- `Venta.codigo_comprobante` y `HistorialEstadoVenta.usuario_responsable` nunca se llenan; `AuditLog` de eliminar producto siempre con `usuario=None`.
- Carrito del servidor desconectado del checkout; no se vacía tras pagar.
- Ventas `pendiente` abandonadas nunca expiran.
- `editar_producto` acepta cualquier valor sin validar tipos; no edita categoría, marca, código ni imágenes.
- `eliminar_usuario` protege "ID 1" por número fijo; `listar_usuarios` incluye staff.
- `SESSION_COOKIE_AGE` = 10 min vs JWT de 60 min (incoherente).
- `TIME_ZONE='UTC'`, `LANGUAGE_CODE='en-us'`.
- `print()` de depuración en el flujo de pago; `url_retorno` y credenciales de integración fijas en código (sin variables de entorno).
- `admin.py` no registra Egreso, AuditLog, Valoracion, Carrito, HistorialEstadoVenta ni PerfilSeguridad.

## 5. Calidad, pruebas y entorno

- **Cero tests** (`gestion/tests.py` vacío).
- ✅ *Creado 12-10-2026* `ecommerce_backend/requirements.txt` (sin versiones fijadas). El `readme.txt` sigue sin listar todas las dependencias.
- Sin paginación en listados (`productos/listar`, `ventas/historial`) y consultas N+1 al listar imágenes/valoraciones/detalles.
- Sin DEFAULT_PERMISSION_CLASSES ni capa de autorización reutilizable: cada vista repite `if not request.user.is_staff`.
- ✅ *Verificado 12-10-2026:* migraciones coinciden con los modelos y `manage.py check` no reporta problemas.

## 6. Lo que dice el readme y el código no cumple

| Afirmación del `readme.txt` | Realidad |
|---|---|
| "migré de cookies a JWT" | El JWT solo lo reconoce `api/prueba-token`. |
| "Integración real con Webpay" | Solo ambiente de integración, con atajo `BYPASS_`. |
| "Python 3.10+" | Los settings fueron generados con Django 6.0.1; esa versión exige Python más nuevo (**no verificado**, revisar). |
| "Carga de fixtures con `loaddata`" | `usuarios.json` no tiene formato de fixture Django; se usa vía endpoint. |
| "Diferencié roles" | Solo en dashboard/empleados; el catálogo y el POS están abiertos (C2). |

## 7. Orden de arreglo sugerido

1. Rotar secretos y `git rm --cached` de lo ya subido (C4). *(`.gitignore` hecho.)*
2. ~~Proteger endpoints destructivos y del POS (C2)~~ hecho. Pendiente opcional: limitar `reemplazar`/`eliminar-todos` a `DEBUG`.
3. ~~BYPASS condicionado a `DEBUG` (C1)~~ hecho.
4. Decidir autenticación única (JWT en todas las vistas con DRF, o sesión + CORS credentials) (C3).
5. Rehacer el flujo de pago: validar stock y cantidades al iniciar, reservar/descontar con bloqueo, manejar `TBK_TOKEN`/rechazo, redirigir al frontend, variables de entorno para URL y credenciales.
6. Endurecer 2FA (expiración, intentos, `secrets`).
7. `requirements.txt`, ajuste de zona horaria y recién ahí, si se pide, tests.
