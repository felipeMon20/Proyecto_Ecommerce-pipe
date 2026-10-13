import json
import time
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

# Respuestas que cuentan como intento fallido cuando el límite es de tipo 'fallos'
ESTADOS_FALLIDOS = (400, 401, 403, 404)


def ip_cliente(request):
    """ IP de quien llama; la cabecera de proxy solo se usa si se configura (IP_CLIENTE_HEADER) """
    cabecera = getattr(settings, 'IP_CLIENTE_HEADER', '')
    if cabecera:
        valor = request.META.get(cabecera, '')
        if valor:
            # La última IP la agrega el proxy de confianza; las anteriores las puede inventar el cliente
            return valor.split(',')[-1].strip()
    return request.META.get('REMOTE_ADDR', 'desconocida')


def email_del_body(request):
    try:
        return str(json.loads(request.body).get('email') or '').strip().lower()[:254] or None
    except (ValueError, AttributeError):
        return None


def _estado(clave):
    registro = cache.get(clave)
    if registro and registro['fin'] > time.time():
        return registro
    return None


def _sumar(clave, ventana):
    registro = _estado(clave) or {'n': 0, 'fin': time.time() + ventana}
    registro['n'] += 1
    cache.set(clave, registro, max(int(registro['fin'] - time.time()), 1))


def intentos_ip(nombre, request):
    """ Cuántos intentos lleva esta IP en la ventana actual del límite 'nombre' """
    registro = _estado(f'lim:{nombre}:ip:{ip_cliente(request)}')
    return registro['n'] if registro else 0


def limitar(nombre, maximo, ventana, contar='todos', por=None, maximo_por=None):
    """
    Limita peticiones POST por IP (y opcionalmente por un identificador, p. ej. el correo).
    contar='todos' cuenta cada petición; contar='fallos' solo las que terminan en error del cliente.
    """
    def decorador(vista):
        @wraps(vista)
        def envuelta(request, *args, **kwargs):
            if request.method != 'POST' or not getattr(settings, 'LIMITES_ACTIVOS', True):
                return vista(request, *args, **kwargs)

            claves = [(f'lim:{nombre}:ip:{ip_cliente(request)}', maximo)]
            if por:
                identificador = por(request)
                if identificador:
                    claves.append((f'lim:{nombre}:id:{identificador}', maximo_por or maximo))

            for clave, tope in claves:
                registro = _estado(clave)
                if registro and registro['n'] >= tope:
                    espera = max(int(registro['fin'] - time.time()), 1)
                    respuesta = JsonResponse({'error': f'Demasiados intentos. Espera {espera} segundos e intenta de nuevo.'}, status=429)
                    respuesta['Retry-After'] = str(espera)
                    return respuesta

            if contar == 'todos':
                for clave, _ in claves:
                    _sumar(clave, ventana)
            respuesta = vista(request, *args, **kwargs)
            if contar == 'fallos' and respuesta.status_code in ESTADOS_FALLIDOS:
                for clave, _ in claves:
                    _sumar(clave, ventana)
            return respuesta
        return envuelta
    return decorador
