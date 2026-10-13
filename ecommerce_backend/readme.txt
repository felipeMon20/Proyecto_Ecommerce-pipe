==============================================================================
PROYECTO: SISTEMA DE GESTIÓN E-COMMERCE & PUNTO DE VENTA (POS)
AUTOR:    Felipe Monsalve
VERSION:  1.0.0
STACK:    Python, Django, SQLite, ReportLab, JWT
==============================================================================

------------------------------------------------------------------------------
1. DESCRIPCIÓN GENERAL
------------------------------------------------------------------------------
Este proyecto consiste en un Backend robusto y escalable diseñado para operar 
bajo un modelo híbrido: funciona simultáneamente como una Tienda Online (E-commerce) 
y como un sistema de Punto de Venta (POS) para sucursales físicas.

El objetivo fue centralizar la lógica de negocio, inventario y seguridad en una 
única API REST, permitiendo que tanto clientes web como vendedores presenciales 
interactúen con la misma base de datos en tiempo real.

------------------------------------------------------------------------------
2. ARQUITECTURA Y METODOLOGÍA DE DESARROLLO
------------------------------------------------------------------------------
El sistema fue construido utilizando Django, priorizando la seguridad, la 
trazabilidad de datos y la experiencia de usuario. A continuación detallo 
las decisiones técnicas clave:

A. SEGURIDAD EN CAPAS (DEFENSE IN DEPTH)
   - Implementé un sistema de Login de dos pasos (2FA) enviando códigos dinámicos 
     al correo del usuario.
   - Desarrollé un mecanismo de "Bloqueo Inteligente": tras 3 intentos fallidos, 
     la cuenta se bloquea temporalmente para evitar ataques de fuerza bruta.
   - Para la API, migré de cookies tradicionales a Autenticación vía JWT 
     (JSON Web Tokens), permitiendo escalabilidad para futuras Apps móviles.

B. MODELO HÍBRIDO (WEB + POS)
   - Diferencié los roles mediante el sistema de permisos de Django (Staff vs User).
   - Creé endpoints específicos para "Ventas Web" (integración Webpay) y 
     "Ventas Mostrador" (registro manual de vendedores), compartiendo el mismo 
     inventario para evitar descuadres de stock.

C. AUTOMATIZACIÓN MEDIANTE SEÑALES (SIGNALS)
   - Para evitar código repetitivo y errores humanos, utilicé Django Signals 
     (pre_save, post_save, post_delete).
   - Ejemplo: Al cambiar el estado de una venta, el sistema genera automáticamente 
     una entrada en la bitácora histórica sin intervención manual.
   - Auditoría: Al eliminar un producto o descargar un reporte, se dispara un 
     trigger que guarda la acción en el log de seguridad.

D. PERSISTENCIA DE DATOS
   - El carrito de compras no es volátil (sesión), sino que se almacena en la 
     base de datos. Esto permite al usuario cerrar el navegador y recuperar su 
     compra más tarde, mejorando la conversión de ventas.

------------------------------------------------------------------------------
3. MÓDULOS Y FUNCIONALIDADES
------------------------------------------------------------------------------

[MÓDULO 1: GESTIÓN DE PRODUCTOS]
- CRUD completo con soporte para imágenes.
- Buscador inteligente con filtros avanzados (Precio, Categoría, Texto).
- Carga masiva y restauración de base de datos desde JSON.
- Sistema de Valoraciones (Reviews) validado: solo quien compró puede opinar.

[MÓDULO 2: VENTAS Y TRANSACCIONES]
- Integración real con Webpay (Transbank) para pagos online.
- Carrito de compras persistente.
- Historial de estados (Pendiente -> Pagado -> Enviado) con bitácora de tiempos.
- Punto de Venta (POS) para vendedores con asignación automática de responsabilidad.

[MÓDULO 3: ADMINISTRACIÓN Y FINANZAS]
- Dashboard en tiempo real con KPIs: Ingresos Totales, Productos Top, Ventas Diarias.
- Gestión de Egresos: Registro de gastos operativos para cálculo de utilidad real.
- Balance Financiero automático (Ingresos - Egresos).
- Generación de Reportes oficiales en PDF usando la librería ReportLab.

[MÓDULO 4: RECURSOS HUMANOS]
- CRUD de Empleados: El administrador puede contratar y despedir (activar/desactivar) 
  vendedores desde el panel, sin acceso directo a la base de datos.

------------------------------------------------------------------------------
4. INSTALACIÓN Y DESPLIEGUE
------------------------------------------------------------------------------
Requisitos previos: Python 3.10+ y pip.

1. Clonar el repositorio.
2. Crear entorno virtual:
   $ python -m venv env
   $ source env/bin/activate  (o env\Scripts\activate en Windows)

3. Instalar dependencias:
   $ pip install django reportlab djangorestframework djangorestframework-simplejwt

4. Migrar base de datos:
   $ python manage.py makemigrations
   $ python manage.py migrate

5. Cargar datos iniciales (Opcional):
   $ python manage.py loaddata gestion/fixtures/usuarios.json
   $ python manage.py loaddata gestion/fixtures/productos.json

6. Ejecutar servidor:
   $ python manage.py runserver

------------------------------------------------------------------------------
5. CONTACTO
------------------------------------------------------------------------------
Desarrollado por Felipe Monsalve.
Para dudas sobre la arquitectura o implementación, contactar vía correo.

"Software construido pensando en la escalabilidad y el control total del negocio."
==============================================================================