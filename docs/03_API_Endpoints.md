# 03 — API: Endpoints y Control de Acceso Real

Rutas de `gestion/urls.py`, montadas en la raíz (sin prefijo), **sin barra final**. Casi todas son funciones Django planas con `@csrf_exempt`; la columna *Acceso* refleja lo que el **código realmente exige**, no lo que debería.

Leyenda: 🔴 sin verificación de usuario · 🟡 requiere sesión · 🟢 requiere staff/superuser.

> **Actualizado 12-10-2026:** los endpoints que estaban en 🔴 de productos (crear, editar, eliminar, carga masiva) y `ventas/registrar` ahora exigen **staff**; `productos/eliminar-todos`, `productos/reemplazar` y `usuarios/reemplazar` exigen **superuser** (decoradores de `gestion/permisos.py`). Las tablas de abajo conservan 🔴 como estado previo; ver [[06_Estado_del_Backend_y_Pendientes]].

## Productos
| Ruta | Método | Acceso |
|---|---|---|
| `productos/listar` (filtros `q`, `categoria`, `precio_min`, `precio_max`) | GET | público |
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
Todas públicas: `auth/login-paso1`, `auth/login-paso2`, `auth/logout`, `auth/registro`, `auth/recuperar-solicitar`, `auth/recuperar-confirmar`. Detalle en [[04_Autenticacion_y_Seguridad]].
`api/prueba-token` (GET) exige JWT (DRF `IsAuthenticated`).

## Ventas y carrito
| Ruta | Método | Acceso |
|---|---|---|
| `ventas/registrar` (POS, crea venta `pagado` y descuenta stock) | POST | 🔴 |
| `ventas/historial` | GET | 🟢 staff |
| `ventas/mis-compras` | GET | 🟡 |
| `ventas/cancelar/<id>` (solo dueño y solo `pendiente`) | POST | 🟡 |
| `ventas/bitacora/<id>` | GET | 🟢 staff |
| `carrito/agregar` / `ver` / `vaciar` / `eliminar/<item_id>` | POST/GET/DELETE | 🟡 |

## Pago
| Ruta | Método | Acceso |
|---|---|---|
| `webpay/iniciar` | POST | público (usuario opcional) |
| `webpay/confirmar` | GET/POST | público |

Flujo en [[05_Ventas_Carrito_y_Webpay]].

## Finanzas
`dashboard/metricas`, `dashboard/reporte-pdf`, `finanzas/egresos/crear`, `finanzas/egresos/listar`: 🟢 staff.

## Nota sobre autenticación
Las vistas Django planas **solo reconocen sesión por cookie** (`request.user` lo llena el middleware de sesión). El header `Authorization: Bearer` solo funciona en `api/prueba-token`. Ver [[04_Autenticacion_y_Seguridad]] §3.
