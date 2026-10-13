from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', include('gestion.urls')),
]

# El panel de Django no usa el 2FA de la tienda, por eso solo existe si se activa a propósito y bajo la ruta secreta
if settings.DJANGO_ADMIN_ACTIVO:
    urlpatterns.insert(0, path(f'{settings.PANEL_RUTA}-django/', admin.site.urls))

# ESTO PERMITE VER LAS IMÁGENES EN MODO DESARROLLO
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
