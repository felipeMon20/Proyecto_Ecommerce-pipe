# 07 — Frontend y Guía de Pruebas

Frontend en `pixelappstore/` (React 19 + Vite 7 + React Router 7 + axios). Construido el 12-10-2026 sobre el esqueleto anterior, con el diseño del boceto original (franja morada, barra oscura con buscador, franja amarilla de despacho). Backend relacionado: [[03_API_Endpoints]], [[04_Autenticacion_y_Seguridad]], [[05_Ventas_Carrito_y_Webpay]].

> **Certeza:** `eslint` y `vite build` pasan, y el flujo se recorrió con `curl` a través del proxy contra Django y el **ambiente de integración real de Transbank** (creación de la transacción). **No se vio en un navegador**: el aspecto visual y el formulario real de Webpay están sin probar.

## 1. Decisión de arquitectura: proxy de Vite + sesión por cookie

El navegador solo habla con `localhost:5173`. Vite reenvía `/api/*` a `http://127.0.0.1:8000` (quitando el prefijo `/api`) y `/media/*` tal cual (`vite.config.js`). Así la cookie de sesión de Django funciona sin CORS ni `CORS_ALLOW_CREDENTIALS`, y no hubo que tocar la autenticación del backend. El `access_token` JWT que devuelve el login **no se usa** en el frontend (ver [[04_Autenticacion_y_Seguridad]] §3).

**Debes abrir `http://localhost:5173`, no `127.0.0.1:5173`.** Webpay devuelve al usuario a `FRONTEND_URL` (`localhost`); con otro host la cookie de sesión no viaja y quedarías deslogueado.

La sesión del backend dura 10 minutos de inactividad. Al recibir un 401, `api.js` emite `sesion-expirada` y el frontend olvida al usuario.

## 2. Pantallas

| Ruta | Archivo | Qué hace |
|---|---|---|
| `/` | `HomePage` | Catálogo. Filtros por URL: `?q=texto`, `?categoria=<id>`. |
| `/producto/:id` | `ProductPage` | Galería, descripción, stock, cantidad, "Agregar" y "Comprar ahora", relacionados. |
| `/registro` | `RegisterPage` | Crea cuenta (valida contraseña en el backend). |
| `/login` | `LoginPage` | Paso 1 usuario/clave, paso 2 código por correo. |
| `/carrito` 🔒 | `CartPage` | Lista, +1, quitar, vaciar. |
| `/checkout` 🔒 | `CheckoutPage` | Región, cupón, resumen; crea el pago y redirige a Webpay con un POST oculto (`token_ws`). |
| `/pago/resultado` | `PagoResultadoPage` | Mensaje según `?estado=exito|rechazado|cancelado|error&venta=<id>`. |
| `/mis-compras` 🔒 | `MisComprasPage` | Historial; permite cancelar pedidos `pendiente`. |

🔒 = exige sesión (`RequireAuth` redirige a `/login` y vuelve después). Componentes comunes en `src/components/` (`Header`, `ProductCard`, `RequireAuth`); estado global en `src/contexto/` (usuario y contador del carrito); llamadas en `src/api.js`.

**Logo:** el `Header` carga `public/logo.png`; si no existe muestra el texto "pixelappstore". Para usar tu logo, copia la imagen en `pixelappstore/public/logo.png`.

**No existen en el frontend** (el backend sí): panel de administración (productos, empleados, dashboard, egresos), POS, valoraciones y recuperación de contraseña. Para cargar productos usa `/admin` de Django.

## 3. Pasos para probar

### 3.1 Preparación (una vez)
1. `.env` del backend con el Gmail nuevo (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`). Sin eso el login responde "No se pudo enviar el código".
2. Si la base no tiene un administrador: desde `ecommerce_backend\SistemaVentas` con el venv activo, `python manage.py createsuperuser`.
3. Frontend: en `pixelappstore`, `npm install` (si no existe `node_modules`). **Para no llenar C:** antes, en esa misma ventana de CMD, `set npm_config_cache=D:\npm-cache` y `set TEMP=D:\tmp` (crea esas carpetas).

### 3.2 Levantar todo (dos ventanas de CMD)
```
:: Ventana 1: backend
cd /d "D:\proyectos programacion\Proyecto_Ecommerce_Completo\ecommerce_backend"
.venv\Scripts\activate
cd SistemaVentas
python manage.py runserver

:: Ventana 2: frontend
cd /d "D:\proyectos programacion\Proyecto_Ecommerce_Completo\pixelappstore"
npm run dev
```
Abre **http://localhost:5173**.

### 3.3 Datos de prueba
En `http://127.0.0.1:8000/admin` (superusuario): crea una **Categoría**, un **Producto** con precio y `stock` ≥ 3, y opcionalmente una **Imagen producto**. Crea un **Cupón** (código, % entre 1 y 100, fecha futura, activo) para probar descuentos. Puede que la base ya traiga productos: míralos antes.

### 3.4 Lista de verificación

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abrir `/` | Ves el catálogo y las categorías en el menú "Categorías". |
| 2 | Buscar un texto / elegir categoría | La lista se filtra. |
| 3 | Pulsar "Agregar al carrito" sin sesión | Te lleva a `/login`. |
| 4 | Registrarte (correo real, clave de 8+ no común) | Vuelves a `/login` con "Cuenta creada". |
| 5 | Login: usuario/clave → código del correo | Entras; el menú dice "Hola, <usuario>". |
| 6 | Agregar un producto | Aparece el contador en "Carrito". |
| 7 | `/carrito`: +1 y Quitar | Cantidades y total cambian. |
| 8 | `/checkout`: región "RM" y luego otra | El envío cambia entre $3.000 y $6.000. |
| 9 | **Pagar con Webpay → pago aprobado** | Cambia a la página de Webpay; tras pagar vuelves a `/pago/resultado?estado=exito`. |
| 10 | Revisar | Stock del producto bajó; `/mis-compras` muestra el pedido **pagado**; carrito vacío; llegó el correo de compra. |
| 11 | Recargar `/pago/resultado` o repetir la URL de retorno | No se cobra ni se descuenta stock otra vez. |
| 12 | Pagar con la tarjeta de **rechazo** | `estado=rechazado`; pedido `rechazado`; stock intacto. |
| 13 | En Webpay, anular y volver al comercio | `estado=cancelado`; pedido `anulado`; el carrito sigue lleno. |
| 14 | Con un producto en el carrito, bajar su stock a 0 en `/admin` y pagar | `/checkout` muestra "Stock insuficiente"; no se cobra. |
| 15 | Cupón válido en el checkout | El pedido en `/mis-compras` muestra el total con descuento. |
| 16 | Cupón inexistente | Error "Cupón inválido" y no se crea pedido. |
| 17 | Esperar 10+ minutos y abrir `/carrito` | Te devuelve a `/login`. |
| 18 | `/mis-compras` con un pedido `pendiente` → "Cancelar pedido" | Pasa a `anulado`. |

### 3.5 Datos del ambiente de pruebas de Transbank
Según la documentación pública de Transbank (confírmalas en transbankdevelopers.cl si algo no funciona): tarjeta **VISA 4051 8856 0044 6623**, CVV **123**, cualquier fecha futura; si pide autenticación, RUT **11.111.111-1** y clave **123**. Para forzar un rechazo se usa la tarjeta **MASTERCARD 5186 0595 5959 0568**. En este ambiente no se cobra dinero real.

### 3.6 Si algo falla

| Síntoma | Causa probable |
|---|---|
| "No hay conexión con el servidor" | El backend (ventana 1) no está corriendo. |
| "No se pudo enviar el código" | Credenciales de Gmail del `.env` incorrectas; mira la consola del backend. |
| Tras pagar apareces deslogueado | Abriste `127.0.0.1:5173` en vez de `localhost:5173`. |
| Webpay no abre / error 502 al pagar | Sin internet o Transbank caído; el error queda en la consola del backend. |
| `estado=error` al volver de Webpay | El `WEBPAY_RETURN_URL` no apunta al backend, o recargaste con un token ya usado. |
| Imágenes no se ven | Producto sin imagen cargada, o backend con `DEBUG=False` (solo sirve `/media` en `DEBUG=True`). |
| Cambié `vite.config.js` y no hace efecto | Reinicia `npm run dev`. |

## 4. Cambios hechos en el backend para el frontend (12-10-2026)

- `productos/listar` ahora incluye `categoria_id` y `descripcion`.
- `auth/registro` rechaza usuarios duplicados y aplica los validadores de contraseña de Django (antes: error 500 y claves como "123").
- Cuerpos JSON mal codificados responden 400 en `auth/*` y `webpay/iniciar` (antes: 500).
