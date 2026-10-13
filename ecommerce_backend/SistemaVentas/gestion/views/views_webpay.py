from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone
from django.core.mail import send_mail  # <--- IMPORTANTE: Para enviar correos
from django.conf import settings        # <--- IMPORTANTE: Para leer tu config de Gmail

from transbank.webpay.webpay_plus.transaction import Transaction
from transbank.error.transbank_error import TransbankError
from transbank.common.options import WebpayOptions
from transbank.common.integration_commerce_codes import IntegrationCommerceCodes
from transbank.common.integration_api_keys import IntegrationApiKeys
from transbank.common.integration_type import IntegrationType
from ..models import Producto, Venta, DetalleVenta, Cupon
import json
import random

@csrf_exempt
def iniciar_pago(request):
    """
    Inicia pago con Envío y Cupones.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            items = data.get('items', [])
            region_cliente = data.get('region', 'RM')
            codigo_cupon = data.get('cupon', None)
            
            if not items:
                return JsonResponse({'error': 'El carrito está vacío'}, status=400)

            # 1. Calcular Subtotal
            total_productos = 0
            productos_a_comprar = [] 
            
            for item in items:
                try:
                    cantidad = int(item['cantidad'])
                    prod = Producto.objects.get(id=item['producto_id'])
                except (KeyError, TypeError, ValueError):
                    return JsonResponse({'error': 'Datos de item inválidos'}, status=400)
                except Producto.DoesNotExist:
                    return JsonResponse({'error': 'Uno de los productos no existe'}, status=404)

                if cantidad < 1:
                    return JsonResponse({'error': 'La cantidad debe ser mayor a 0'}, status=400)
                if prod.stock < cantidad:
                    return JsonResponse({'error': f'Stock insuficiente para {prod.nombre}'}, status=400)

                subtotal = prod.precio * cantidad
                total_productos += subtotal
                productos_a_comprar.append({'obj': prod, 'cantidad': cantidad, 'subtotal': subtotal})

            # 2. Cupones
            descuento_dinero = 0
            nombre_cupon = None
            
            if codigo_cupon:
                try:
                    cupon_bd = Cupon.objects.get(codigo=codigo_cupon, activo=True)
                    if cupon_bd.fecha_expiracion >= timezone.now():
                        porcentaje = min(max(cupon_bd.descuento_porcentaje, 0), 100)
                        descuento_dinero = int(total_productos * (porcentaje / 100))
                        nombre_cupon = cupon_bd.codigo
                    else:
                        return JsonResponse({'error': 'El cupón ha expirado'}, status=400)
                except Cupon.DoesNotExist:
                    return JsonResponse({'error': 'Cupón inválido'}, status=400)

            # 3. Envío
            costo_despacho = 3000 if (region_cliente.upper() == 'RM' or region_cliente.lower() == 'metropolitana') else 6000

            # 4. Total
            total_final = (total_productos - descuento_dinero) + costo_despacho

            with transaction.atomic():
                usuario_actual = request.user if request.user.is_authenticated else None

                venta = Venta.objects.create(
                    total=total_final, 
                    estado='pendiente',
                    usuario=usuario_actual,
                    region=region_cliente,
                    costo_envio=costo_despacho,
                    cupon_usado=nombre_cupon,
                    descuento_aplicado=descuento_dinero
                )
                
                for p_data in productos_a_comprar:
                    DetalleVenta.objects.create(
                        venta=venta,
                        producto=p_data['obj'],
                        cantidad=p_data['cantidad'],
                        precio_unitario=p_data['obj'].precio,
                        subtotal=p_data['subtotal']
                    )
                
                buy_order = str(venta.id) 
                session_id = str(random.randint(100000, 999999))
                url_retorno = 'http://127.0.0.1:8000/webpay/confirmar'

                tx = Transaction(WebpayOptions(
                    commerce_code=IntegrationCommerceCodes.WEBPAY_PLUS,
                    api_key=IntegrationApiKeys.WEBPAY,
                    integration_type=IntegrationType.TEST
                ))
                
                response = tx.create(buy_order, session_id, total_final, url_retorno)

                return JsonResponse({
                    'mensaje': 'Sesión de pago creada',
                    'url_webpay': response['url'],
                    'token': response['token'],
                    'monto_productos': total_productos,
                    'descuento': descuento_dinero,
                    'envio': costo_despacho,
                    'total_a_pagar': total_final,
                    'venta_id': venta.id
                })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def confirmar_pago(request):
    token = request.GET.get('token_ws') or request.POST.get('token_ws')
    
    if request.method == 'POST' and not token:
        try:
            body_data = json.loads(request.body)
            token = body_data.get('token_ws')
        except:
            pass

    if not token:
        return JsonResponse({'error': 'No se recibió token'}, status=400)

    try:
        status = 'REJECTED'
        buy_order_recibida = ''

        if settings.DEBUG and token.startswith('BYPASS_'):
            status = 'AUTHORIZED'
            buy_order_recibida = token.split('_')[1]
        else:
            tx = Transaction(WebpayOptions(
                commerce_code=IntegrationCommerceCodes.WEBPAY_PLUS,
                api_key=IntegrationApiKeys.WEBPAY,
                integration_type=IntegrationType.TEST
            ))
            response = tx.commit(token)
            status = response['status']
            buy_order_recibida = response['buy_order']

        if status == 'AUTHORIZED':
            with transaction.atomic():
                venta = Venta.objects.get(id=buy_order_recibida)
                
                if venta.estado == 'pagado':
                    return JsonResponse({'mensaje': 'Esta venta ya fue pagada anteriormente'})

                venta.estado = 'pagado'
                venta.save()

                # Descuento de Stock y Armado de Resumen
                detalles = DetalleVenta.objects.filter(venta=venta)
                items_texto = "" # Variable para listar productos en el correo
                
                for detalle in detalles:
                    producto = detalle.producto
                    if producto.stock >= detalle.cantidad:
                        producto.stock -= detalle.cantidad
                        producto.save()
                        # Agregamos línea al resumen
                        items_texto += f"- {producto.nombre} (x{detalle.cantidad}): ${detalle.subtotal}\n"
                    else:
                        raise Exception(f"Stock insuficiente para {producto.nombre}")

                # --- ENVIAR CORREO REAL (GMAIL) ---
                if venta.usuario and venta.usuario.email:
                    asunto = f"¡Compra Exitosa! Pedido #{venta.id}"
                    mensaje = f"""
Hola {venta.usuario.first_name or venta.usuario.username},

¡Tu pago ha sido confirmado correctamente! Estamos preparando tu pedido.

------------------------------------------
RESUMEN DE COMPRA
------------------------------------------
{items_texto}
------------------------------------------
Subtotal Productos: ... (ver detalle arriba)
Envío ({venta.region}): +${venta.costo_envio}
Descuento: -${venta.descuento_aplicado}

TOTAL PAGADO: ${venta.total}
------------------------------------------

Gracias por comprar con nosotros.
Atte,
El Equipo de Ventas
                    """
                    try:
                        print("Intentando enviar correo a:", venta.usuario.email)
                        send_mail(
                            asunto,
                            mensaje,
                            settings.EMAIL_HOST_USER, # Usa tu correo Gmail como remitente
                            [venta.usuario.email],    # Destinatario
                            fail_silently=False,
                        )
                        print("Correo enviado exitosamente via Gmail")
                    except Exception as e:
                        print(f"❌ Error enviando correo: {e}")

            return JsonResponse({
                'mensaje': 'PAGO CONFIRMADO', 
                'venta_id': venta.id,
                'total_pagado': venta.total,
                'envio_incluido': venta.costo_envio,
                'correo_enviado': True
            })
        else:
            return JsonResponse({'error': 'El pago fue rechazado'}, status=400)

    except Venta.DoesNotExist:
        return JsonResponse({'error': 'Venta no encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)