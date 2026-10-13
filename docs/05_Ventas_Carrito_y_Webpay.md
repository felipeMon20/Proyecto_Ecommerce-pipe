# 05 — Ventas, Carrito y Webpay

Archivos: `views/views_ventas.py`, `views/views_webpay.py`. Modelos en [[02_Modelos_de_Datos]]. Problemas en [[06_Estado_del_Backend_y_Pendientes]].

## 1. Carrito (BD)

Un `Carrito` por usuario, requiere sesión. `agregar` suma cantidad y valida stock contra lo acumulado. `ver` calcula subtotales con el precio actual. **El carrito del servidor no participa en el pago**: `webpay/iniciar` recibe `items` en el body y nunca lo consulta ni lo vacía.

## 2. Venta de mostrador (POS)

`ventas/registrar`: dentro de `transaction.atomic()`, crea la venta directamente en `pagado`, bloquea cada producto con `select_for_update`, valida stock y lo descuenta. Asigna `usuario` = quien llama (el vendedor). No aplica cupón ni envío. Desde 12-10-2026 exige usuario staff.

## 3. Flujo de pago Webpay Plus

> **Reescrito 12-10-2026.** Verificado con 37 pruebas manuales usando un Transbank simulado, base en memoria y correo simulado; no hay tests en el repo ni se probó contra el ambiente real de Transbank.

1. **`webpay/iniciar`** (POST): valida cada item (cantidad entera ≥ 1, producto existente, stock suficiente sumando repetidos), calcula cupón (porcentaje limitado a 0-100) y envío ($3.000 en `RM`/`metropolitana`, $6.000 en otro caso). Crea `Venta` en `pendiente` + `DetalleVenta`, llama a `Transaction.create` y **guarda el token de Webpay en `Venta.codigo_comprobante`**. Devuelve `url_webpay` + `token`. Si Transbank falla responde 502 y la venta se revierte. No descuenta stock.
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
