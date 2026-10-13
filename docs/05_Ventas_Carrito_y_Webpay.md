# 05 — Ventas, Carrito y Webpay

Archivos: `views/views_ventas.py`, `views/views_webpay.py`. Modelos en [[02_Modelos_de_Datos]]. Problemas en [[06_Estado_del_Backend_y_Pendientes]].

## 1. Carrito (BD)

Un `Carrito` por usuario, requiere sesión. `agregar` suma cantidad y valida stock contra lo acumulado. `ver` calcula subtotales con el precio actual. `restar/<item_id>` descarta una unidad con un `UPDATE` atómico (`F('cantidad') - 1` solo si hay más de 1), así que los clics repetidos nunca dejan el producto en 0 ni lo borran; para eliminarlo está `eliminar`. **El carrito del servidor no participa en el pago**: `webpay/iniciar` recibe `items` en el body y nunca lo consulta ni lo vacía.

## 2. Venta de mostrador (POS)

`ventas/registrar`: dentro de `transaction.atomic()`, crea la venta directamente en `pagado`, bloquea cada producto con `select_for_update`, valida stock y lo descuenta. Asigna `usuario` = quien llama (el vendedor). No aplica cupón ni envío. Desde 12-10-2026 exige usuario staff.

## 3. Flujo de pago Webpay Plus

> **Reescrito 12-10-2026.** Verificado con 37 pruebas manuales usando un Transbank simulado, base en memoria y correo simulado; no hay tests en el repo ni se probó contra el ambiente real de Transbank.

1. **`webpay/iniciar`** (POST): exige la dirección de entrega (`direccion` en el body: nombre, teléfono de 8 a 12 dígitos, calle, número y comuna; opcionales depto e indicaciones) y la guarda en la venta; valida cada item (cantidad entera ≥ 1, producto existente, stock suficiente sumando repetidos), calcula cupón (porcentaje limitado a 0-100) y envío ($3.000 en `RM`/`metropolitana`, $6.000 en otro caso). Crea `Venta` en `pendiente` + `DetalleVenta`, llama a `Transaction.create` y **guarda el token de Webpay en `Venta.codigo_comprobante`**. Devuelve `url_webpay` + `token`. Si Transbank falla responde 502 y la venta se revierte. No descuenta stock.
2. El **frontend** debe enviar al navegador a `url_webpay` con `token_ws` (hoy no existe esa pantalla; ver [[06_Estado_del_Backend_y_Pendientes]]).
3. Webpay vuelve a `WEBPAY_RETURN_URL` (GET o POST).
4. **`webpay/confirmar`** ya no devuelve JSON: **siempre redirige** a `{FRONTEND_URL}/pago/resultado?estado=<...>&venta=<id>`. Estados posibles:

| `estado` | Cuándo |
|---|---|
| `exito` | Autorizado y venta pagada (también si se recarga la página: no se vuelve a cobrar). |
| `rechazado` | El banco rechazó; no había stock antes de cobrar; o el stock se agotó después del cobro (se reembolsa). |
| `cancelado` | El usuario abortó en Webpay (`TBK_TOKEN`) o se agotó el tiempo (sin token). |
| `error` | Token que no corresponde a ninguna venta, falla del commit, o monto/orden distintos a los esperados (se reembolsa). |

5. Orden interno de `confirmar`: token desconocido → error; venta ya pagada → éxito sin tocar nada; **verifica stock antes del commit** (si falta, no se cobra); `commit`; valida `AUTHORIZED` + `response_code 0`, orden y monto; descuenta stock con `select_for_update` y marca `pagado` en una sola transacción; vacía del carrito del usuario lo comprado; envía el correo **después** de confirmar (si falla se registra en el log, ya no se informa un envío falso).
6. **Reembolso automático**: si tras cobrar el stock se agotó en el intertanto, o los datos no coinciden, se llama a `Transaction.refund`, la venta queda `rechazado` y se escribe un `AuditLog` "Reembolso Webpay". Si el reembolso falla, el `AuditLog` dice **"REEMBOLSO FALLIDO, hacerlo manualmente en Transbank"**: revisar ese registro.
7. Un aborto solo anula una venta si el `TBK_TOKEN` recibido coincide con el token guardado; así nadie puede anular la compra de otro adivinando el número.

### Configuración (`settings.py` / `.env`)

`FRONTEND_URL` (default `http://localhost:5173`), `WEBPAY_RETURN_URL` (default `http://127.0.0.1:8000/webpay/confirmar`), `WEBPAY_AMBIENTE` (`integracion` por defecto), `WEBPAY_COMMERCE_CODE`, `WEBPAY_API_KEY`. Con `WEBPAY_AMBIENTE=produccion` se exigen las credenciales propias; sin ellas el pago se niega, **no** cae al ambiente de pruebas. Plantilla en `.env.example`.

## 4. Modo BYPASS (solo desarrollo)

Con `DEBUG=True`, un `token_ws` con forma `BYPASS_<venta_id>` marca la venta como pagada sin consultar a Transbank (descuenta stock y envía correo igual). Con `DEBUG=False` no hace nada: se trata como token desconocido (`estado=error`).

## 5. Estados de venta

`pendiente` → `pagado` (confirmar o POS) · `pendiente` → `anulado` (`cancelar_compra`, por el dueño). `pendiente` → `rechazado` (banco rechaza, sin stock o reembolso) · `pendiente` → `anulado` también cuando el usuario aborta en Webpay. El historial se escribe por señal ([[02_Modelos_de_Datos]] §4).

## 6. Reportes

`dashboard/metricas` suma solo ventas `pagado` (incluye POS) y resta `Egreso`. `dashboard/reporte-pdf` genera PDF con ReportLab de las últimas 20 ventas pagadas ([[03_API_Endpoints]]).

## IVA (13-10-2026)

**Confirmado por el código:** el backend no calcula ni guarda IVA. El monto cobrado en Webpay es `productos + envío - cupón` (ver `webpay/iniciar`), así que el IVA **no se suma encima**: se asume que los precios del catálogo y el costo de despacho ya son precios finales con IVA, como corresponde a una venta a consumidor en Chile. El checkout solo **muestra** cuánto IVA (19%) está incluido: `total - total / 1,19`, sobre productos más envío y antes del cupón.

**Propuesta, no implementada:** si la tienda debe emitir boleta o factura electrónica (SII), habría que guardar neto, IVA y total por venta y definir si el despacho se desglosa; hoy la tabla `Venta` solo guarda el total.

## Cupones (13-10-2026)

Un cupón es una fila de `Cupon`: `codigo`, `descuento_porcentaje`, `fecha_expiracion`, `activo` y, desde la migración 0015, `usos_maximos` (total entre todos los clientes; vacío = sin tope) y `usos_por_usuario` (por cliente; por defecto 1; vacío = sin tope). Desde el 13-10-2026 se crean y editan en la sección **Cupones** del panel de administración (solo superusuario; `/admin` ya no existe).

La regla vive en `gestion/cupones.py` (`validar_cupon`) y la usan `webpay/iniciar` (al cobrar) y `cupones/validar` (vista previa en el checkout). Se valida en este orden: el código existe y está activo (sin distinguir mayúsculas), no venció, no se superó `usos_maximos` y el cliente no superó `usos_por_usuario`. El descuento se calcula solo sobre los productos, no sobre el envío.

- **Qué cuenta como uso:** las ventas `pagado` con ese `cupon_usado`. Para el tope total también cuentan las `pendiente` de los últimos 30 minutos (reservan el cupo mientras se paga); una venta rechazada o anulada libera el uso.
- **Límite por usuario:** exige sesión; sin sesión responde "Inicia sesión para usar este cupón".
- **Limitación conocida:** el uso por usuario se verifica al iniciar el pago, no al confirmarlo; dos pagos iniciados casi a la vez por la misma persona podrían usar el cupón dos veces.
- **Cupones actuales (13-10-2026):** `VERANO2026` (10%, vencido el 01-03-2026) y `PIXEL10` (10%, hasta el 31-12-2027, máximo 100 usos y 1 por persona), creado para pruebas.

## Reserva de stock al pagar (13-10-2026)

El stock real solo baja al confirmar el pago, pero desde esta fecha una venta `pendiente` de los últimos 30 minutos (`MINUTOS_RESERVA`, la misma de los cupones) aparta sus unidades. La lógica está en `gestion/reservas.py` (`stock_reservado`) y la usa `webpay/iniciar`: calcula `disponible = stock - reservado por otros clientes` y, si no alcanza, responde 400 con "Otros clientes están pagando <producto>. Por ahora quedan N unidades disponibles" antes de enviar al cliente a Webpay.

- **Sus propias ventas pendientes no lo bloquean:** quien reintenta el pago no compite contra sí mismo (solo se excluye si hay sesión).
- **Se libera sola:** al pagarse (el stock real ya bajó), rechazarse o anularse la venta, o a los 30 minutos.
- **No cambia la confirmación:** `confirmar` sigue comparando contra el stock real, así que una reserva vencida no garantiza el stock.
- **Disponibilidad visible:** `productos/listar` y `carrito/ver` devuelven `disponible` (stock menos lo apartado por otros clientes) junto al `stock` real; `carrito/agregar` valida contra `disponible`. El frontend usa `disponible` para el selector de cantidad, el botón +1 y los avisos, y muestra "Reservado" / "Reservado por otros clientes" cuando hay stock pero todo está apartado.
- **Sin carreras al iniciar el pago:** `webpay/iniciar` revisa y crea la venta pendiente dentro de una transacción con los productos bloqueados (`select_for_update`). En SQLite, donde ese bloqueo no existe, `settings.py` usa `transaction_mode: IMMEDIATE`, que toma el bloqueo de escritura al abrir la transacción. La llamada a Webpay se hace después, fuera de la transacción; si falla, la venta se marca `anulado` y el apartado se libera. Probado con 8 pagos simultáneos de 3 unidades sobre 10 en stock: pasaron exactamente 3.
- **Duración del apartado:** 15 minutos (`MINUTOS_RESERVA_STOCK` en `reservas.py`; los cupones siguen con sus 30 en `cupones.py`). Pasado ese tiempo la venta pendiente deja de apartar aunque siga `pendiente`.
- **Pantallas al día:** el frontend vuelve a pedir la disponibilidad cada 20 segundos mientras la pestaña está visible y al volver a ella (`useRefrescoPeriodico`): ficha, portada, catálogo y carrito. El carrito no se refresca si hay cambios en camino, y avisa en la tarjeta del producto cuando la cantidad pedida supera lo disponible.
- **Limitaciones conocidas:** `confirmar` sigue comparando contra el stock real, así que una reserva vencida no garantiza el stock (si otro se lo llevó, el pago se rechaza antes de cobrar). El refresco es por consulta periódica, no en tiempo real: hay hasta 20 segundos de desfase, y el checkout no se refresca (el backend lo valida igual al pagar).
