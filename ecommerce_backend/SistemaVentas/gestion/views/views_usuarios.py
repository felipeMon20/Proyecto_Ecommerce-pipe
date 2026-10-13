from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from ..models import Codigo2FA, PerfilSeguridad, AuditLog 
from ..permisos import requiere_superusuario
# --- IMPORT NUEVO PARA JWT (ID 24) ---
from rest_framework_simplejwt.tokens import RefreshToken 
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import json
import os
import secrets
import logging
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# SECCIÓN 1: GESTIÓN DE USUARIOS
# ---------------------------------------------------------

@csrf_exempt
@requiere_superusuario
def reemplazar_usuarios(request):
    """ Reinicia los usuarios usando usuarios.json """
    if request.method == 'POST':
        try:
            ruta_archivo = os.path.join(settings.BASE_DIR, 'gestion', 'fixtures', 'usuarios.json')
            if not os.path.exists(ruta_archivo):
                return JsonResponse({'error': 'No se encontró usuarios.json'}, status=404)

            with open(ruta_archivo, 'r', encoding='utf-8') as archivo:
                data = json.load(archivo)
            
            User.objects.all().delete()
            
            guardados = 0
            for item in data:
                user = User.objects.create_user(
                    id=item['id'], 
                    username=item['username'],
                    password=item['password'],
                    email=item['email'],
                    first_name=item['nombre'],
                    last_name=item['apellido']
                )
                if item.get('es_admin'):
                    user.is_staff = True
                    user.is_superuser = True
                    user.save()
                guardados += 1
            
            return JsonResponse({'mensaje': f'Se restauraron {guardados} usuarios correctamente'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def eliminar_usuario(request, usuario_id):
    if request.method == 'DELETE':
        if not request.user.is_staff:
             return JsonResponse({'error': 'Acceso denegado'}, status=403)
        if usuario_id == 1:
            return JsonResponse({'error': 'No puedes eliminar al Super Admin (ID 1)'}, status=403)
        try:
            user = User.objects.get(id=usuario_id)
            user.delete()
            return JsonResponse({'mensaje': 'Usuario eliminado correctamente'})
        except User.DoesNotExist:
            return JsonResponse({'error': 'Usuario no encontrado'}, status=404)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

def listar_usuarios(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Acceso denegado'}, status=403)
    usuarios = list(User.objects.all().values('id', 'username', 'email', 'is_staff', 'is_active'))
    return JsonResponse({'usuarios': usuarios}, safe=False)

# ---------------------------------------------------------
# SECCIÓN 2: LOGIN CON 2FA, BLOQUEO Y AHORA JWT (ID 24)
# ---------------------------------------------------------

MAX_INTENTOS = 3
MINUTOS_BLOQUEO = 5
MINUTOS_VIGENCIA_CODIGO = 10


def _registrar_intento_fallido(perfil):
    """ Suma un intento fallido y bloquea la cuenta al llegar al máximo """
    perfil.intentos_fallidos += 1
    bloqueada = perfil.intentos_fallidos >= MAX_INTENTOS
    if bloqueada:
        perfil.bloqueado_hasta = timezone.now() + timedelta(minutes=MINUTOS_BLOQUEO)
        perfil.intentos_fallidos = 0
    perfil.save()
    return bloqueada


def _respuesta_bloqueo(perfil):
    segundos = int((perfil.bloqueado_hasta - timezone.now()).total_seconds())
    return JsonResponse({'error': f'Cuenta bloqueada. Espera {segundos}s.'}, status=403)


@csrf_exempt
def solicitar_login(request):
    """ Paso 1: Validar usuario/clave y enviar código """
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)

    try:
        data = json.loads(request.body)
    except ValueError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    username = data.get('username')
    password = data.get('password')
    error_credenciales = JsonResponse({'error': 'Usuario o contraseña incorrectos'}, status=401)

    user_obj = User.objects.filter(username=username).first()
    if not user_obj:
        return error_credenciales

    perfil, _ = PerfilSeguridad.objects.get_or_create(user=user_obj)

    if perfil.bloqueado_hasta and perfil.bloqueado_hasta > timezone.now():
        return _respuesta_bloqueo(perfil)

    user = authenticate(request, username=username, password=password)
    if user is None:
        if _registrar_intento_fallido(perfil):
            return JsonResponse({'error': f'Cuenta BLOQUEADA por {MINUTOS_BLOQUEO} min.'}, status=403)
        return error_credenciales

    if not user.email:
        return JsonResponse({'error': 'La cuenta no tiene correo para enviar el código'}, status=400)

    perfil.intentos_fallidos = 0
    perfil.bloqueado_hasta = None
    perfil.save()

    codigo_nuevo = f'{secrets.randbelow(900000) + 100000}'
    Codigo2FA.objects.filter(user=user).delete()
    registro = Codigo2FA.objects.create(user=user, codigo=codigo_nuevo)

    try:
        send_mail(
            'Tu Código de Verificación',
            f'Hola {user.first_name or user.username}, tu código: {codigo_nuevo}\n'
            f'Vence en {MINUTOS_VIGENCIA_CODIGO} minutos.',
            settings.EMAIL_HOST_USER,
            [user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('No se pudo enviar el código 2FA al usuario %s', user.pk)
        registro.delete()
        return JsonResponse({'error': 'No se pudo enviar el código. Intenta más tarde.'}, status=503)

    return JsonResponse({'mensaje': 'Credenciales válidas. Código enviado.'})


@csrf_exempt
def verificar_codigo_login(request):
    """ Paso 2: Validar código y emitir TOKEN JWT """
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)

    try:
        data = json.loads(request.body)
    except ValueError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    codigo_ingresado = str(data.get('codigo') or '')
    error_generico = JsonResponse({'error': 'Código incorrecto o vencido'}, status=400)

    user = User.objects.filter(username=data.get('username')).first()
    if not user:
        return error_generico

    perfil, _ = PerfilSeguridad.objects.get_or_create(user=user)
    if perfil.bloqueado_hasta and perfil.bloqueado_hasta > timezone.now():
        return _respuesta_bloqueo(perfil)

    registro_2fa = Codigo2FA.objects.filter(user=user).first()
    if not registro_2fa:
        return error_generico

    vencido = timezone.now() - registro_2fa.creado_en > timedelta(minutes=MINUTOS_VIGENCIA_CODIGO)
    coincide = secrets.compare_digest(registro_2fa.codigo, codigo_ingresado)

    if vencido:
        registro_2fa.delete()
        return error_generico

    if not coincide:
        if _registrar_intento_fallido(perfil):
            registro_2fa.delete()
            return JsonResponse({'error': f'Cuenta BLOQUEADA por {MINUTOS_BLOQUEO} min.'}, status=403)
        return error_generico

    registro_2fa.delete()
    perfil.intentos_fallidos = 0
    perfil.save()

    # Sesión web (cookie) y tokens JWT para la API
    login(request, user)
    refresh = RefreshToken.for_user(user)

    return JsonResponse({
        'mensaje': 'Autenticación exitosa',
        'usuario': user.username,
        'es_admin': user.is_staff,
        'es_superuser': user.is_superuser,
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh)
    })

@csrf_exempt
def cerrar_sesion(request):
    logout(request)
    return JsonResponse({'mensaje': 'Sesión cerrada'})

@csrf_exempt
def registrar_usuario(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            email = data.get('email')
            nombre = data.get('nombre')
            apellido = data.get('apellido')

            if not all([username, password, email]):
                return JsonResponse({'error': 'Faltan datos'}, status=400)

            if User.objects.filter(email=email).exists():
                return JsonResponse({'error': 'Correo ya registrado'}, status=400)

            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Ese nombre de usuario ya existe'}, status=400)

            try:
                validate_password(password, user=User(username=username, email=email))
            except ValidationError as errores:
                return JsonResponse({'error': ' '.join(errores.messages)}, status=400)

            user = User.objects.create_user(
                username=username, password=password, email=email,
                first_name=nombre, last_name=apellido
            )
            return JsonResponse({'mensaje': 'Cliente registrado', 'id': user.id})

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# ---------------------------------------------------------
# SECCIÓN 3: RECUPERACIÓN DE CONTRASEÑA
# ---------------------------------------------------------
@csrf_exempt
def solicitar_recuperacion(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get('email')
            user = User.objects.filter(email=email).first()
            if user:
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                try:
                    send_mail("Recuperar Clave", f"UID: {uid}\nTOKEN: {token}", settings.EMAIL_HOST_USER, [email], fail_silently=False)
                except: pass
            return JsonResponse({'mensaje': 'Si existe, se envió correo.'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': '405'}, status=405)

@csrf_exempt
def confirmar_cambio_password(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            uid = force_str(urlsafe_base64_decode(data.get('uid')))
            user = User.objects.get(pk=uid)
            if default_token_generator.check_token(user, data.get('token')):
                user.set_password(data.get('new_password'))
                user.save()
                return JsonResponse({'mensaje': 'Clave cambiada'})
            return JsonResponse({'error': 'Token inválido'}, status=400)
        except Exception:
            return JsonResponse({'error': 'Error procesando solicitud'}, status=400)
    return JsonResponse({'error': '405'}, status=405)

# ---------------------------------------------------------
# SECCIÓN 4: GESTIÓN DE EMPLEADOS
# ---------------------------------------------------------
@csrf_exempt
def crear_empleado(request):
    if request.method == 'POST':
        if not request.user.is_authenticated or not request.user.is_superuser:
            return JsonResponse({'error': 'Solo el Administrador puede contratar empleados'}, status=403)
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            email = data.get('email')
            nombre = data.get('nombre')
            
            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Usuario ya existe'}, status=400)

            empleado = User.objects.create_user(
                username=username, password=password, email=email, first_name=nombre
            )
            empleado.is_staff = True 
            empleado.is_superuser = False
            empleado.save()

            AuditLog.objects.create(usuario=request.user, accion="Crear Empleado", detalle=f"Nuevo vendedor: {username}")
            return JsonResponse({'mensaje': 'Vendedor creado exitosamente', 'id': empleado.id})

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

def listar_empleados(request):
    if request.method == 'GET':
        if not request.user.is_authenticated or not request.user.is_superuser:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)
        empleados = User.objects.filter(is_staff=True, is_superuser=False).values('id', 'username', 'first_name', 'email', 'is_active')
        return JsonResponse({'empleados': list(empleados)}, safe=False)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def editar_empleado(request, empleado_id):
    if request.method == 'PUT':
        if not request.user.is_superuser:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)
        try:
            data = json.loads(request.body)
            emp = User.objects.get(id=empleado_id)
            if emp.is_superuser:
                return JsonResponse({'error': 'No puedes editar al Admin principal aquí'}, status=400)
            if 'first_name' in data: emp.first_name = data['first_name']
            if 'email' in data: emp.email = data['email']
            if 'is_active' in data: emp.is_active = data['is_active']
            emp.save()
            return JsonResponse({'mensaje': 'Datos del vendedor actualizados'})
        except User.DoesNotExist:
            return JsonResponse({'error': 'Empleado no encontrado'}, status=404)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- NUEVO: RUTA DE PRUEBA EXCLUSIVA PARA JWT (ID 24) ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def prueba_token_jwt(request):
    """
    Esta vista SOLO funciona si envías el Token JWT en el Header.
    Las cookies no sirven aquí.
    """
    return Response({
        "mensaje": "¡Token validado correctamente! 🔓",
        "usuario": request.user.username,
        "email": request.user.email,
        "estado": "Autenticado vía API"
    })