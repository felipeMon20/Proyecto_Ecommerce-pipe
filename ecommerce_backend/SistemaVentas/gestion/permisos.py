from functools import wraps
from django.http import JsonResponse


def requiere_staff(vista):
    @wraps(vista)
    def envoltura(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)
        if not request.user.is_staff:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)
        return vista(request, *args, **kwargs)
    return envoltura


def requiere_superusuario(vista):
    @wraps(vista)
    def envoltura(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)
        if not request.user.is_superuser:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)
        return vista(request, *args, **kwargs)
    return envoltura
