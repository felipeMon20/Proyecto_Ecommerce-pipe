import json

from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..errores import error_interno
from ..models import PerfilCliente
from .views_webpay import CAMPOS_DIRECCION


def _perfil_de(usuario):
    perfil, _ = PerfilCliente.objects.get_or_create(user=usuario)
    return perfil


def _como_dict(usuario, perfil):
    direccion = {clave: getattr(perfil, campo) for clave, campo, *_ in CAMPOS_DIRECCION}
    obligatorios = [clave for clave, _, _, _, obligatorio in CAMPOS_DIRECCION if obligatorio]
    return {
        'username': usuario.username,
        'email': usuario.email,
        'nombre': usuario.first_name,
        'apellido': usuario.last_name,
        'region': perfil.region,
        'direccion': direccion,
        'completo': all(direccion[c] for c in obligatorios),
    }


def _leer_direccion_parcial(direccion):
    """ En la cuenta nada es obligatorio: solo se validan largo y formato de lo que venga """
    campos = {}
    for clave, campo, etiqueta, largo, _ in CAMPOS_DIRECCION:
        valor = ' '.join(str(direccion.get(clave) or '').split())
        if len(valor) > largo:
            return None, f'Es demasiado largo {etiqueta}'
        campos[campo] = valor
    telefono = campos['direccion_telefono']
    if telefono:
        digitos = [c for c in telefono if c.isdigit()]
        if len(digitos) < 8 or len(digitos) > 12:
            return None, 'El teléfono de contacto no es válido'
    return campos, None


@csrf_exempt
def perfil_cuenta(request):
    """ GET: datos de la cuenta y de entrega. POST: guarda lo que el cliente quiera (todo es opcional) """
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)

    perfil = _perfil_de(request.user)

    if request.method == 'GET':
        return JsonResponse(_como_dict(request.user, perfil))

    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)

    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError
    except ValueError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    try:
        nombre = ' '.join(str(data.get('nombre', request.user.first_name) or '').split())
        apellido = ' '.join(str(data.get('apellido', request.user.last_name) or '').split())
        region = str(data.get('region') or perfil.region).strip()
        if len(nombre) > 150 or len(apellido) > 150 or len(region) > 100:
            return JsonResponse({'error': 'Alguno de los datos es demasiado largo'}, status=400)

        direccion = data.get('direccion')
        if direccion is not None:
            if not isinstance(direccion, dict):
                return JsonResponse({'error': 'Dirección inválida'}, status=400)
            campos, error = _leer_direccion_parcial(direccion)
            if error:
                return JsonResponse({'error': error}, status=400)
            for campo, valor in campos.items():
                setattr(perfil, campo, valor)

        request.user.first_name = nombre
        request.user.last_name = apellido
        request.user.save(update_fields=['first_name', 'last_name'])
        perfil.region = region
        perfil.save()
        return JsonResponse(_como_dict(request.user, perfil))
    except Exception:
        return error_interno()


@csrf_exempt
def cambiar_clave(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)

    try:
        data = json.loads(request.body)
        actual = str(data.get('actual') or '')
        nueva = str(data.get('nueva') or '')
    except (ValueError, AttributeError):
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    if not request.user.check_password(actual):
        return JsonResponse({'error': 'La contraseña actual no es correcta'}, status=400)
    if actual == nueva:
        return JsonResponse({'error': 'La contraseña nueva debe ser distinta de la actual'}, status=400)
    try:
        validate_password(nueva, user=request.user)
    except ValidationError as errores:
        return JsonResponse({'error': ' '.join(errores.messages)}, status=400)

    request.user.set_password(nueva)
    request.user.save()
    update_session_auth_hash(request, request.user)
    return JsonResponse({'mensaje': 'Contraseña actualizada'})
