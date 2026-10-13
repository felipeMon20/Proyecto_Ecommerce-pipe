# 05 — Ventas, Carrito y Webpay

Archivos: `views/views_ventas.py`, `views/views_webpay.py`. Modelos en [[02_Modelos_de_Datos]]. Problemas en [[06_Estado_del_Backend_y_Pendientes]].

## 1. Carrito (BD)

Un `Carrito` por usuario, requiere sesión. `agregar` suma cantidad y valida stock contra lo acumulado. `ver` calcula subtotales con el precio actual. **El carrito del servidor no participa en el pago**: `webpay/iniciar` recibe `items` en el body y nunca lo consulta ni lo vacía.

## 2. Venta de mostrador (POS)

`ventas/registrar`: dentro de `transaction.atomic()`, crea la venta directamente en `pagado`, bloquea cada producto con `select_for_update`, valida stock y lo descuenta. Asigna `usuario` = quien llama (el vendedor). No aplica cupón ni envío. Desde 12-10-2026 exige usuario staff.

## 3. Flujo de pago Webpay Plus (ambiente de pruebas)

1. **`webpay/iniciar`** (POST): lee `items`, `region`, `cupon`. Precios tomados de la BD (bien). Cupón: porcentaje sobre el subtotal. Envío fijo: $3.000 si región es `RM`/`metropolitana`, $6.000 en otro caso. Crea `Venta` en `pendiente` y sus `DetalleVenta`, llama a `Transaction.create(buy_order=venta.id, session_id aleatorio, monto, url_retorno)` y devuelve `url_webpay` + `token`. Desde 12-10-2026 valida cantidad (≥ 1) y stock en este punto, pero no descuenta (eso ocurre al confirmar).
2. El navegador debe redirigir a `url_webpay` con el token. **El backend no genera ningún redirect**; eso depende del frontend (hoy `CheckoutPage.jsx` es solo un título).
3. Webpay redirige al `url_retorno`, fijo en `http://127.0.0.1:8000/webpay/confirmar`.
4. **`webpay/confirmar`**: lee `token_ws` (GET, POST o JSON), hace `commit`; si el estado es `AUTHORIZED`, en una transacción pasa la venta a `pagado`, descuenta stock (falla con excepción si no alcanza) y envía correo de resumen si el usuario tiene email. Responde **JSON** (no redirige de vuelta a la tienda).
5. Credenciales: código de comercio y API key de **integración** de la librería (`IntegrationCommerceCodes.WEBPAY_PLUS`, `IntegrationApiKeys.WEBPAY`), `IntegrationType.TEST`. No hay modo producción.

## 4. Modo BYPASS

> **Actualizado 12-10-2026:** el atajo solo funciona con `DEBUG=True`. Con `DEBUG=False` el token se envía a Transbank como cualquier otro.

Si el `token_ws` empieza con `BYPASS_`, `confirmar_pago` lo trata como `AUTHORIZED` y toma el id de venta de lo que sigue (`BYPASS_<venta_id>`), **sin consultar a Transbank**. Es un atajo de desarrollo que sigue activo. Ver [[06_Estado_del_Backend_y_Pendientes]] (crítico).

## 5. Estados de venta

`pendiente` → `pagado` (confirmar o POS) · `pendiente` → `anulado` (`cancelar_compra`, por el dueño). `rechazado` está definido pero **ningún código lo asigna**. El historial se escribe por señal ([[02_Modelos_de_Datos]] §4).

## 6. Reportes

`dashboard/metricas` suma solo ventas `pagado` (incluye POS) y resta `Egreso`. `dashboard/reporte-pdf` genera PDF con ReportLab de las últimas 20 ventas pagadas ([[03_API_Endpoints]]).
