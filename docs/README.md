# Documentación del Backend — Sistema E-commerce + POS

Vault de Obsidian con la documentación del backend (`ecommerce_backend/SistemaVentas`). Creada el 12-10-2026 a partir de la lectura directa del código. El frontend se documenta solo en [[07_Frontend_y_Guia_de_Pruebas]].

> **Certeza:** la auditoría inicial fue por lectura de código. Desde el 12-10-2026 el backend se ejecutó en un venv (`manage.py check`, migraciones al día) y los cambios de 2FA, Webpay y registro se verificaron con pruebas manuales en base desechable. Lo único contrastado con Transbank es la **creación** de la transacción en su ambiente de integración; el pago con tarjeta en el navegador no se ha probado. No hay tests automáticos en el repo.

## Documentos

1. [[01_Arranque_y_Configuracion]] — settings, `.env`, dependencias, cómo levantarlo.
2. [[02_Modelos_de_Datos]] — modelos y señales.
3. [[03_API_Endpoints]] — todas las rutas y su control de acceso real.
4. [[04_Autenticacion_y_Seguridad]] — 2FA, bloqueo, JWT vs sesión, permisos.
5. [[05_Ventas_Carrito_y_Webpay]] — carrito, POS, pago Webpay, cupones, stock.
6. [[06_Estado_del_Backend_y_Pendientes]] — **empieza aquí si quieres saber qué falla.**
7. [[07_Frontend_y_Guia_de_Pruebas]] — pantallas del frontend y **pasos para probar la compra de punta a punta.**

## Stack confirmado por el código

Django (settings generado con 6.0.1), Django REST Framework + SimpleJWT, django-cors-headers, python-dotenv, SQLite, Pillow (ImageField), ReportLab (PDF), transbank-sdk (Webpay Plus), SMTP Gmail.

`ecommerce_backend/readme.txt` es previo y contiene afirmaciones que el código no respeta (ver [[06_Estado_del_Backend_y_Pendientes]] §6). Ante conflicto, el código gana.
