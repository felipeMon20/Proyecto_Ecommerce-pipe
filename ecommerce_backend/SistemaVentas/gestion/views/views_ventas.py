from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from ..models import Producto, Venta, DetalleVenta, Carrito, ItemCarrito, HistorialEstadoVenta
from ..errores import error_interno
from ..permisos import requiere_staff
from ..cupones import validar_cupon
from .views_panel import auditar
from ..reservas import mensaje_sin_disponible, reservas_por_producto, stock_reservado
import json


class ErrorVenta(Exception):
    """ Mensaje pensado para mostrarse al vendedor """

# ----------------------------------------------------
#  SECCIÓN 1: GESTIÓN DE CARRITO (ID 6)
# ----------------------------------------------------

@csrf_exempt
def agregar_carrito(request):
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)
        
        try:
            data = json.loads(request.body)
            producto_id = data.get('producto_id')
            cantidad = int(data.get('cantidad', 1))

            if cantidad < 1:
                return JsonResponse({'error': 'La cantidad debe ser mayor a 0'}, status=400)

            carrito, created = Carrito.objects.get_or_create(usuario=request.user)
            prod = Producto.objects.get(id=producto_id)
            
            if prod.stock < cantidad:
                return JsonResponse({'error': 'No hay suficiente stock'}, status=400)

            reservado = stock_reservado(prod.id, request.user)
            disponible = prod.stock - reservado

            item, item_created = ItemCarrito.objects.get_or_create(
                carrito=carrito,
                producto=prod,
                defaults={'cantidad': 0}
            )

            item.cantidad += cantidad
            if disponible < item.cantidad:
                if item_created:
                    item.delete()
                if reservado:
                    return JsonResponse({'error': mensaje_sin_disponible(prod.nombre, disponible)}, status=400)
                return JsonResponse({'error': f'Stock insuficiente. Máximo: {prod.stock}'}, status=400)

            item.save()

            return JsonResponse({
                'mensaje': 'Producto agregado', 
                'total_items': carrito.items.count()
            })

        except Producto.DoesNotExist:
            return JsonResponse({'error': 'Producto no encontrado'}, status=404)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Datos inválidos'}, status=400)
        except Exception:
            return JsonResponse({'error': 'No se pudo agregar el producto'}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def ver_carrito(request):
    if request.method == 'GET':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)

        try:
            carrito = Carrito.objects.get(usuario=request.user)
            items = carrito.items.all()
            reservas = reservas_por_producto(request.user)
            lista_items = []
            total_estimado = 0

            for i in items:
                subtotal = i.producto.precio * i.cantidad
                total_estimado += subtotal
                foto = i.producto.imagenes.first().imagen.url if i.producto.imagenes.exists() else None

                lista_items.append({
                    'item_id': i.id,
                    'producto_id': i.producto.id,
                    'nombre': i.producto.nombre,
                    'precio': i.producto.precio,
                    'cantidad': i.cantidad,
                    'subtotal': subtotal,
                    'stock': i.producto.stock,
                    'disponible': max(i.producto.stock - reservas.get(i.producto.id, 0), 0),
                    'imagen': foto
                })

            return JsonResponse({'items': lista_items, 'total_estimado': total_estimado})

        except Carrito.DoesNotExist:
            return JsonResponse({'items': [], 'total_estimado': 0})
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def eliminar_item_carrito(request, item_id):
    if request.method == 'DELETE':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)
        try:
            item = ItemCarrito.objects.get(id=item_id, carrito__usuario=request.user)
            item.delete()
            return JsonResponse({'mensaje': 'Producto eliminado del carrito'})
        except ItemCarrito.DoesNotExist:
            return JsonResponse({'error': 'Item no encontrado'}, status=404)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def restar_item_carrito(request, item_id):
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)
        items = ItemCarrito.objects.filter(id=item_id, carrito__usuario=request.user)
        if not items.exists():
            return JsonResponse({'error': 'Item no encontrado'}, status=404)

        # La resta es atómica: con clics repetidos nunca baja de 1 unidad
        actualizados = items.filter(cantidad__gt=1).update(cantidad=F('cantidad') - 1)
        if not actualizados:
            return JsonResponse({'error': 'Debe quedar al menos una unidad. Usa Quitar para eliminar el producto.'}, status=400)

        return JsonResponse({'mensaje': 'Unidad descartada', 'cantidad': items.first().cantidad})
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def previsualizar_cupon(request):
    """ Calcula el descuento de un cupón sobre el carrito del usuario, sin usarlo """
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)
    try:
        data = json.loads(request.body)
    except ValueError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    carrito = Carrito.objects.filter(usuario=request.user).first()
    total = sum(i.producto.precio * i.cantidad for i in carrito.items.select_related('producto')) if carrito else 0

    cupon, descuento, error = validar_cupon(data.get('codigo'), request.user, total)
    if error:
        return JsonResponse({'error': error}, status=400)
    return JsonResponse({
        'codigo': cupon.codigo,
        'porcentaje': min(max(cupon.descuento_porcentaje, 0), 100),
        'descuento': descuento,
    })


@csrf_exempt
def vaciar_carrito(request):
    if request.method == 'DELETE':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)
        try:
            carrito = Carrito.objects.get(usuario=request.user)
            carrito.items.all().delete()
            return JsonResponse({'mensaje': 'Carrito vaciado'})
        except Carrito.DoesNotExist:
            return JsonResponse({'mensaje': 'El carrito ya estaba vacío'})
    return JsonResponse({'error': 'Método no permitido'}, status=405)


# ----------------------------------------------------
#  SECCIÓN 2: HISTORIAL Y BITÁCORA (ID 9)
# ----------------------------------------------------

def ver_historial_venta(request, venta_id):
    if request.method == 'GET':
        if not request.user.is_staff:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)
        
        logs = HistorialEstadoVenta.objects.filter(venta_id=venta_id).order_by('-fecha_cambio')
        resultado = []
        for log in logs:
            resultado.append({
                'estado_anterior': log.estado_anterior or 'Inicio',
                'estado_nuevo': log.estado_nuevo,
                'fecha': log.fecha_cambio.strftime("%Y-%m-%d %H:%M:%S"),
                'responsable': log.usuario_responsable.username if log.usuario_responsable else 'Sistema'
            })
            
        return JsonResponse({'venta_id': venta_id, 'historial': resultado})
    return JsonResponse({'error': 'Método no permitido'}, status=405)


# ----------------------------------------------------
#  SECCIÓN 3: VENTAS Y POS
# ----------------------------------------------------

@csrf_exempt
@requiere_staff
def registrar_venta(request):
    """
    ENDPOINT DE VENTA MANUAL (POS)
    Se usa cuando el Vendedor está en la tienda física.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            items = data.get('items', [])

            if not items:
                return JsonResponse({'error': 'El carrito está vacío'}, status=400)

            with transaction.atomic():
                # Si hay usuario logueado (Vendedor o Cliente), lo guardamos
                usuario_actual = request.user if request.user.is_authenticated else None
                
                nueva_venta = Venta.objects.create(
                    fecha_compra=timezone.now(),
                    total=0,
                    estado='pagado', # Venta manual asume pago inmediato
                    usuario=usuario_actual
                )

                total_acumulado = 0

                for item in items:
                    prod_id = item.get('producto_id')
                    cantidad = item.get('cantidad')

                    if not prod_id or not isinstance(cantidad, int) or cantidad <= 0:
                        raise ErrorVenta('Hay un producto con datos inválidos')

                    producto = Producto.objects.select_for_update().get(id=prod_id)

                    if producto.stock < cantidad:
                        raise ErrorVenta(f"Stock insuficiente para '{producto.nombre}' (quedan {producto.stock})")

                    producto.stock -= cantidad
                    producto.save()

                    subtotal = producto.precio * cantidad
                    total_acumulado += subtotal

                    DetalleVenta.objects.create(
                        venta=nueva_venta,
                        producto=producto,
                        cantidad=cantidad,
                        precio_unitario=producto.precio,
                        subtotal=subtotal
                    )

                nueva_venta.total = total_acumulado
                nueva_venta.save()

            auditar(request, 'Venta de mostrador', f'Venta #{nueva_venta.id} por ${total_acumulado}')
            return JsonResponse({
                'mensaje': 'Venta registrada exitosamente',
                'id_venta': nueva_venta.id,
                'total_pagado': total_acumulado
            })

        except Producto.DoesNotExist:
            return JsonResponse({'error': 'Uno de los productos no existe'}, status=404)
        except ErrorVenta as e:
            return JsonResponse({'error': str(e)}, status=400)
        except Exception as e:
            return error_interno(400)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

def listar_ventas(request):
    """ Historial Global (Solo para Admins y Vendedores) """
    if request.method == 'GET':
        if not request.user.is_staff: # Solo staff puede ver todo el historial
            return JsonResponse({'error': 'Acceso denegado'}, status=403)

        ventas = Venta.objects.all().order_by('-fecha_compra')
        return _formatear_respuesta_ventas(ventas)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

def mis_compras(request):
    """ Para clientes web: ver sus propias compras """
    if request.method == 'GET':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)

        mis_ventas = Venta.objects.filter(usuario=request.user).order_by('-fecha_compra')
        return _formatear_respuesta_ventas(mis_ventas)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def cancelar_compra(request, venta_id):
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)

        try:
            venta = Venta.objects.get(id=venta_id, usuario=request.user)
            if venta.estado != 'pendiente':
                return JsonResponse({'error': f'No puedes cancelar venta en estado {venta.estado}'}, status=400)
            
            venta.estado = 'anulado'
            venta.save() # Dispara la señal de historial
            
            return JsonResponse({'mensaje': 'Compra cancelada', 'id': venta.id})

        except Venta.DoesNotExist:
            return JsonResponse({'error': 'Venta no encontrada'}, status=404)
        except Exception as e:
            return error_interno(500)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- FORMATO INTELIGENTE DE RESPUESTA ---
def _formatear_respuesta_ventas(ventas_queryset):
    resultado = []
    for v in ventas_queryset:
        detalles = []
        for d in v.detalleventa_set.all():
            detalles.append({
                'producto': d.producto.nombre,
                'cantidad': d.cantidad,
                'precio_unit': d.precio_unitario,
                'subtotal': d.subtotal,
                'imagen': d.producto.imagenes.first().imagen.url if d.producto.imagenes.exists() else None
            })
        
        # LÓGICA: ¿Quién hizo la transacción?
        rol_transaccion = "Cliente Web"
        responsable_email = "invitado@anonimo.cl"
        responsable_nombre = "Invitado"

        if v.usuario:
            responsable_email = v.usuario.email
            responsable_nombre = v.usuario.username
            
            # SI EL USUARIO ES STAFF, ENTONCES FUE UNA VENTA DE MOSTRADOR
            if v.usuario.is_staff:
                rol_transaccion = "Vendedor (POS)"
                responsable_nombre = f"{v.usuario.first_name} ({v.usuario.username})"

        resultado.append({
            'id': v.id,
            'fecha': v.fecha_compra.strftime("%Y-%m-%d %H:%M"),
            'total': v.total,
            'estado': v.estado,
            'tipo_operacion': rol_transaccion,   # <--- NUEVO CAMPO
            'responsable': responsable_nombre,   # <--- AHORA MUESTRA NOMBRE REAL
            'email_contacto': responsable_email, # <--- CORREO DEL VENDEDOR/CLIENTE
            'items': detalles,
            'historial': [
                {'estado': h.estado_nuevo, 'fecha': h.fecha_cambio.strftime("%Y-%m-%d %H:%M")}
                for h in v.historial_estados.order_by('fecha_cambio', 'id')
            ],
            'envio': v.costo_envio,
            'descuento': v.descuento_aplicado,
            'cupon': v.cupon_usado,
            'region': v.region,
            'direccion': {
                'nombre': v.direccion_nombre,
                'telefono': v.direccion_telefono,
                'calle': v.direccion_calle,
                'numero': v.direccion_numero,
                'complemento': v.direccion_complemento,
                'comuna': v.direccion_comuna,
                'indicaciones': v.direccion_indicaciones,
            },
        })
    return JsonResponse({'ventas': resultado}, safe=False)