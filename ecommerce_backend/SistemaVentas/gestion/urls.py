from django.urls import path
from gestion.views import views_productos, views_usuarios, views_ventas, views_webpay, views_dashboard 
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # --- PRODUCTOS ---
    path('productos/listar', views_productos.lista_productos, name='listar_productos'),
    path('productos/relacionados/<int:producto_id>', views_productos.productos_relacionados, name='productos_relacionados'), 
    path('productos/crear', views_productos.crear_producto, name='crear_producto'),
    path('productos/editar/<int:producto_id>', views_productos.editar_producto, name='editar_producto'),
    path('productos/eliminar/<int:producto_id>', views_productos.eliminar_producto, name='eliminar_producto'),
    path('productos/carga-masiva', views_productos.carga_masiva_productos, name='carga_masiva'),
    path('productos/eliminar-todos', views_productos.eliminar_todos_productos, name='eliminar_todos'),
    path('productos/reemplazar', views_productos.reemplazar_productos, name='reemplazar_productos'),
    path('productos/valorar/<int:producto_id>', views_productos.registrar_valoracion, name='registrar_valoracion'),

    # --- CLIENTES (Usuarios normales) ---
    path('usuarios/reemplazar', views_usuarios.reemplazar_usuarios, name='reemplazar_usuarios'),
    path('usuarios/listar', views_usuarios.listar_usuarios, name='listar_usuarios'),
    path('usuarios/eliminar/<int:usuario_id>', views_usuarios.eliminar_usuario, name='eliminar_usuario'),
    
    # --- EMPLEADOS (NUEVO ID 16) ---
    path('empleados/crear', views_usuarios.crear_empleado, name='crear_empleado'),
    path('empleados/listar', views_usuarios.listar_empleados, name='listar_empleados'),
    path('empleados/editar/<int:empleado_id>', views_usuarios.editar_empleado, name='editar_empleado'),

    # --- AUTH ---
    path('auth/login-paso1', views_usuarios.solicitar_login, name='solicitar_login'),
    path('auth/login-paso2', views_usuarios.verificar_codigo_login, name='verificar_codigo'),
    path('auth/logout', views_usuarios.cerrar_sesion, name='cerrar_sesion'),
    path('auth/registro', views_usuarios.registrar_usuario, name='registrar_usuario'),
    path('auth/recuperar-solicitar', views_usuarios.solicitar_recuperacion, name='recuperar_solicitar'),
    path('auth/recuperar-confirmar', views_usuarios.confirmar_cambio_password, name='recuperar_confirmar'),

    # --- VENTAS Y CARRITO ---
    path('ventas/registrar', views_ventas.registrar_venta, name='registrar_venta'), # <--- ESTE ES EL POS
    path('ventas/historial', views_ventas.listar_ventas, name='listar_ventas'), 
    path('ventas/mis-compras', views_ventas.mis_compras, name='mis_compras'),
    path('ventas/cancelar/<int:venta_id>', views_ventas.cancelar_compra, name='cancelar_compra'),
    path('ventas/bitacora/<int:venta_id>', views_ventas.ver_historial_venta, name='ver_historial_venta'),

    path('carrito/agregar', views_ventas.agregar_carrito, name='agregar_carrito'),
    path('carrito/ver', views_ventas.ver_carrito, name='ver_carrito'),
    path('carrito/vaciar', views_ventas.vaciar_carrito, name='vaciar_carrito'),
    path('carrito/eliminar/<int:item_id>', views_ventas.eliminar_item_carrito, name='eliminar_item_carrito'),

    # --- WEBPAY ---
    path('webpay/iniciar', views_webpay.iniciar_pago, name='webpay_iniciar'),
    path('webpay/confirmar', views_webpay.confirmar_pago, name='webpay_confirmar'),

    # --- FINANZAS Y DASHBOARD ---
    path('dashboard/metricas', views_dashboard.obtener_dashboard, name='obtener_dashboard'),
    path('dashboard/reporte-pdf', views_dashboard.exportar_reporte_pdf, name='exportar_reporte_pdf'),
    path('finanzas/egresos/crear', views_dashboard.registrar_egreso, name='registrar_egreso'),
    path('finanzas/egresos/listar', views_dashboard.listar_egresos, name='listar_egresos'),

    # -- prueba token --
    path('api/prueba-token', views_usuarios.prueba_token_jwt, name='prueba_token'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)