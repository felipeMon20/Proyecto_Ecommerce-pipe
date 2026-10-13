from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
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
import random
import re

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

@csrf_exempt
def solicitar_login(request):
    """ Paso 1: Validar usuario/clave y enviar código """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')

            user_obj = User.objects.filter(username=username).first()
            if not user_obj:
                 return JsonResponse({'error': 'Usuario o contraseña incorrectos'}, status=401)

            perfil, created = PerfilSeguridad.objects.get_or_create(user=user_obj)

            if perfil.bloqueado_hasta and perfil.bloqueado_hasta > timezone.now():
                tiempo = int((perfil.bloqueado_hasta - timezone.now()).total_seconds())
                return JsonResponse({'error': f'Cuenta bloqueada. Espera {tiempo}s.'}, status=403)

            user = authenticate(request, username=username, password=password)

            if user is not None:
                perfil.intentos_fallidos = 0
                perfil.bloqueado_hasta = None
                perfil.save()

                codigo_nuevo = str(random.randint(100000, 999999))
                Codigo2FA.objects.update_or_create(user=user, defaults={'codigo': codigo_nuevo})

                try:
                    send_mail(
                        'Tu Código de Verificación',
                        f'Hola {user.first_name}, tu código: {codigo_nuevo}',
                        settings.EMAIL_HOST_USER,
                        [user.email],
                        fail_silently=False,
                    )
                except:
                    pass 
                
                return JsonResponse({'mensaje': 'Credenciales válidas. Código enviado.'})
            
            else:
                perfil.intentos_fallidos += 1
                if perfil.intentos_fallidos >= 3:
                    perfil.bloqueado_hasta = timezone.now() + timedelta(minutes=5)
                    perfil.intentos_fallidos = 0
                    perfil.save()
                    return JsonResponse({'error': 'Cuenta BLOQUEADA por 5 min.'}, status=403)
                
                perfil.save()
                return JsonResponse({'error': f'Clave incorrecta. Intento {perfil.intentos_fallidos}/3'}, status=401)

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def verificar_codigo_login(request):
    """ Paso 2: Validar código y emitir TOKEN JWT """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            codigo_ingresado = data.get('codigo')

            user = User.objects.get(username=username)
            registro_2fa = Codigo2FA.objects.get(user=user)

            if registro_2fa.codigo == codigo_ingresado:
                # 1. Login clásico (Cookies/Sesión Web)
                login(request, user)
                
                # 2. Generar Tokens JWT (Para API/Móvil) - ID 24
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                
                # Limpiar código usado
                registro_2fa.delete()
                
                return JsonResponse({
                    'mensaje': 'Autenticación exitosa',
                    'usuario': user.username,
                    'es_admin': user.is_staff,
                    'es_superuser': user.is_superuser,
                    # --- TOKENS JWT ENTREGADOS ---
                    'access_token': access_token,
                    'refresh_token': str(refresh)
                })
            else:
                return JsonResponse({'error': 'Código incorrecto'}, status=400)

        except Exception:
            return JsonResponse({'error': 'Falló la autenticación'}, status=400)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

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