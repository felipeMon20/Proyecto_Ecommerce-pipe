# 04 — Autenticación y Seguridad

Archivo principal: `gestion/views/views_usuarios.py`. Hallazgos priorizados en [[06_Estado_del_Backend_y_Pendientes]].

## 1. Login en dos pasos

> **Reescrito 12-10-2026** (ver [[06_Estado_del_Backend_y_Pendientes]] §3). Verificado con 16 pruebas manuales en base en memoria y correo simulado; no hay tests en el repo.

1. `auth/login-paso1`: valida usuario/clave. Si es correcto, genera un código de 6 dígitos con `secrets`, reemplaza cualquier código previo del usuario en `Codigo2FA` y lo envía por correo. Si el envío falla responde **503** y borra el código (antes el error se tragaba). Un usuario sin correo recibe 400.
2. `auth/login-paso2`: rechaza si la cuenta está bloqueada, si el código venció (**10 minutos**, `creado_en`) o no coincide (`secrets.compare_digest`). Si es correcto borra el código (un solo uso), hace `login()` (cookie de sesión) y devuelve `access_token` y `refresh_token` JWT más `es_admin` / `es_superuser`.

Usuario inexistente y clave incorrecta devuelven el mismo mensaje (401), y un código incorrecto/vencido/inexistente devuelve el mismo 400, para no revelar qué cuentas existen.

## 2. Bloqueo por intentos

`PerfilSeguridad`: 3 fallos → bloqueo de 5 minutos y el contador vuelve a 0. Cuenta **tanto claves incorrectas (paso 1) como códigos incorrectos (paso 2)** y al bloquear en el paso 2 se invalida el código. Constantes en `views_usuarios.py`: `MAX_INTENTOS`, `MINUTOS_BLOQUEO`, `MINUTOS_VIGENCIA_CODIGO`.

## 3. JWT vs sesión (punto crítico)

`REST_FRAMEWORK` configura `JWTAuthentication`, pero **solo las vistas decoradas con `@api_view` lo usan**; hoy es únicamente `prueba_token_jwt`. Todas las demás son vistas Django planas que leen `request.user` del middleware de sesión. Consecuencias confirmadas por el código:

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
