import os
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.dispatch import receiver
from django.db.models.signals import post_delete, pre_save, post_save

# REQ-16: Gestión de Categorías
class Categoria(models.Model):
    nombre = models.CharField(max_length=50)
    
    def __str__(self):
        return self.nombre

# REQ-07: CRUD de Productos
class Producto(models.Model):
    nombre = models.CharField(max_length=100)
    marca = models.CharField(max_length=50, null=True, blank=True)
    codigo = models.CharField(max_length=50, unique=True) 
    precio = models.IntegerField() 
    stock = models.IntegerField(default=0)
    descripcion = models.TextField(blank=True, null=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.RESTRICT, null=True)
    
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} ({self.stock})"

class ImagenProducto(models.Model):
    producto = models.ForeignKey(Producto, related_name='imagenes', on_delete=models.CASCADE)
    imagen = models.ImageField(upload_to='productos/')
    
    def __str__(self):
        return f"Imagen de {self.producto.nombre}"

# --- CUPONES (ID 26) ---
class Cupon(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    descuento_porcentaje = models.IntegerField(help_text="Porcentaje de descuento (0-100)")
    fecha_expiracion = models.DateTimeField()
    activo = models.BooleanField(default=True)
    usos_maximos = models.IntegerField(null=True, blank=True, help_text="Total de usos permitidos entre todos los clientes; vacío = sin tope")
    usos_por_usuario = models.IntegerField(null=True, blank=True, default=1, help_text="Cuántas veces puede usarlo cada cliente; vacío = sin tope")

    def __str__(self):
        return f"{self.codigo} ({self.descuento_porcentaje}%)"

# --- VENTA (ID 9) ---
class Venta(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    fecha_compra = models.DateTimeField(default=timezone.now)
    total = models.IntegerField(default=0)
    
    region = models.CharField(max_length=100, default='RM')
    costo_envio = models.IntegerField(default=0)

    direccion_nombre = models.CharField(max_length=100, blank=True, default='')
    direccion_telefono = models.CharField(max_length=30, blank=True, default='')
    direccion_calle = models.CharField(max_length=150, blank=True, default='')
    direccion_numero = models.CharField(max_length=20, blank=True, default='')
    direccion_complemento = models.CharField(max_length=60, blank=True, default='')
    direccion_comuna = models.CharField(max_length=80, blank=True, default='')
    direccion_indicaciones = models.CharField(max_length=255, blank=True, default='')
    
    cupon_usado = models.CharField(max_length=50, null=True, blank=True)
    descuento_aplicado = models.IntegerField(default=0)

    codigo_comprobante = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('pagado', 'Pagado'),
        ('rechazado', 'Rechazado'),
        ('anulado', 'Anulado'),
    ]
    estado = models.CharField(max_length=20, choices=ESTADOS, default='pendiente')

class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.IntegerField()
    precio_unitario = models.IntegerField()
    subtotal = models.IntegerField()

# --- HISTORIAL DE ESTADOS (ID 9) ---
class HistorialEstadoVenta(models.Model):
    venta = models.ForeignKey(Venta, related_name='historial_estados', on_delete=models.CASCADE)
    estado_anterior = models.CharField(max_length=20, null=True, blank=True)
    estado_nuevo = models.CharField(max_length=20)
    fecha_cambio = models.DateTimeField(default=timezone.now)
    usuario_responsable = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Venta #{self.venta.id}: {self.estado_anterior} -> {self.estado_nuevo}"

# --- CARRITO (ID 6) ---
class Carrito(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

class ItemCarrito(models.Model):
    carrito = models.ForeignKey(Carrito, related_name='items', on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad = models.IntegerField(default=1)

# --- OTROS MODELOS ---
class Codigo2FA(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    codigo = models.CharField(max_length=6)
    creado_en = models.DateTimeField(auto_now_add=True)

class PerfilSeguridad(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    intentos_fallidos = models.IntegerField(default=0)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)

class Egreso(models.Model):
    descripcion = models.CharField(max_length=255)
    monto = models.IntegerField()
    fecha = models.DateTimeField(default=timezone.now)
    categoria = models.CharField(max_length=100, null=True, blank=True)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

class Valoracion(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='valoraciones')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    estrellas = models.IntegerField(choices=[(i, str(i)) for i in range(1, 6)])
    comentario = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)

# --- NUEVO: AUDITORÍA (ID 22) ---
class AuditLog(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    accion = models.CharField(max_length=100) # Ej: "Descargar Reporte", "Borrar Producto"
    detalle = models.TextField(null=True, blank=True) # Detalles técnicos
    fecha = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.fecha}] {self.usuario}: {self.accion}"

# -----------------------------------------------------------
#  SEÑALES (SIGNALS)
# -----------------------------------------------------------

@receiver(post_delete, sender=ImagenProducto)
def eliminar_archivo_imagen(sender, instance, **kwargs):
    if instance.imagen and os.path.isfile(instance.imagen.path):
        try:
            os.remove(instance.imagen.path)
        except Exception:
            pass

# AUDITORÍA AUTOMÁTICA AL BORRAR PRODUCTO (ID 22)
@receiver(post_delete, sender=Producto)
def auditar_eliminacion_producto(sender, instance, **kwargs):
    AuditLog.objects.create(
        usuario=None, # Accion del sistema o admin directo
        accion="Eliminar Producto",
        detalle=f"Se eliminó el producto '{instance.nombre}' (SKU: {instance.codigo})"
    )

# Historial de Ventas (Updates)
@receiver(pre_save, sender=Venta)
def registrar_cambio_estado_update(sender, instance, **kwargs):
    if instance.pk: 
        try:
            venta_antigua = Venta.objects.get(pk=instance.pk)
            if venta_antigua.estado != instance.estado:
                HistorialEstadoVenta.objects.create(
                    venta=instance, 
                    estado_anterior=venta_antigua.estado,
                    estado_nuevo=instance.estado,
                    fecha_cambio=timezone.now()
                )
        except Venta.DoesNotExist:
            pass

# Historial de Ventas (Creates)
@receiver(post_save, sender=Venta)
def registrar_cambio_estado_create(sender, instance, created, **kwargs):
    if created: 
        HistorialEstadoVenta.objects.create(
            venta=instance, 
            estado_anterior=None,
            estado_nuevo=instance.estado,
            fecha_cambio=timezone.now()
        )

class PerfilCliente(models.Model):
    """ Datos de contacto y entrega que el cliente guarda para no repetirlos en cada compra """
    user = models.OneToOneField(User, related_name='perfil_cliente', on_delete=models.CASCADE)
    region = models.CharField(max_length=100, default='RM')
    direccion_nombre = models.CharField(max_length=100, blank=True, default='')
    direccion_telefono = models.CharField(max_length=30, blank=True, default='')
    direccion_calle = models.CharField(max_length=150, blank=True, default='')
    direccion_numero = models.CharField(max_length=20, blank=True, default='')
    direccion_complemento = models.CharField(max_length=60, blank=True, default='')
    direccion_comuna = models.CharField(max_length=80, blank=True, default='')
    direccion_indicaciones = models.CharField(max_length=255, blank=True, default='')

    def __str__(self):
        return f"Perfil de {self.user.username}"
