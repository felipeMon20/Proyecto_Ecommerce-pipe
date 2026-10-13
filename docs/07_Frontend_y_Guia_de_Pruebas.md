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
| `/` | `PortadaPage` | Portada (13-10-2026): hero, categorías en círculos con ícono pixel, destacados y estantes por categoría (ver §2.2). |
| `/catalogo` | `HomePage` | Catálogo con panel de filtros a la izquierda y paginación de 20 en 20 (ver §2.1). |
| `/producto/:id` | `ProductPage` | Ficha rediseñada el 13-10-2026: migas de pan, galería con miniaturas y fondo degradado, marca, valoraciones, precio destacado con "Incluye IVA", indicador de stock (aviso ámbar con 5 unidades o menos), selector de cantidad con -/+ y subtotal, "Agregar al carrito" (animación verde "Agregado") y "Comprar ahora", bloque de sin stock, beneficios (despacho, pago Webpay, IVA) y hasta 4 productos de la misma categoría ordenados por valoración con "Ver más" al catálogo. La disponibilidad se refresca sola cada 20 s (ver [[05_Ventas_Carrito_y_Webpay]]) y la cantidad se ajusta si baja. Los relacionados salen de `productos/listar` (no usa `productos/relacionados`, que sigue disponible en la API). |
| `/registro` | `RegisterPage` | Crea cuenta (valida contraseña en el backend). Rediseñada el 13-10-2026: panel izquierdo con la tienda en pixel art, el logo flotando y el fondo de cuadrícula del carrito vacío, y formulario a la derecha (en móvil el panel pasa arriba). |
| `/login` | `LoginPage` | Paso 1 usuario/clave, paso 2 código por correo. Desde el 13-10-2026 comparte pantalla con `/registro` mediante `AuthLayout` (ruta con `Outlet`): la tienda en pixel art y el logo flotando quedan fijos, el panel se desliza al otro lado y el formulario sale y entra con animación al cambiar. Las URL no cambian. |
| `/carrito` 🔒 | `CartPage` | Tarjetas por producto con +1, quitar y vaciar, resumen con subtotal animado; con el carrito vacío muestra una escena en pixel art (ver §2.2). |
| `/checkout` 🔒 | `CheckoutPage` | Pasos (Carrito, Entrega y pago, Confirmación), región con menú propio y costo de despacho, formulario de dirección de entrega (obligatorio; se recuerda en el navegador), cupón con botón "Aplicar" que muestra el descuento y el nuevo total antes de pagar, pedido con fotos y resumen con total e IVA incluido; crea el pago y redirige a Webpay con un POST oculto (`token_ws`). |
| `/pago/resultado` | `PagoResultadoPage` | Rediseñada el 13-10-2026: banner con icono animado y confeti (éxito), variantes de rechazo, cancelación y error con consejos, y para un pago exitoso un resumen del pedido (productos, envío, cupón, total), dirección, plazo de entrega y "qué sigue". El resumen se arma con `ventas/mis-compras`, así que solo aparece si el pedido es del usuario con sesión. |
| `/mis-compras` 🔒 | `MisComprasPage` | Rediseñada el 13-10-2026: cabecera con totales, filtros por estado (todas, pagadas, pendientes, rechazadas o anuladas), un pedido por tarjeta con color de estado, fotos y total, que se despliega con productos, desglose (envío, cupón), dirección de entrega e historial de estados; cancelar un pedido pendiente pide confirmación. |
| `/cuenta` 🔒 | `CuentaPage` | Mi cuenta (13-10-2026) con dos sub-pestañas (`?seccion=clave` abre la segunda): **Mi información** (nombre y apellido y datos de entrega guardados en el servidor, `cuenta/perfil`) y **Contraseña** (restablecer: actual, nueva y repetir, con la lista de indicaciones en vivo `ReglasClave`/`reglasClave.js` y medidor de seguridad; el botón se activa al cumplirlas todas). Nada es obligatorio: una barra de avance indica que es ideal completar dirección y teléfono, se puede guardar parcialmente y salir sin guardar. El checkout rellena la entrega con estos datos y ofrece guardarlos (casilla opcional). La comuna se elige con un buscador (`CampoComuna`, `src/comunas.js`) que lista las 346 comunas de Chile según la región elegida (52 en la Región Metropolitana); acepta escribir sin tildes y en el checkout exige una comuna de la lista que pertenezca a la región. Si se cambia la región, una comuna que no corresponda se borra. El backend no valida la comuna contra la región: solo guarda el texto. |
| `/recuperar`, `/recuperar/confirmar` | `RecuperarPage`, `RecuperarConfirmarPage` | Recuperar contraseña dentro de la misma pantalla animada del login (`AuthLayout`): pedir el enlace (con captcha) y elegir la clave nueva desde el enlace del correo. Enlace "¿Olvidaste tu contraseña?" en el login. |
| `*` | `NoEncontradaPage` | Página 404: la tienda apagada y el personaje intentando enchufarla (el rótulo parpadea al hacer contacto). |
| (superpuesta) | `Saturacion` | Pantalla de espera a pantalla completa con cuenta regresiva cuando el backend responde 429 por recargas seguidas (F5) o exceso de visitas; no tiene ruta propia. |

🔒 = exige sesión (`RequireAuth` redirige a `/login` y vuelve después). Componentes comunes en `src/components/` (`Header`, `ProductCard`, `RequireAuth`); estado global en `src/contexto/` (usuario y contador del carrito); llamadas en `src/api.js`.

**Marca (13-10-2026):** `public/logo.png` (logo horizontal), `public/logo-alt.png` (variante), `public/icono.png` (tienda, usada en el hero) y `public/favicon.png`, todos con fondo transparente. Se generaron a partir de los originales en `pixelappstore/branding/originales/` (fondo sólido y marca de agua de Gemini); si cambias un original hay que reprocesarlo, no se usa directo. Componentes comunes nuevos: `Footer`.

### 2.1 Catálogo, filtros y diseño (13-10-2026)

- **Ancho único:** header, contenido de todas las páginas, hero y pie usan hasta 1760 px con 28 px de margen (16 px en celular), para que el header no cambie entre pantallas. Destacados y estantes muestran 6 productos en pantallas grandes (≥1500 px) y 4 en las medianas.
- **Filtros** (`HomePage`): categoría, rango de precio, marcas (varias), "mostrar agotados" y orden (más recientes, precio, A-Z, mejor valorados). Todo vive en la URL: `?q`, `?categoria=<id>`, `?grupo=<perifericos|pantallas|componentes|mas>`, `?marcas=a|b`, `?min`, `?max`, `?agotados=0|1`, `?orden`, `?pagina`. Solo `q` se manda al backend; el resto se filtra en el cliente sobre la lista completa, y los contadores de cada filtro excluyen al propio filtro. Elegir una categoría suelta quita el filtro por grupo.
- **Agotados:** se ocultan por defecto y se muestran si hay una búsqueda (`?q`) o si se marca "Mostrar agotados" (`?agotados=1`; `0` los oculta aun buscando).
- **Panel de filtros:** sin scroll propio (crece con la página); solo la lista de marcas tiene una barra delgada. En pantallas angostas se oculta tras un botón.
- **Orden:** menú propio (`SelectorOrden`) en lugar del `<select>` nativo. El hook `useCerrarAlExterior` (cerrar con clic afuera o Escape) está en `src/useCerrarAlExterior.js` y lo comparte con el header.
- **Paginación:** 20 productos por página, calculada en el cliente (ver [[06_Estado_del_Backend_y_Pendientes]]).
- **Carga:** `CargandoProductos` muestra una cabecera con cuadritos pixel animados y tarjetas "esqueleto" mientras llegan los productos (catálogo y destacados).

### 2.2 Portada, header y componentes visuales (13-10-2026)

- **Header:** barra fija (sticky) con logo, menú "Categorías", buscador redondo con lupa, menú "Hola, Ingresa" (iniciar sesión / registrarse) y carrito con insignia roja y animación al agregar. Debajo, una franja amarilla en marquesina con los beneficios (retiro, despacho, pago seguro).
- **Menú Categorías:** panel ancho con 4 grupos (Periféricos, Pantallas y juegos, Componentes de PC, Más), ícono pixel y cantidad por categoría, y botón "Ver todo el catálogo". Sin scroll en pantallas normales; con scroll interno si la pantalla es baja o angosta. Los grupos, su orden y los íconos viven en `src/iconosCategoria.js` (compartido con la portada).
- **Compra por categoría (portada):** círculos con ícono pixel ordenados por cantidad de productos; muestra 9 y un botón amarillo centrado "Ver N categorías más / Ver menos categorías" despliega las demás. Cada círculo lleva a `/catalogo?categoria=<id>`.
- **Destacados:** los 4 mejor valorados con stock, en tarjeta oscura con borde cian, etiqueta "Mejor valorado", sombra amarilla al pasar el mouse y botón con brillo animado.
- **Estantes:** bajo los destacados hay uno por Notebooks, Televisores, Componentes de PC, Consolas y Periféricos, con los 4 mejor calificados (con stock primero) y un botón "Ver más" a `/catalogo?categoria=<id>&orden=valorados` o `?grupo=<grupo>&orden=valorados`. La lista (`ESTANTES`) está en `PortadaPage`.
- **Tarjeta de producto:** al agregar, el botón se pone verde con un check animado y "Agregado" (sin cartel; los errores sí se muestran debajo). Si no hay stock, la foto se ve en gris, aparece la etiqueta "Agotado" y el botón queda apagado con "Sin stock".
- **Carrito vacío:** escena en pixel art: un personaje (gorra morada con visera cian) camina hasta un carrito, lo agarra, lo empuja a la tienda y sale solo con dos bolsas; el logo de la tienda levita sobre el techo. La animación dura 12 s en bucle y se detiene si el sistema pide reducir animaciones. Los dibujos están en `PixelArt` + `iconosPixel.js` (claves `persona_*`, `carro`, `bolsa_*`, `tienda`).
- **Carrito con productos:** cada producto es una tarjeta con foto, precio unitario, cantidad (con efecto al cambiar), subtotal y "Quitar"; entran escalonadas, y al quitar o vaciar salen deslizándose (≈0,4 s) antes de llamar al backend. El resumen (oscuro, fijo al hacer scroll) anima el subtotal con un conteo, trae el botón "Ir a pagar" y recuerda envío ($3.000 RM, $6.000 regiones), pago con Webpay y retiro en tienda. Al quedar vacío, la escena del personaje aparece con un desvanecido. Cuando un producto lleva 2 o más unidades aparece un botón "-1" que descarta una unidad (`carrito/restar/<item_id>`, ver [[03_API_Endpoints]]); siempre queda al menos una. +1/-1 actualizan la pantalla al instante y las peticiones de cada producto van en fila; si el servidor rechaza el cambio (por ejemplo "Stock insuficiente. Máximo: N") se revierte y el aviso aparece dentro de la tarjeta de ese producto durante unos segundos.
- **Íconos:** SVG propios (`Icono.jsx`) y arte pixel con cuadrícula de tamaño variable (`PixelArt.jsx` + `iconosPixel.js`, paleta en `PALETA`); no se usan emojis. `src/tiposProducto.js` quedó sin uso.
- **Datos de demostración:** 105 productos (5 originales y PX-101 a PX-200) con precios y stock inventados, y 325 valoraciones ficticias firmadas por los usuarios `cliente_demo1` a `cliente_demo8` (sin contraseña). Las fotos están en `media/productos/` (ignorada por git) y sus autores y licencias en `pixelappstore/branding/CREDITOS_IMAGENES.md`; las de Logitech G203 y HyperX Cloud II son de los fabricantes y solo sirven para fines académicos.

**Panel de administración:** desde el 13-10-2026 existe (ver sección al final). **No existen en el frontend** (el backend sí): panel de administración (productos, empleados, dashboard, egresos), POS, valoraciones y recuperación de contraseña. Para cargar productos usa `/admin` de Django.

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
En el **panel de administración** (dirección con `python manage.py ruta_panel`; sección Productos, botón Categorías y Nuevo producto): crea una **Categoría**, un **Producto** con precio y `stock` ≥ 3, y opcionalmente una **Imagen producto**. Crea un **Cupón** (código, % entre 1 y 100, fecha futura, activo) para probar descuentos. Puede que la base ya traiga productos: míralos antes.

### 3.4 Lista de verificación

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abrir `/` | Ves la portada: categorías en círculos, destacados y estantes; el menú "Categorías" abre el panel con grupos. |
| 2 | Buscar "audifonos" (sin tilde) y usar los filtros de `/catalogo` | Aparece "Audífonos"; los filtros y la paginación (20 por página) actualizan la lista y la URL. |
| 3 | Pulsar "Agregar al carrito" sin sesión | Te lleva a `/login`. Con sesión, el botón muestra "Agregado" en verde. |
| 4 | Registrarte (correo real, clave de 8+ no común) | Vuelves a `/login` con "Cuenta creada". |
| 5 | Login: usuario/clave → código del correo | Entras; el menú dice "Hola, <usuario>". |
| 6 | Agregar un producto | Aparece el contador en "Carrito". |
| 7 | `/carrito`: +1 y Quitar (y vaciarlo) | Cantidades y total cambian; con el carrito vacío aparece la escena animada. |
| 8 | `/checkout`: región "RM" y luego otra | El envío cambia entre $3.000 y $6.000. |
| 9 | **Pagar con Webpay → pago aprobado** | Cambia a la página de Webpay; tras pagar vuelves a `/pago/resultado?estado=exito`. |
| 10 | Revisar | Stock del producto bajó; `/mis-compras` muestra el pedido **pagado**; carrito vacío; llegó el correo de compra. |
| 11 | Recargar `/pago/resultado` o repetir la URL de retorno | No se cobra ni se descuenta stock otra vez. |
| 12 | Pagar con la tarjeta de **rechazo** | `estado=rechazado`; pedido `rechazado`; stock intacto. |
| 13 | En Webpay, anular y volver al comercio | `estado=cancelado`; pedido `anulado`; el carrito sigue lleno. |
| 14 | Con un producto en el carrito, bajar su stock a 0 desde el panel (Productos, editar) y pagar | `/checkout` muestra "Stock insuficiente"; no se cobra. |
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

## Panel de administración (13-10-2026)

Se entra por una dirección secreta que muestra el comando `python manage.py ruta_panel` (también aparece como "Panel de administración" en el menú de usuario, solo a cuentas de staff). Sin sesión de staff, esa dirección muestra la 404 de la tienda. Pantalla completa propia (barra lateral morada, contenido claro, `src/admin` + `admin.css`), cargada en un paquete aparte. Todas las secciones se arman con las rutas de [[03_API_Endpoints]].

| Sección | Quién | Qué hace |
|---|---|---|
| Resumen | staff | Ingresos, egresos, ganancia, pedidos, ticket promedio, usuarios y pendientes; gráfico de 14 días; más vendidos; ventas recientes; stock bajo; descarga del reporte PDF. |
| Productos | staff | Gestión de categorías (crear y renombrar; eliminar solo el superusuario y sin productos). Tabla con búsqueda, filtros por categoría y stock, paginación; crear y editar (nombre, código, marca, categoría, precio, stock, descripción, imágenes con alta y baja); eliminar con confirmación. |
| Ventas | staff | Todas las ventas con filtros por estado y búsqueda; cada fila se despliega con productos, desglose, dirección e historial. |
| Venta en mostrador | staff | POS: buscar productos con stock, armar la venta y registrarla (pagada al instante, descuenta stock). |
| Finanzas | staff | Totales y registro de gastos por categoría. |
| Cupones | superusuario | Crear y editar cupones, con límites de uso. |
| Usuarios | superusuario | Empleados (crear con indicaciones de contraseña, activar y desactivar) y clientes (buscar y eliminar). |
| Actividad | superusuario | Registro de las últimas 200 acciones del equipo. |
