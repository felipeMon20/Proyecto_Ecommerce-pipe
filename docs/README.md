# Documentación del Backend — Sistema E-commerce + POS

Vault de Obsidian con la documentación del backend (`ecommerce_backend/SistemaVentas`). Creada el 12-10-2026 a partir de la lectura directa del código. El frontend (`pixelappstore/`) no está cubierto.

> **Certeza:** todo lo descrito se verificó leyendo el código. **No se ejecutó** el proyecto (Django no estaba instalado en el equipo de la auditoría), por lo que nada está validado en runtime.

## Documentos

1. [[01_Arranque_y_Configuracion]] — settings, `.env`, dependencias, cómo levantarlo.
2. [[02_Modelos_de_Datos]] — modelos y señales.
3. [[03_API_Endpoints]] — todas las rutas y su control de acceso real.
4. [[04_Autenticacion_y_Seguridad]] — 2FA, bloqueo, JWT vs sesión, permisos.
5. [[05_Ventas_Carrito_y_Webpay]] — carrito, POS, pago Webpay, cupones, stock.
6. [[06_Estado_del_Backend_y_Pendientes]] — **empieza aquí si quieres saber qué falla.**

## Stack confirmado por el código

Django (settings generado con 6.0.1), Django REST Framework + SimpleJWT, django-cors-headers, python-dotenv, SQLite, Pillow (ImageField), ReportLab (PDF), transbank-sdk (Webpay Plus), SMTP Gmail.

`ecommerce_backend/readme.txt` es previo y contiene afirmaciones que el código no respeta (ver [[06_Estado_del_Backend_y_Pendientes]] §6). Ante conflicto, el código gana.
