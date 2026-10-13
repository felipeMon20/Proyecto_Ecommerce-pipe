from django.contrib import admin
from .models import Producto, Categoria, ImagenProducto, Venta, DetalleVenta, Cupon, Codigo2FA

# Esto hace que aparezcan en el panel http://127.0.0.1:8000/admin/
admin.site.register(Producto)
admin.site.register(Categoria)
admin.site.register(ImagenProducto)
admin.site.register(Venta)
admin.site.register(DetalleVenta)
admin.site.register(Cupon)  # <--- IMPORTANTE: Para crear cupones
admin.site.register(Codigo2FA)