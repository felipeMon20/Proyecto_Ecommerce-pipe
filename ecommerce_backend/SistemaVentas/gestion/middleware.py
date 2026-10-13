import time

from django.conf import settings
from django.contrib.sessions.middleware import SessionMiddleware
from django.core.cache import caches
from django.http import JsonResponse

from .limites import ip_cliente

# Rutas que nunca se frenan: archivos estáticos y el regreso de Webpay (un pago en curso no puede cortarse)
RUTAS_EXENTAS = ('/media/', '/static/', '/webpay/confirmar')


def _sumar(cache, clave, ventana):
    registro = cache.get(clave)
    ahora = time.time()
    if not registro or registro['fin'] <= ahora:
        registro = {'n': 0, 'fin': ahora + ventana}
    registro['n'] += 1
    cache.set(clave, registro, max(int(registro['fin'] - ahora) + 1, 1))
    return registro['n']


class LimiteGeneralMiddleware:
    """
    Protege la tienda de recargas seguidas (F5) y de picos de visitas.
    - Por IP: ráfaga (muchas peticiones en pocos segundos) y uso sostenido en un minuto; al pasarse, la IP espera.
    - Global: si entre todos superan el tope, quien llega se pone en espera unos segundos.
    El frontend muestra una pantalla de espera con cuenta regresiva al recibir el 429 con ``saturacion``.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            not getattr(settings, 'LIMITES_ACTIVOS', True)
            or request.method == 'OPTIONS'
            or request.path.startswith(RUTAS_EXENTAS)
        ):
            return self.get_response(request)

        cache = caches['rapida']
        ahora = time.time()
        ip = ip_cliente(request)

        bloqueo = cache.get(f'sat:bloqueo:{ip}')
        if bloqueo and bloqueo > ahora:
            return self._respuesta('ip', bloqueo - ahora)

        rafaga = _sumar(cache, f'sat:r:{ip}', settings.SATURACION_RAFAGA_VENTANA)
        sostenido = _sumar(cache, f'sat:s:{ip}', 60)
        general = _sumar(cache, 'sat:g', settings.SATURACION_RAFAGA_VENTANA)

        if rafaga > settings.SATURACION_RAFAGA:
            return self._bloquear(cache, ip, ahora, settings.SATURACION_ESPERA_RAFAGA)
        if sostenido > settings.SATURACION_SOSTENIDO:
            return self._bloquear(cache, ip, ahora, settings.SATURACION_ESPERA_SOSTENIDO)
        if general > settings.SATURACION_GLOBAL:
            return self._respuesta('global', settings.SATURACION_ESPERA_GLOBAL)
        return self.get_response(request)

    def _bloquear(self, cache, ip, ahora, segundos):
        cache.set(f'sat:bloqueo:{ip}', ahora + segundos, segundos + 1)
        return self._respuesta('ip', segundos)

    @staticmethod
    def _respuesta(motivo, segundos):
        espera = max(int(segundos + 0.999), 1)
        mensaje = (
            f'Detectamos muchas solicitudes seguidas. Espera {espera} segundos e intenta de nuevo.'
            if motivo == 'ip'
            else f'Hay muchas personas en la tienda en este momento. Espera {espera} segundos e intenta de nuevo.'
        )
        respuesta = JsonResponse({'error': mensaje, 'saturacion': True, 'motivo': motivo, 'espera': espera}, status=429)
        respuesta['Retry-After'] = str(espera)
        return respuesta


class SesionMiddleware(SessionMiddleware):
    """ Las consultas automáticas del frontend no renuevan la sesión: solo cuenta la actividad real """

    def process_response(self, request, response):
        if request.headers.get('X-Actividad-Pasiva') == '1':
            return response
        return super().process_response(request, response)
