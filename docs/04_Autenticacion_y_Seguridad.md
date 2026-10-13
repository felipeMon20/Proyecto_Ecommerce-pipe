# 04 — Autenticación y Seguridad

Archivo principal: `gestion/views/views_usuarios.py`. Hallazgos priorizados en [[06_Estado_del_Backend_y_Pendientes]].

## 1. Login en dos pasos

> **Reescrito 12-10-2026** (ver [[06_Estado_del_Backend_y_Pendientes]] §3). Verificado con 16 pruebas manuales en base en memoria y correo simulado; no hay tests en el repo.

1. `auth/login-paso1`: valida usuario/clave. Si es correcto, genera un código de 6 dígitos con `secrets`, reemplaza cualquier código previo del usuario en `Codigo2FA` y lo envía por correo. Si el envío falla responde **503** y borra el código (antes el error se tragaba). Un usuario sin correo recibe 400.
2. `auth/login-paso2`: rechaza si la cuenta está bloqueada, si el código venció (**10 minutos**, `creado_en`) o no coincide (`secrets.compare_digest`). Si es correcto borra el código (un solo uso), hace `login()` (cookie de sesión) y devuelve `es_admin` / `es_superuser`. Los JWT (`access_token`, `refresh_token`) solo se incluyen si el body trae `"jwt": true` (desde 13-10-2026); el sitio web no los pide.

Usuario inexistente y clave incorrecta devuelven el mismo mensaje (401), y un código incorrecto/vencido/inexistente devuelve el mismo 400, para no revelar qué cuentas existen.

`auth/registro` (12-10-2026): rechaza correo o usuario duplicado y aplica los validadores de contraseña de Django (mínimo 8, no común, no solo numérica).

## 2. Bloqueo por intentos

`PerfilSeguridad`: 3 fallos → bloqueo de 5 minutos y el contador vuelve a 0. Cuenta **tanto claves incorrectas (paso 1) como códigos incorrectos (paso 2)** y al bloquear en el paso 2 se invalida el código. Constantes en `views_usuarios.py`: `MAX_INTENTOS`, `MINUTOS_BLOQUEO`, `MINUTOS_VIGENCIA_CODIGO`. Desde 13-10-2026 el bloqueo es **progresivo** (5, 10, 20... hasta 60 minutos si se repite dentro de un día; el contador está en la caché) y **no revela si la cuenta existe**: usuario inexistente, clave incorrecta y cuenta bloqueada devuelven la misma respuesta (401, mismo texto) y tardan parecido (se compara contra un hash señuelo). En el paso 2 pasa igual (400 genérico). Lo que sí sigue revelando es `auth/registro` ("correo ya registrado", "usuario ya existe").

## 3. JWT vs sesión (punto crítico)

`REST_FRAMEWORK` configura `JWTAuthentication`, pero **solo las vistas decoradas con `@api_view` lo usan**; hoy es únicamente `prueba_token_jwt`. Todas las demás son vistas Django planas que leen `request.user` del middleware de sesión. Consecuencias confirmadas por el código:

- **El frontend evita este problema** usando sesión por cookie a través del proxy de Vite (ver [[07_Frontend_y_Guia_de_Pruebas]] §1); el JWT sigue sin usarse.
- Un cliente que mande solo `Authorization: Bearer <token>` es tratado como **anónimo** en carrito, ventas, dashboard, etc.
- Con el frontend en otro origen (`localhost:5173`), la sesión por cookie necesita `CORS_ALLOW_CREDENTIALS = True` y `fetch(..., {credentials:'include'})`; el primero no está en `settings.py`.
- No hay endpoint de refresh (`TokenRefreshView`), así que el `refresh_token` entregado no sirve.
- `BLACKLIST_AFTER_ROTATION=True` sin la app `token_blacklist` instalada no tiene efecto.

## 4. Recuperación de contraseña

`recuperar-solicitar` envía por correo el `UID` y el `TOKEN` en texto (no hay enlace). Responde igual exista o no el correo (bien). `recuperar-confirmar` valida el token de Django y fija la clave **sin pasar por los validadores de contraseña**.

## 5. Roles

- Cliente: `User` normal. Staff = vendedor (POS). Superuser = administrador.
- Solo superuser crea/lista/edita empleados. `crear_empleado` y `eliminar_usuario` registran/protegen parcialmente (id 1 protegido por número fijo).

## 6. Auditoría

`AuditLog` se escribe en: crear empleado, registrar gasto, descargar PDF y eliminar producto (esta última siempre con `usuario=None`). No se audita: pagos, eliminación de usuarios, cambios de precio/stock, ni los endpoints destructivos.

## Sesión, cookies y respuestas de error (13-10-2026)

- **Sesión por cookie:** dura 10 minutos sin actividad (`SESSION_COOKIE_AGE`, renovada en cada petición). Si el usuario borra las cookies o la sesión vence, el backend responde 401 y el frontend (interceptor de `api.js`) olvida al usuario; lo comprueba al cargar, al volver a la pestaña y cada 30 s.
- **Consultas automáticas no renuevan la sesión:** el frontend marca sus refrescos periódicos con la cabecera `X-Actividad-Pasiva: 1` y `gestion/middleware.py` (`SesionMiddleware`, en lugar del de Django) no renueva la cookie en esas peticiones. Así dejar una pestaña abierta no mantiene la sesión viva.
- **Almacenamiento del navegador:** `localStorage` guarda solo el nombre de usuario (ya no los indicadores de administrador) y la dirección del checkout, que se borra al cerrar sesión o al expirar.
- **Errores internos:** las vistas ya no devuelven el texto de la excepción (`gestion/errores.py`, `error_interno`): responden un mensaje genérico y el detalle queda en el log del servidor.
- **Límite por IP (`gestion/limites.py`, decorador `limitar` aplicado en `urls.py`):** responde 429 con `Retry-After` al superarse. Es adicional al bloqueo por cuenta de §2.

  | Ruta | Qué cuenta | Tope |
  |---|---|---|
  | `auth/login-paso1` | intentos fallidos | 10 cada 10 min por IP |
  | `auth/login-paso2` | códigos incorrectos | 10 cada 10 min por IP |
  | `auth/registro` | todas las peticiones | 5 por hora por IP |
  | `auth/recuperar-solicitar` | todas | 5 por hora por IP y 3 por hora por correo |
  | `auth/recuperar-confirmar` | fallos | 10 cada 10 min por IP |
  | `cupones/validar` | fallos | 15 cada 10 min por IP |
  | `webpay/iniciar` | todas | 10 cada 10 min por IP (evita apartar todo el stock con pagos falsos) |

  Los contadores usan una caché en archivos (`cache_django/`, ignorada por git), compartida entre procesos del mismo servidor; con varios servidores hay que cambiarla por Redis o Memcached (`CACHES` en `settings.py`). Con `DEBUG=True` se lee la IP real de `X-Forwarded-For` (el proxy de Vite la agrega con `xfwd`); en producción detrás de un proxy hay que fijar `IP_CLIENTE_HEADER`, o todos los clientes parecerán una sola IP. Limitación: quien rota de IP evita el límite por IP; lo frena el bloqueo progresivo por cuenta, pero no hay CAPTCHA.
- **Endurecimiento con `DEBUG=False`** (`settings.py`): cookies de sesión y CSRF `Secure`, `nosniff`, `X_FRAME_OPTIONS=DENY` y `Referrer-Policy` same-origin; con `FORZAR_HTTPS=True` también redirección a HTTPS y HSTS. Con `DEBUG=True` (desarrollo) nada de esto aplica.

## Captcha y registro sin filtrar datos (13-10-2026)

- **Captcha (Cloudflare Turnstile):** `gestion/captcha.py`. El decorador `exigir_captcha` pide el token (campo `captcha` del body) y lo valida contra Cloudflare. Se exige **siempre** en `auth/registro` y `auth/recuperar-solicitar`, y en `auth/login-paso1` solo desde el 3.er intento fallido de la IP (el 400 trae `captcha_requerido: true`). Sin token: 400; Cloudflare lo rechaza: 400; no se puede consultar: 503. `GET auth/captcha-estado?accion=login|registro|recuperar` dice al frontend si debe mostrar la casilla y entrega la clave pública.
- **Claves:** variables `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET`. Con `DEBUG=True` y sin variables se usan las claves de prueba de Cloudflare (siempre aprueban y la casilla muestra un aviso de prueba). Con `DEBUG=False` y sin `TURNSTILE_SECRET` el captcha queda **desactivado**: hay que crear las claves reales en el panel de Cloudflare.
- **Registro:** un correo que ya existe recibe exactamente la misma respuesta que uno nuevo (no se crea cuenta y se avisa por correo al dueño, en segundo plano para que no cambie el tiempo de respuesta). Además se limita a 3 intentos por hora por correo. El nombre de usuario ocupado **sí** se informa (hace falta para poder elegir otro). La respuesta ya no incluye el `id` del usuario.
- **Recuperación:** el correo se envía en segundo plano, así que existir o no el correo no cambia el tiempo de respuesta.

## Recuperación de contraseña y cambio de clave (13-10-2026)

- **Correo con enlace:** `auth/recuperar-solicitar` envía un enlace `{FRONTEND_URL}/recuperar/confirmar?uid=...&token=...` que vale 1 hora (`PASSWORD_RESET_TIMEOUT`); antes enviaba solo el UID y el token en texto. El token sirve una sola vez (al cambiar la clave deja de ser válido).
- **`auth/recuperar-confirmar`:** ahora valida la clave nueva con los validadores de Django (antes aceptaba cualquiera) y responde 400 "El enlace no es válido o ya venció" si el token falla.
- **Cambiar clave desde la cuenta:** `cuenta/cambiar-clave` pide la clave actual; al cambiarla, la sesión actual sigue activa y las demás se invalidan.

## Mensajes en español e indicaciones de contraseña (13-10-2026)

- `LANGUAGE_CODE` pasó a `es`: los errores de los validadores de contraseña (muy corta, muy común, solo números, parecida al usuario) llegan en español; también queda en español el panel de Django (si se activa). La zona horaria sigue en UTC.
- El frontend repite esas reglas mientras se escribe (`src/reglasClave.js`): 8 caracteres, no solo números, no una clave muy común (lista corta de muestra), no parecida al usuario o correo, distinta de la actual (solo en Cuenta) y coincidencia de las dos. Se muestran en registro, recuperación y Cuenta; el servidor sigue siendo la validación definitiva (su lista de claves comunes es mucho mayor).
- **Complejidad obligatoria (13-10-2026):** `gestion/validadores.py` (`ComplejidadPasswordValidator`, en `AUTH_PASSWORD_VALIDATORS`) exige al menos una mayúscula A-Z (sin tildes ni Ñ) y un símbolo de `!#$%&*+?@_.,^~`, y rechaza cualquier carácter fuera de letras ASCII, números y esos símbolos (comillas, `/`, `\`, paréntesis, `=`, `-`, espacios, tildes y ñ). Aplica a registro, recuperación, cambio de clave y al panel `/admin`; las claves ya existentes no se tocan. El frontend lo repite en `reglasClave.js` (indicando qué caracteres sobran); si se cambia la lista de símbolos hay que cambiarla en los dos archivos.

## Protección contra recargas seguidas y picos de visitas (13-10-2026)

- **Middleware `LimiteGeneralMiddleware`** (`gestion/middleware.py`, primero de la cadena): cuenta las peticiones a la API por IP y en total, en una caché en memoria (`CACHES['rapida']`). Responde 429 con `saturacion: true`, `motivo` (`ip` o `global`), `espera` y `Retry-After`.
  - **Ráfaga por IP:** más de 60 peticiones en 10 s (unas 6 recargas muy seguidas) bloquea la IP 20 s.
  - **Sostenido por IP:** más de 300 en un minuto bloquea la IP 60 s.
  - **Global:** más de 800 entre todos en 10 s pone en espera 8 s a quien llegue (sin bloquear su IP).
  - **Exentos:** `/media/`, `/static/`, `/webpay/confirmar` (un pago en curso no se corta) y las peticiones `OPTIONS`. Se apaga con `LIMITES_ACTIVOS=False`.
- **Frontend:** el interceptor de `api.js` convierte ese 429 en el evento `saturacion` y `components/Saturacion.jsx` muestra una pantalla completa con cuenta regresiva, una fila de personajes esperando frente a la tienda y un botón que se habilita al terminar. Los textos cambian según el motivo.
- **Limitaciones:** solo protege las llamadas a la API; la página estática (HTML/JS) la sirve el servidor web o Vite, y ahí hace falta el límite del propio servidor (nginx, CDN). La caché en memoria es por proceso: con varios procesos cada uno cuenta aparte. Los topes son orientativos y se ajustan con `SATURACION_RAFAGA`, `SATURACION_SOSTENIDO` y `SATURACION_GLOBAL`.

## Panel de administración: acceso oculto y protegido (13-10-2026)

La seguridad real está en el servidor; ocultar la dirección es solo una capa extra para que no sea evidente.

- **Dirección secreta:** el panel vive en `/<PANEL_RUTA>/...` en el frontend. `PANEL_RUTA` sale de la variable de entorno del mismo nombre o, si no existe, se deriva de la `SECRET_KEY` (`p-` más 20 caracteres, estable y no adivinable). Se consulta con `python manage.py ruta_panel`. **La dirección no está escrita en el código del frontend**: `pages/RutaDesconocida.jsx` pregunta a `POST panel/acceso` cada dirección desconocida (solo si hay sesión) y el servidor únicamente confirma si la dirección coincide (comparación en tiempo constante) **y** la sesión es de staff. Para cualquier otro caso responde 404 y el público ve la página 404 normal; no existe un mensaje de "acceso denegado" que delate que hay un panel.
- **Código aparte:** el panel es un paquete separado (`React.lazy`, `src/admin`): solo se descarga después de esa confirmación. Se comprobó que la dirección no aparece en el JavaScript público.
- **Enlace solo para staff:** `GET panel/estado` entrega la dirección únicamente a quien tiene sesión de staff; el menú de usuario muestra "Panel de administración" solo a ellos.
- **Intentos:** `panel/acceso` limita 20 fallos cada 10 min por IP, y todo el panel hereda el límite general de peticiones, el 2FA por correo del login y la expiración de sesión a los 10 min.
- **Permisos por endpoint** (el servidor decide, aunque alguien conozca la dirección): staff para productos, ventas, POS, finanzas y dashboard; **solo superusuario** para cupones, empleados, eliminar clientes y la bitácora de actividad.
- **Panel de Django apagado:** `/admin/` ya no existe porque su login no pasa por el 2FA. Se reactiva con `DJANGO_ADMIN_ACTIVO=True` y queda en `/<PANEL_RUTA>-django/`. Los cupones ahora se administran desde el panel nuevo.
- **Bitácora:** crear, editar y eliminar productos, imágenes, ventas de mostrador, cupones, gastos, empleados, eliminación de clientes y reportes PDF quedan en `AuditLog`, visibles en Actividad.
- **Sobre el cifrado:** el cifrado del tráfico lo da HTTPS (ver `FORZAR_HTTPS`); las contraseñas ya se guardan con hash. No tiene sentido cifrar la dirección del panel en el cliente: cualquier secreto enviado al navegador lo puede leer quien lo reciba, por eso se valida en el servidor.
