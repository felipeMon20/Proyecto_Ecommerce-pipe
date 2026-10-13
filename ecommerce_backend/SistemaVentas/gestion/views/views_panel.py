import hmac
import json
import re

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from datetime import datetime, time

from django.db.models import Count
from django.utils import timezone

from ..models import AuditLog, Categoria, Cupon, ImagenProducto, Producto, Venta
from ..permisos import requiere_staff, requiere_superusuario

EXTENSIONES = ('.png', '.jpg', '.jpeg')
MAX_BYTES_IMAGEN = 5 * 1024 * 1024


def auditar(request, accion, detalle=''):
    AuditLog.objects.create(usuario=request.user, accion=accion[:100], detalle=detalle)


@csrf_exempt
def panel_acceso(request):
    """
    El frontend pregunta aquí si la dirección escrita es la del panel. Solo responde que sí si la dirección
    coincide y la sesión es de staff; en cualquier otro caso responde como una página que no existe.
    """
    no_existe = JsonResponse({'error': 'No encontrado'}, status=404)
    if request.method != 'POST':
        return no_existe
    try:
        ruta = str(json.loads(request.body).get('ruta') or '').strip('/ ')
    except (ValueError, AttributeError):
        return no_existe

    coincide = hmac.compare_digest(ruta.encode(), settings.PANEL_RUTA.encode())
    if not (request.user.is_authenticated and request.user.is_staff and coincide):
        return no_existe
    return JsonResponse({
        'ok': True,
        'ruta': settings.PANEL_RUTA,
        'usuario': request.user.username,
        'superusuario': request.user.is_superuser,
    })


def panel_estado(request):
    """ Para mostrar el acceso al panel solo a quien es staff; el resto no recibe ningún dato """
    if request.user.is_authenticated and request.user.is_staff:
        return JsonResponse({'staff': True, 'superusuario': request.user.is_superuser, 'ruta': settings.PANEL_RUTA})
    return JsonResponse({'staff': False})


@requiere_staff
def panel_categorias(request):
    categorias = Categoria.objects.annotate(productos=Count('producto')).order_by('nombre')
    return JsonResponse({'categorias': list(categorias.values('id', 'nombre', 'productos'))})


@csrf_exempt
@requiere_staff
def guardar_categoria(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        data = json.loads(request.body)
        nombre = ' '.join(str(data.get('nombre') or '').split())
    except (ValueError, AttributeError):
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    if not 2 <= len(nombre) <= 50:
        return JsonResponse({'error': 'El nombre debe tener entre 2 y 50 caracteres'}, status=400)
    repetida = Categoria.objects.filter(nombre__iexact=nombre)
    if data.get('id'):
        repetida = repetida.exclude(id=data['id'])
    if repetida.exists():
        return JsonResponse({'error': 'Ya existe una categoría con ese nombre'}, status=400)
    if data.get('id'):
        if not Categoria.objects.filter(id=data['id']).update(nombre=nombre):
            return JsonResponse({'error': 'Categoría no encontrada'}, status=404)
        auditar(request, 'Editar categoría', nombre)
    else:
        Categoria.objects.create(nombre=nombre)
        auditar(request, 'Crear categoría', nombre)
    return JsonResponse({'mensaje': 'Categoría guardada'})


@csrf_exempt
@requiere_superusuario
def eliminar_categoria(request, categoria_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        categoria = Categoria.objects.get(id=categoria_id)
    except Categoria.DoesNotExist:
        return JsonResponse({'error': 'Categoría no encontrada'}, status=404)
    if Producto.objects.filter(categoria=categoria).exists():
        return JsonResponse({'error': 'No se puede eliminar: la categoría tiene productos'}, status=400)
    nombre = categoria.nombre
    categoria.delete()
    auditar(request, 'Eliminar categoría', nombre)
    return JsonResponse({'mensaje': 'Categoría eliminada'})


@requiere_staff
def panel_productos(request):
    """ Listado completo para administrar: incluye el id de cada imagen para poder quitarla """
    resultado = []
    for p in Producto.objects.select_related('categoria').prefetch_related('imagenes').order_by('nombre'):
        resultado.append({
            'id': p.id,
            'nombre': p.nombre,
            'codigo': p.codigo,
            'marca': p.marca or '',
            'precio': p.precio,
            'stock': p.stock,
            'descripcion': p.descripcion or '',
            'categoria_id': p.categoria_id,
            'categoria': p.categoria.nombre if p.categoria else 'Sin categoría',
            'imagenes': [{'id': i.id, 'url': i.imagen.url} for i in p.imagenes.all()],
        })
    return JsonResponse({'productos': resultado})


@csrf_exempt
@requiere_staff
def agregar_imagenes(request, producto_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        producto = Producto.objects.get(id=producto_id)
    except Producto.DoesNotExist:
        return JsonResponse({'error': 'Producto no encontrado'}, status=404)

    guardadas, alertas = 0, []
    for archivo in request.FILES.getlist('imagenes'):
        if not archivo.name.lower().endswith(EXTENSIONES):
            alertas.append(f'{archivo.name}: solo se aceptan PNG o JPG')
        elif archivo.size > MAX_BYTES_IMAGEN:
            alertas.append(f'{archivo.name}: pesa más de 5 MB')
        else:
            ImagenProducto.objects.create(producto=producto, imagen=archivo)
            guardadas += 1
    if guardadas:
        auditar(request, 'Agregar imágenes', f'{guardadas} imagen(es) al producto {producto.codigo}')
    return JsonResponse({'guardadas': guardadas, 'alertas': alertas})


@csrf_exempt
@requiere_staff
def eliminar_imagen(request, imagen_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        imagen = ImagenProducto.objects.select_related('producto').get(id=imagen_id)
    except ImagenProducto.DoesNotExist:
        return JsonResponse({'error': 'Imagen no encontrada'}, status=404)
    codigo = imagen.producto.codigo
    imagen.delete()
    auditar(request, 'Quitar imagen', f'Imagen {imagen_id} del producto {codigo}')
    return JsonResponse({'mensaje': 'Imagen eliminada'})


@requiere_superusuario
def panel_auditoria(request):
    registros = AuditLog.objects.select_related('usuario').order_by('-fecha')[:200]
    return JsonResponse({'registros': [
        {
            'id': r.id,
            'fecha': r.fecha.strftime('%Y-%m-%d %H:%M'),
            'usuario': r.usuario.username if r.usuario else 'Sistema',
            'accion': r.accion,
            'detalle': r.detalle or '',
        }
        for r in registros
    ]})


def _entero_o_none(valor, minimo=1):
    if valor in (None, ''):
        return None
    numero = int(valor)
    if numero < minimo:
        raise ValueError
    return numero


@requiere_superusuario
def panel_cupones(request):
    cupones = []
    for c in Cupon.objects.order_by('-activo', '-fecha_expiracion'):
        cupones.append({
            'id': c.id,
            'codigo': c.codigo,
            'porcentaje': c.descuento_porcentaje,
            'expira': timezone.localtime(c.fecha_expiracion).strftime('%Y-%m-%d'),
            'vencido': c.fecha_expiracion < timezone.now(),
            'activo': c.activo,
            'usos_maximos': c.usos_maximos,
            'usos_por_usuario': c.usos_por_usuario,
            'usos': Venta.objects.filter(cupon_usado=c.codigo, estado='pagado').count(),
        })
    return JsonResponse({'cupones': cupones})


@csrf_exempt
@requiere_superusuario
def guardar_cupon(request):
    """ Crea o edita un cupón (con "id" edita). Solo el administrador principal, porque mueve dinero """
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        data = json.loads(request.body)
        codigo = re.sub(r'\s+', '', str(data.get('codigo') or '')).upper()
        if not re.fullmatch(r'[A-Z0-9_]{3,40}', codigo):
            return JsonResponse({'error': 'El código debe tener entre 3 y 40 letras, números o guion bajo'}, status=400)
        porcentaje = int(data.get('porcentaje'))
        if not 1 <= porcentaje <= 100:
            return JsonResponse({'error': 'El porcentaje debe estar entre 1 y 100'}, status=400)
        expira = timezone.make_aware(datetime.combine(datetime.strptime(str(data.get('expira')), '%Y-%m-%d').date(), time(23, 59, 59)))
        usos_maximos = _entero_o_none(data.get('usos_maximos'))
        usos_por_usuario = _entero_o_none(data.get('usos_por_usuario'))
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({'error': 'Revisa los datos del cupón (porcentaje, fecha y límites deben ser válidos)'}, status=400)

    duplicado = Cupon.objects.filter(codigo__iexact=codigo)
    if data.get('id'):
        duplicado = duplicado.exclude(id=data['id'])
    if duplicado.exists():
        return JsonResponse({'error': 'Ya existe un cupón con ese código'}, status=400)

    campos = dict(
        codigo=codigo, descuento_porcentaje=porcentaje, fecha_expiracion=expira, activo=bool(data.get('activo', True)),
        usos_maximos=usos_maximos, usos_por_usuario=usos_por_usuario,
    )
    if data.get('id'):
        actualizado = Cupon.objects.filter(id=data['id']).update(**campos)
        if not actualizado:
            return JsonResponse({'error': 'Cupón no encontrado'}, status=404)
        auditar(request, 'Editar cupón', f'{codigo}: {porcentaje}%, activo={campos["activo"]}')
    else:
        Cupon.objects.create(**campos)
        auditar(request, 'Crear cupón', f'{codigo}: {porcentaje}%')
    return JsonResponse({'mensaje': 'Cupón guardado'})
