# 03 — API: Endpoints y Control de Acceso Real

Rutas de `gestion/urls.py`, montadas en la raíz (sin prefijo), **sin barra final**. Casi todas son funciones Django planas con `@csrf_exempt`; la columna *Acceso* refleja lo que el **código realmente exige**, no lo que debería.

Leyenda: 🔴 sin verificación de usuario · 🟡 requiere sesión · 🟢 requiere staff/superuser.

> **Actualizado 12-10-2026:** los endpoints que estaban en 🔴 de productos (crear, editar, eliminar, carga masiva) y `ventas/registrar` ahora exigen **staff**; `productos/eliminar-todos`, `productos/reemplazar` y `usuarios/reemplazar` exigen **superuser** (decoradores de `gestion/permisos.py`). Las tablas de abajo conservan 🔴 como estado previo; ver [[06_Estado_del_Backend_y_Pendientes]].

## Productos
| Ruta | Método | Acceso |
|---|---|---|
| `productos/listar` (devuelve también `categoria_id`, `descripcion` y `disponible` = stock menos lo apartado por otros clientes; filtros `q`, `categoria`, `precio_min`, `precio_max`; `q` ignora tildes y mayúsculas y exige todas las palabras en nombre, descripción o marca, desde 13-10-2026) | GET | público |
| `productos/relacionados/<id>` | GET | público |
| `productos/crear` (multipart, imágenes png/jpg) | POST | 🔴 |
| `productos/editar/<id>` | PUT | 🔴 |
| `productos/eliminar/<id>` | DELETE | 🔴 |
| `productos/carga-masiva` | POST | 🔴 |
| `productos/eliminar-todos` | DELETE | 🔴 |
| `productos/reemplazar` (borra todo y recarga `productos.json`) | POST | 🔴 |
| `productos/valorar/<id>` | POST | 🟡 (solo si compró, estado `pagado`) |

## Usuarios y empleados
| Ruta | Método | Acceso |
|---|---|---|
| `usuarios/reemplazar` (**borra todos los usuarios** y recarga `usuarios.json`) | POST | 🔴 |
| `usuarios/listar` | GET | 🟢 staff |
| `usuarios/eliminar/<id>` (protege id 1) | DELETE | 🟢 staff |
| `empleados/crear` / `listar` / `editar/<id>` | POST / GET / PUT | 🟢 superuser |

## Autenticación
Todas públicas: `auth/login-paso1`, `auth/login-paso2`, `auth/logout`, `auth/registro`, `auth/recuperar-solicitar`, `auth/recuperar-confirmar` y `auth/captcha-estado` (GET `?accion=login|registro|recuperar`: indica si el frontend debe mostrar el captcha y entrega la clave pública). Registro, recuperación y login (tras 3 fallos) exigen el campo `captcha` en el body. Detalle en [[04_Autenticacion_y_Seguridad]].
`api/prueba-token` (GET) exige JWT (DRF `IsAuthenticated`).

## Ventas y carrito
| Ruta | Método | Acceso |
|---|---|---|
| `ventas/registrar` (POS, crea venta `pagado` y descuenta stock) | POST | 🔴 |
| `ventas/historial` | GET | 🟢 staff |
| `ventas/mis-compras` (cada venta incluye también `envio`, `descuento`, `cupon`, `region`, `direccion` e `historial` —lista de estados con fecha—, desde 13-10-2026; lo mismo en `ventas/historial`) | GET | 🟡 |
| `ventas/cancelar/<id>` (solo dueño y solo `pendiente`) | POST | 🟡 |
| `ventas/bitacora/<id>` | GET | 🟢 staff |
| `carrito/agregar` / `ver` / `vaciar` / `eliminar/<item_id>` (cada item de `ver` incluye `stock` y `disponible`; `agregar` valida contra `disponible`, ver [[05_Ventas_Carrito_y_Webpay]]) | POST/GET/DELETE | 🟡 |
| `carrito/restar/<item_id>` (resta 1 unidad de forma atómica y nunca baja de 1: con 1 sola responde 400 y hay que usar `eliminar`; agregada el 13-10-2026) | POST | 🟡 |

## Pago
| Ruta | Método | Acceso |
|---|---|---|
| `cuenta/perfil` (GET: datos de la cuenta y de entrega con `completo`; POST: guarda nombre, apellido, región y dirección, todo opcional; solo el teléfono se valida si viene; 13-10-2026) | GET/POST | 🟡 sesión |
| `cuenta/cambiar-clave` (exige la clave actual, valida la nueva con los validadores de Django y mantiene la sesión; límite de 10 fallos cada 10 min por IP) | POST | 🟡 sesión |
| `cupones/validar` (calcula el descuento de un cupón sobre el carrito del usuario sin usarlo; 400 con el motivo si no sirve; agregada el 13-10-2026) | POST | 🟡 sesión |
| `webpay/iniciar` (el body exige `direccion` con nombre, teléfono, calle, número y comuna; `complemento` e `indicaciones` son opcionales; responde 400 si falta algo o si otros clientes están pagando las unidades, ver [[05_Ventas_Carrito_y_Webpay]]) | POST | público (usuario opcional) |
| `webpay/confirmar` | GET/POST | público |

Flujo en [[05_Ventas_Carrito_y_Webpay]].

## Finanzas
`dashboard/metricas`, `dashboard/reporte-pdf`, `finanzas/egresos/crear`, `finanzas/egresos/listar`: 🟢 staff.

## Nota sobre autenticación
Las vistas Django planas **solo reconocen sesión por cookie** (`request.user` lo llena el middleware de sesión). El header `Authorization: Bearer` solo funciona en `api/prueba-token`. Ver [[04_Autenticacion_y_Seguridad]] §3.

## Panel de administración (13-10-2026)

Todas bajo sesión; detalle de seguridad en [[04_Autenticacion_y_Seguridad]].

| Ruta | Método | Acceso |
|---|---|---|
| `panel/acceso` (body `{ruta}`; `ok` solo si la dirección es la del panel y la sesión es staff, si no 404) | POST | público, 20 fallos/10 min por IP |
| `panel/estado` (`staff`, `superusuario` y `ruta` solo para staff) | GET | público |
| `panel/categorias` (con el número de productos de cada una) | GET | staff |
| `panel/categorias/guardar` (con `id` renombra; nombre único de 2 a 50 caracteres) | POST | staff |
| `panel/categorias/<id>` (solo si no tiene productos) | DELETE | superusuario |
| `panel/productos` (todos los productos con `imagenes` como `{id, url}`) | GET | staff |
| `panel/productos/<id>/imagenes` (multipart `imagenes`; PNG/JPG hasta 5 MB) | POST | staff |
| `panel/imagenes/<id>` | DELETE | staff |
| `panel/cupones` (con usos pagados) y `panel/cupones/guardar` (con `id` edita; valida código, 1-100 %, fecha y límites) | GET / POST | superusuario |
| `panel/auditoria` (últimas 200 acciones) | GET | superusuario |

Cambios en rutas existentes: `productos/crear` valida números no negativos, categoría y código único y acepta `descripcion`; `productos/editar/<id>` acepta además `codigo`, `marca`, `descripcion` y `categoria_id` con validación; `productos/eliminar/<id>` responde un 400 claro si el producto tiene ventas; `ventas/registrar` (POS) devuelve el motivo real ("Stock insuficiente para ...") y queda auditado; `dashboard/metricas` agrega `ventas_por_dia` (14 días), `stock_bajo` y `pendientes`; `usuarios/eliminar/<id>` ahora exige superusuario y no borra cuentas del equipo; `empleados/crear` valida la contraseña y `empleados/editar/<id>` solo acepta empleados y valida `is_active`.
