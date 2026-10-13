import logging

from django.http import JsonResponse

logger = logging.getLogger(__name__)


def error_interno(status=500, mensaje='Ocurrió un error interno. Intenta más tarde.'):
    """ Respuesta genérica: el detalle de la excepción queda solo en el log del servidor """
    logger.exception('Error en la vista')
    return JsonResponse({'error': mensaje}, status=status)
