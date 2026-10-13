import json
import logging
import secrets
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import send_mail
from django.db import transaction
from django.http import HttpResponseRedirect, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from transbank.webpay.webpay_plus.transaction import Transaction
from transbank.error.transbank_error import TransbankError
from transbank.common.options import WebpayOptions
from transbank.common.integration_commerce_codes import IntegrationCommerceCodes
from transbank.common.integration_api_keys import IntegrationApiKeys
from transbank.common.integration_type import IntegrationType
from ..models import Producto, Venta, DetalleVenta, ItemCarrito, AuditLog
from ..cupones import validar_cupon
from ..reservas import mensaje_sin_disponible, reservas_por_producto

logger = logging.getLogger(__name__)


class StockInsuficiente(Exception):
    pass


def _transaccion():
    """ Integración por defecto; producción solo si hay credenciales propias """
    if settings.WEBPAY_AMBIENTE == 'produccion':
        if not (settings.WEBPAY_COMMERCE_CODE and settings.WEBPAY_API_KEY):
            raise ImproperlyConfigured('Webpay en producción requiere WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY')
        opciones = WebpayOptions(settings.WEBPAY_COMMERCE_CODE, settings.WEBPAY_API_KEY, IntegrationType.LIVE)
    else:
        opciones = WebpayOptions(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, IntegrationType.TEST)
    return Transaction(opciones)


def _redirigir(estado, venta_id=None):
    """ Devuelve al navegador a la tienda con el resultado del pago """
    params = {'estado': estado}
    if venta_id:
        params['venta'] = venta_id
    return HttpResponseRedirect(f'{settings.FRONTEND_URL}/pago/resultado?{urlencode(params)}')


def _cambiar_estado(venta, estado):
    venta.estado = estado
    venta.save(update_fields=['estado'])


CAMPOS_DIRECCION = [
    # clave del body, campo de Venta, etiqueta, largo máximo, obligatorio
    ('nombre', 'direccion_nombre', 'el nombre de quien recibe', 100, True),
    ('telefono', 'direccion_telefono', 'el teléfono de contacto', 30, True),
    ('calle', 'direccion_calle', 'la calle', 150, True),
    ('numero', 'direccion_numero', 'el número', 20, True),
    ('complemento', 'direccion_complemento', 'el departamento o casa', 60, False),
    ('comuna', 'direccion_comuna', 'la comuna', 80, True),
    ('indicaciones', 'direccion_indicaciones', 'las indicaciones', 255, False),
]


def _leer_direccion(data):
    """ Valida la dirección de entrega y devuelve (campos_de_venta, error) """
    direccion = data.get('direccion')
    if not isinstance(direccion, dict):
        return None, 'Falta la dirección de entrega'

    campos = {}
    for clave, campo, etiqueta, largo, obligatorio in CAMPOS_DIRECCION:
        valor = ' '.join(str(direccion.get(clave) or '').split())
        if obligatorio and not valor:
            return None, f'Falta {etiqueta}'
        if len(valor) > largo:
            return None, f'Es demasiado largo {etiqueta}'
        campos[campo] = valor

    digitos = [c for c in campos['direccion_telefono'] if c.isdigit()]
    if len(digitos) < 8 or len(digitos) > 12:
        return None, 'El teléfono de contacto no es válido'
    return campos, None


@csrf_exempt
def iniciar_pago(request):
    """ Crea la venta pendiente y la sesión de pago en Webpay """
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)

    try:
        data = json.loads(request.body)
    except ValueError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    items = data.get('items', [])
    region_cliente = str(data.get('region', 'RM'))
    codigo_cupon = data.get('cupon', None)

    if not items:
        return JsonResponse({'error': 'El carrito está vacío'}, status=400)

    campos_direccion, error_direccion = _leer_direccion(data)
    if error_direccion:
        return JsonResponse({'error': error_direccion}, status=400)

    total_productos = 0
    productos_a_comprar = []
    acumulado = {}

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

        acumulado[prod.pk] = acumulado.get(prod.pk, 0) + cantidad

        subtotal = prod.precio * cantidad
        total_productos += subtotal
        productos_a_comprar.append({'obj': prod, 'cantidad': cantidad, 'subtotal': subtotal})

    descuento_dinero = 0
    nombre_cupon = None

    if codigo_cupon:
        cupon_bd, descuento_dinero, error_cupon = validar_cupon(codigo_cupon, request.user, total_productos)
        if error_cupon:
            return JsonResponse({'error': error_cupon}, status=400)
        nombre_cupon = cupon_bd.codigo

    en_rm = region_cliente.upper() == 'RM' or region_cliente.lower() == 'metropolitana'
    costo_despacho = 3000 if en_rm else 6000
    total_final = (total_productos - descuento_dinero) + costo_despacho

    try:
        with transaction.atomic():
            # Con los productos bloqueados se revisa y se aparta el stock sin que otro pago se cuele
            bloqueados = {p.pk: p for p in Producto.objects.select_for_update().filter(pk__in=list(acumulado))}
            reservas = reservas_por_producto(request.user, list(acumulado))
            for pk, cantidad in acumulado.items():
                prod = bloqueados[pk]
                if prod.stock < cantidad:
                    raise StockInsuficiente(f'Stock insuficiente para {prod.nombre}')
                disponible = prod.stock - reservas.get(pk, 0)
                if disponible < cantidad:
                    raise StockInsuficiente(mensaje_sin_disponible(prod.nombre, disponible))

            venta = Venta.objects.create(
                total=total_final,
                estado='pendiente',
                usuario=request.user if request.user.is_authenticated else None,
                region=region_cliente,
                costo_envio=costo_despacho,
                cupon_usado=nombre_cupon,
                descuento_aplicado=descuento_dinero,
                **campos_direccion
            )

            for p_data in productos_a_comprar:
                DetalleVenta.objects.create(
                    venta=venta,
                    producto=p_data['obj'],
                    cantidad=p_data['cantidad'],
                    precio_unitario=p_data['obj'].precio,
                    subtotal=p_data['subtotal']
                )
    except StockInsuficiente as e:
        return JsonResponse({'error': str(e)}, status=400)

    # La llamada a Webpay va fuera de la transacción para no mantener bloqueada la base mientras se espera
    try:
        session_id = str(secrets.randbelow(900000) + 100000)
        respuesta = _transaccion().create(str(venta.id), session_id, total_final, settings.WEBPAY_RETURN_URL)

        # El token queda en la venta para validar el retorno de Webpay
        venta.codigo_comprobante = respuesta['token']
        venta.save(update_fields=['codigo_comprobante'])
    except TransbankError:
        _cambiar_estado(venta, 'anulado')
        logger.exception('Webpay rechazó la creación de la transacción')
        return JsonResponse({'error': 'No se pudo iniciar el pago. Intenta más tarde.'}, status=502)
    except ImproperlyConfigured:
        _cambiar_estado(venta, 'anulado')
        logger.exception('Webpay mal configurado')
        return JsonResponse({'error': 'Pagos no disponibles'}, status=503)

    return JsonResponse({
        'mensaje': 'Sesión de pago creada',
        'url_webpay': respuesta['url'],
        'token': respuesta['token'],
        'monto_productos': total_productos,
        'descuento': descuento_dinero,
        'envio': costo_despacho,
        'total_a_pagar': total_final,
        'venta_id': venta.id
    })


@csrf_exempt
def confirmar_pago(request):
    """ Retorno de Webpay: confirma, rechaza o cancela y redirige a la tienda """
    if request.method not in ('GET', 'POST'):
        return JsonResponse({'error': 'Método no permitido'}, status=405)

    params = {**request.GET.dict(), **request.POST.dict()}
    token = params.get('token_ws')
    token_abortado = params.get('TBK_TOKEN')

    # Pago abortado por el usuario o error en el formulario de Webpay
    if token_abortado:
        venta = Venta.objects.filter(codigo_comprobante=token_abortado, estado='pendiente').first()
        if venta:
            _cambiar_estado(venta, 'anulado')
        return _redirigir('cancelado', venta.id if venta else None)

    # Tiempo agotado en Webpay: no llega ningún token y la venta queda pendiente
    if not token:
        return _redirigir('cancelado')

    if settings.DEBUG and token.startswith('BYPASS_'):
        return _confirmar_bypass(token)

    venta = Venta.objects.filter(codigo_comprobante=token).first()
    if not venta:
        return _redirigir('error')
    if venta.estado == 'pagado':
        return _redirigir('exito', venta.id)
    if venta.estado != 'pendiente':
        return _redirigir('rechazado', venta.id)

    # Si ya no hay stock se rechaza antes de confirmar, así no se cobra
    if _hay_faltante_de_stock(venta):
        _cambiar_estado(venta, 'rechazado')
        return _redirigir('rechazado', venta.id)

    try:
        respuesta = _transaccion().commit(token)
    except (TransbankError, ImproperlyConfigured):
        logger.exception('Fallo el commit de Webpay para la venta %s', venta.pk)
        venta.refresh_from_db()
        if venta.estado == 'pagado':
            return _redirigir('exito', venta.id)
        return _redirigir('error', venta.id)

    autorizado = respuesta.get('status') == 'AUTHORIZED' and respuesta.get('response_code') == 0
    if not autorizado:
        _cambiar_estado(venta, 'rechazado')
        return _redirigir('rechazado', venta.id)

    monto_cobrado = respuesta.get('amount')
    if str(respuesta.get('buy_order')) != str(venta.pk) or monto_cobrado != venta.total:
        logger.error('Datos de Webpay no coinciden con la venta %s', venta.pk)
        _reembolsar(venta, token, monto_cobrado, 'datos de Webpay no coinciden con la venta')
        return _redirigir('error', venta.id)

    try:
        _marcar_pagada(venta)
    except StockInsuficiente:
        _reembolsar(venta, token, monto_cobrado, 'stock insuficiente después del cobro')
        return _redirigir('rechazado', venta.id)

    _enviar_correo_compra(venta)
    return _redirigir('exito', venta.id)


def _confirmar_bypass(token):
    """ Solo desarrollo: simula una autorización sin pasar por Transbank """
    try:
        venta = Venta.objects.get(id=token.split('_', 1)[1])
    except (Venta.DoesNotExist, ValueError):
        return _redirigir('error')
    if venta.estado == 'pagado':
        return _redirigir('exito', venta.id)
    try:
        _marcar_pagada(venta)
    except StockInsuficiente:
        _cambiar_estado(venta, 'rechazado')
        return _redirigir('rechazado', venta.id)
    _enviar_correo_compra(venta)
    return _redirigir('exito', venta.id)


def _hay_faltante_de_stock(venta):
    pedido = {}
    for d in venta.detalleventa_set.all():
        pedido[d.producto_id] = pedido.get(d.producto_id, 0) + d.cantidad
    stock = dict(Producto.objects.filter(pk__in=pedido).values_list('pk', 'stock'))
    return any(stock.get(pk, 0) < cantidad for pk, cantidad in pedido.items())


def _marcar_pagada(venta):
    """ Descuenta stock con bloqueo y marca la venta como pagada """
    with transaction.atomic():
        venta = Venta.objects.select_for_update().get(pk=venta.pk)
        if venta.estado == 'pagado':
            return

        detalles = list(venta.detalleventa_set.all())
        ids = [d.producto_id for d in detalles]
        productos = {p.pk: p for p in Producto.objects.select_for_update().filter(pk__in=ids)}

        for d in detalles:
            producto = productos[d.producto_id]
            if producto.stock < d.cantidad:
                raise StockInsuficiente(producto.nombre)
            producto.stock -= d.cantidad

        for producto in productos.values():
            producto.save(update_fields=['stock'])

        _cambiar_estado(venta, 'pagado')

        if venta.usuario_id:
            ItemCarrito.objects.filter(carrito__usuario_id=venta.usuario_id, producto_id__in=ids).delete()


def _reembolsar(venta, token, monto, motivo):
    """ Revierte un cobro que no se pudo completar y deja registro para revisión """
    try:
        _transaccion().refund(token, monto)
        resultado = 'Reembolso realizado'
    except Exception:
        logger.exception('Fallo el reembolso de la venta %s', venta.pk)
        resultado = 'REEMBOLSO FALLIDO, hacerlo manualmente en Transbank'

    _cambiar_estado(venta, 'rechazado')
    AuditLog.objects.create(
        usuario=None,
        accion='Reembolso Webpay',
        detalle=f'Venta #{venta.pk} por ${monto}: {motivo}. {resultado}'
    )


def _texto_direccion(venta):
    partes = [f'{venta.direccion_calle} {venta.direccion_numero}'.strip()]
    if venta.direccion_complemento:
        partes.append(venta.direccion_complemento)
    partes.append(f'{venta.direccion_comuna}, {venta.region}'.strip(', '))
    return ', '.join(p for p in partes if p)


def _enviar_correo_compra(venta):
    if not (venta.usuario and venta.usuario.email):
        return

    lineas = [
        f'- {d.producto.nombre} (x{d.cantidad}): ${d.subtotal}'
        for d in venta.detalleventa_set.select_related('producto')
    ]
    subtotal = venta.total - venta.costo_envio + venta.descuento_aplicado
    mensaje = (
        f'Hola {venta.usuario.first_name or venta.usuario.username},\n\n'
        '¡Tu pago ha sido confirmado correctamente! Estamos preparando tu pedido.\n\n'
        'RESUMEN DE COMPRA\n'
        + '\n'.join(lineas) + '\n\n'
        f'Subtotal productos: ${subtotal}\n'
        f'Envío ({venta.region}): +${venta.costo_envio}\n'
        f'Despacho a: {_texto_direccion(venta)}\n'
        f'Descuento: -${venta.descuento_aplicado}\n'
        f'TOTAL PAGADO: ${venta.total}\n\n'
        'Gracias por comprar con nosotros.\nEl Equipo de Ventas'
    )
    try:
        send_mail(
            f'¡Compra Exitosa! Pedido #{venta.id}',
            mensaje,
            settings.EMAIL_HOST_USER,
            [venta.usuario.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('No se pudo enviar el correo de la venta %s', venta.pk)
