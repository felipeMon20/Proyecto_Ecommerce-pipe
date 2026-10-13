from django.urls import path
from gestion.views import views_productos, views_usuarios, views_ventas, views_webpay, views_dashboard, views_cuenta, views_panel
from django.conf import settings
from django.conf.urls.static import static
from gestion.limites import limitar, email_del_body
from gestion.captcha import exigir_captcha, estado_captcha

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
    path('auth/login-paso1', limitar('login', 10, 600, 'fallos')(exigir_captcha('login')(views_usuarios.solicitar_login)), name='solicitar_login'),
    path('auth/login-paso2', limitar('codigo', 10, 600, 'fallos')(views_usuarios.verificar_codigo_login), name='verificar_codigo'),
    path('auth/captcha-estado', estado_captcha, name='captcha_estado'),
    path('cuenta/perfil', views_cuenta.perfil_cuenta, name='perfil_cuenta'),
    path('cuenta/cambiar-clave', limitar('cambiar-clave', 10, 600, 'fallos')(views_cuenta.cambiar_clave), name='cambiar_clave'),
    path('auth/logout', views_usuarios.cerrar_sesion, name='cerrar_sesion'),
    path('auth/registro', limitar('registro', 5, 3600, por=email_del_body, maximo_por=3)(exigir_captcha('registro')(views_usuarios.registrar_usuario)), name='registrar_usuario'),
    path('auth/recuperar-solicitar', limitar('recuperar', 5, 3600, por=email_del_body, maximo_por=3)(exigir_captcha('recuperar')(views_usuarios.solicitar_recuperacion)), name='recuperar_solicitar'),
    path('auth/recuperar-confirmar', limitar('recuperar-confirmar', 10, 600, 'fallos')(views_usuarios.confirmar_cambio_password), name='recuperar_confirmar'),

    # --- VENTAS Y CARRITO ---
    path('ventas/registrar', views_ventas.registrar_venta, name='registrar_venta'), # <--- ESTE ES EL POS
    path('ventas/historial', views_ventas.listar_ventas, name='listar_ventas'), 
    path('ventas/mis-compras', views_ventas.mis_compras, name='mis_compras'),
    path('ventas/cancelar/<int:venta_id>', views_ventas.cancelar_compra, name='cancelar_compra'),
    path('ventas/bitacora/<int:venta_id>', views_ventas.ver_historial_venta, name='ver_historial_venta'),

    path('carrito/agregar', views_ventas.agregar_carrito, name='agregar_carrito'),
    path('carrito/ver', views_ventas.ver_carrito, name='ver_carrito'),
    path('carrito/vaciar', views_ventas.vaciar_carrito, name='vaciar_carrito'),
    path('cupones/validar', limitar('cupon', 15, 600, 'fallos')(views_ventas.previsualizar_cupon), name='previsualizar_cupon'),
    path('carrito/eliminar/<int:item_id>', views_ventas.eliminar_item_carrito, name='eliminar_item_carrito'),
    path('carrito/restar/<int:item_id>', views_ventas.restar_item_carrito, name='restar_item_carrito'),

    # --- WEBPAY ---
    path('webpay/iniciar', limitar('pago', 10, 600)(views_webpay.iniciar_pago), name='webpay_iniciar'),
    path('webpay/confirmar', views_webpay.confirmar_pago, name='webpay_confirmar'),

    # --- FINANZAS Y DASHBOARD ---
    path('dashboard/metricas', views_dashboard.obtener_dashboard, name='obtener_dashboard'),
    path('dashboard/reporte-pdf', views_dashboard.exportar_reporte_pdf, name='exportar_reporte_pdf'),
    path('finanzas/egresos/crear', views_dashboard.registrar_egreso, name='registrar_egreso'),
    path('finanzas/egresos/listar', views_dashboard.listar_egresos, name='listar_egresos'),

    # --- PANEL DE ADMINISTRACIÓN ---
    path('panel/acceso', limitar('panel', 20, 600, 'fallos')(views_panel.panel_acceso), name='panel_acceso'),
    path('panel/estado', views_panel.panel_estado, name='panel_estado'),
    path('panel/categorias', views_panel.panel_categorias, name='panel_categorias'),
    path('panel/categorias/guardar', views_panel.guardar_categoria, name='panel_guardar_categoria'),
    path('panel/categorias/<int:categoria_id>', views_panel.eliminar_categoria, name='panel_eliminar_categoria'),
    path('panel/productos', views_panel.panel_productos, name='panel_productos'),
    path('panel/productos/<int:producto_id>/imagenes', views_panel.agregar_imagenes, name='panel_agregar_imagenes'),
    path('panel/imagenes/<int:imagen_id>', views_panel.eliminar_imagen, name='panel_eliminar_imagen'),
    path('panel/cupones', views_panel.panel_cupones, name='panel_cupones'),
    path('panel/cupones/guardar', views_panel.guardar_cupon, name='panel_guardar_cupon'),
    path('panel/auditoria', views_panel.panel_auditoria, name='panel_auditoria'),

    # -- prueba token --
    path('api/prueba-token', views_usuarios.prueba_token_jwt, name='prueba_token'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)