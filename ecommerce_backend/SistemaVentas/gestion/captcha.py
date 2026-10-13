import json
import logging
import urllib.parse
import urllib.request
from functools import wraps

from django.conf import settings
from django.http import JsonResponse

from .limites import intentos_ip, ip_cliente

logger = logging.getLogger(__name__)

URL_VERIFICACION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

# Intentos fallidos de la IP desde los que se exige captcha; 0 = siempre
UMBRALES = {'login': 3, 'registro': 0, 'recuperar': 0}


def captcha_activo():
    return bool(settings.TURNSTILE_SECRET)


def captcha_requerido(request, accion):
    if not captcha_activo():
        return False
    umbral = UMBRALES.get(accion, 0)
    return umbral == 0 or intentos_ip(accion, request) >= umbral


def verificar_token(token, ip):
    """ True si Cloudflare lo acepta, False si lo rechaza, None si no se pudo consultar """
    datos = urllib.parse.urlencode({'secret': settings.TURNSTILE_SECRET, 'response': token, 'remoteip': ip}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(URL_VERIFICACION, data=datos), timeout=5) as respuesta:
            return json.load(respuesta).get('success') is True
    except Exception:
        logger.exception('No se pudo consultar a Turnstile')
        return None


def _error(mensaje, estado):
    return JsonResponse({'error': mensaje, 'captcha_requerido': True}, status=estado)


def exigir_captcha(accion):
    """ Pide el token del captcha (campo 'captcha' del body) en los POST donde corresponda """
    def decorador(vista):
        @wraps(vista)
        def envuelta(request, *args, **kwargs):
            if request.method != 'POST' or not captcha_requerido(request, accion):
                return vista(request, *args, **kwargs)
            try:
                token = str(json.loads(request.body).get('captcha') or '')
            except (ValueError, AttributeError):
                token = ''
            if not token:
                return _error('Completa la verificación de seguridad', 400)
            resultado = verificar_token(token, ip_cliente(request))
            if resultado is None:
                return _error('No se pudo comprobar la verificación. Intenta de nuevo.', 503)
            if not resultado:
                return _error('La verificación falló. Intenta de nuevo.', 400)
            return vista(request, *args, **kwargs)
        return envuelta
    return decorador


def estado_captcha(request):
    """ GET: indica al frontend si debe mostrar el captcha para una acción """
    accion = request.GET.get('accion', '')
    return JsonResponse({
        'activo': captcha_activo(),
        'site_key': settings.TURNSTILE_SITE_KEY if captcha_activo() else '',
        'requerido': captcha_requerido(request, accion),
    })
