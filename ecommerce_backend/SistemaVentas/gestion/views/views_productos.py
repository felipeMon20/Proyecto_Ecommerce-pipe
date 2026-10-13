from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Avg, ProtectedError
from ..models import Producto, Categoria, ImagenProducto, Valoracion, Venta
from ..errores import error_interno
from ..permisos import requiere_staff, requiere_superusuario
from ..reservas import reservas_por_producto
from .views_panel import auditar
import json
import os
import unicodedata


def _normalizar(texto):
    sin_tildes = unicodedata.normalize('NFD', texto or '')
    return ''.join(c for c in sin_tildes if not unicodedata.combining(c)).lower()

# --- LISTAR CON FILTROS AVANZADOS (ID 4 + ID 33) ---
def lista_productos(request):
    """
    Lista productos con filtros múltiples:
    Uso: /productos/listar?q=gamer&categoria=1&precio_min=10000&precio_max=50000
    """
    if request.method == 'GET':
        # Capturamos parámetros
        query = request.GET.get('q', '')
        categoria_id = request.GET.get('categoria')
        precio_min = request.GET.get('precio_min')
        precio_max = request.GET.get('precio_max')
        
        try:
            categoria_id = int(categoria_id) if categoria_id else None
            precio_min = int(precio_min) if precio_min else None
            precio_max = int(precio_max) if precio_max else None
        except ValueError:
            return JsonResponse({'error': 'Los filtros numéricos no son válidos'}, status=400)

        # Iniciamos con todos
        productos = Producto.objects.all()

        # 2. Filtro por Categoría
        if categoria_id:
            productos = productos.filter(categoria_id=categoria_id)

        # 3. Filtro por Rango de Precio
        if precio_min is not None:
            productos = productos.filter(precio__gte=precio_min)
        if precio_max is not None:
            productos = productos.filter(precio__lte=precio_max)

        # Buscador (Texto): ignora tildes y mayúsculas, todas las palabras deben coincidir
        if query:
            palabras = _normalizar(query).split()
            productos = [
                p for p in productos
                if all(
                    palabra in _normalizar(f'{p.nombre} {p.descripcion} {p.marca}')
                    for palabra in palabras
                )
            ]

        reservas = reservas_por_producto(request.user)

        resultado = []
        for p in productos:
            fotos = []
            for img in p.imagenes.all():
                try:
                    fotos.append(request.build_absolute_uri(img.imagen.url))
                except:
                    pass 
            
            # Calculamos promedio de estrellas
            promedio = p.valoraciones.aggregate(Avg('estrellas'))['estrellas__avg']
            
            resultado.append({
                'id': p.id,
                'nombre': p.nombre,
                'codigo': p.codigo,
                'precio': p.precio,
                'stock': p.stock,
                'disponible': max(p.stock - reservas.get(p.id, 0), 0),
                'marca': p.marca,
                'descripcion': p.descripcion or '',
                'categoria_id': p.categoria_id,
                'categoria': p.categoria.nombre if p.categoria else 'Sin Categoría',
                'imagenes': fotos,
                'calificacion_promedio': round(promedio, 1) if promedio else 0, # Nuevo campo
                'total_reviews': p.valoraciones.count() # Nuevo campo
            })
            
        return JsonResponse({'productos': resultado}, safe=False)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- NUEVO: REGISTRAR VALORACIÓN (ID 27) ---
@csrf_exempt
def registrar_valoracion(request, producto_id):
    """
    Permite calificar un producto SOLO si el usuario lo compró.
    """
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Debes iniciar sesión'}, status=401)

        try:
            data = json.loads(request.body)
            estrellas = int(data.get('estrellas', 0))
            comentario = data.get('comentario', '')

            if estrellas < 1 or estrellas > 5:
                return JsonResponse({'error': 'Las estrellas deben ser entre 1 y 5'}, status=400)

            # --- VALIDACIÓN CRÍTICA: ¿Compró el producto? ---
            # Buscamos en las ventas PAGADAS del usuario si existe este producto
            compro_producto = Venta.objects.filter(
                usuario=request.user, 
                estado='pagado',
                detalleventa__producto_id=producto_id
            ).exists()

            if not compro_producto:
                return JsonResponse({'error': 'Solo puedes valorar productos que has comprado y pagado.'}, status=403)

            # Evitar duplicados (opcional: solo 1 review por producto)
            if Valoracion.objects.filter(usuario=request.user, producto_id=producto_id).exists():
                return JsonResponse({'error': 'Ya valoraste este producto.'}, status=400)

            # Crear Valoración
            Valoracion.objects.create(
                producto_id=producto_id,
                usuario=request.user,
                estrellas=estrellas,
                comentario=comentario
            )

            return JsonResponse({'mensaje': '¡Gracias por tu valoración!'})

        except Exception as e:
            return error_interno(500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- PRODUCTOS RELACIONADOS (ID 32) ---
def productos_relacionados(request, producto_id):
    if request.method == 'GET':
        try:
            producto_actual = Producto.objects.get(id=producto_id)
            relacionados = Producto.objects.filter(
                categoria=producto_actual.categoria
            ).exclude(id=producto_actual.id)[:3]

            resultado = []
            for p in relacionados:
                foto = None
                if p.imagenes.exists():
                    foto = request.build_absolute_uri(p.imagenes.first().imagen.url)

                resultado.append({
                    'id': p.id,
                    'nombre': p.nombre,
                    'precio': p.precio,
                    'imagen': foto
                })

            return JsonResponse({'relacionados': resultado}, safe=False)

        except Producto.DoesNotExist:
            return JsonResponse({'error': 'Producto no encontrado'}, status=404)
            
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- CREAR PRODUCTO ---
def _entero_no_negativo(valor, nombre):
    try:
        numero = int(valor)
    except (TypeError, ValueError):
        raise ValueError(f'{nombre} debe ser un número entero')
    if numero < 0:
        raise ValueError(f'{nombre} no puede ser negativo')
    return numero


@csrf_exempt
@requiere_staff
def crear_producto(request):
    if request.method == 'POST':
        try:
            nombre = ' '.join((request.POST.get('nombre') or '').split())
            codigo = (request.POST.get('codigo') or '').strip()
            marca = ' '.join((request.POST.get('marca') or '').split())
            descripcion = (request.POST.get('descripcion') or '').strip()

            if not all([nombre, codigo, request.POST.get('precio'), request.POST.get('stock'), request.POST.get('categoria_id')]):
                return JsonResponse({'error': 'Faltan datos obligatorios'}, status=400)
            if len(nombre) > 100 or len(codigo) > 50 or len(marca) > 50:
                return JsonResponse({'error': 'El nombre, código o marca es demasiado largo'}, status=400)
            precio = _entero_no_negativo(request.POST.get('precio'), 'El precio')
            stock = _entero_no_negativo(request.POST.get('stock'), 'El stock')
            if not Categoria.objects.filter(id=request.POST.get('categoria_id')).exists():
                return JsonResponse({'error': 'La categoría no existe'}, status=400)
            if Producto.objects.filter(codigo__iexact=codigo).exists():
                return JsonResponse({'error': 'Ya existe un producto con ese código'}, status=400)

            nuevo_producto = Producto.objects.create(
                nombre=nombre, codigo=codigo, precio=precio, stock=stock, marca=marca, descripcion=descripcion,
                categoria_id=int(request.POST.get('categoria_id')),
            )

            guardadas = 0
            errores_img = []
            for archivo in request.FILES.getlist('imagenes'):
                if not archivo.name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    errores_img.append(f"{archivo.name} no es PNG/JPG")
                elif archivo.size > 5 * 1024 * 1024:
                    errores_img.append(f"{archivo.name} pesa más de 5 MB")
                else:
                    ImagenProducto.objects.create(producto=nuevo_producto, imagen=archivo)
                    guardadas += 1

            auditar(request, 'Crear producto', f'{codigo} - {nombre} (stock {stock}, ${precio})')
            return JsonResponse({
                'mensaje': 'Producto creado exitosamente',
                'id': nuevo_producto.id,
                'imagenes_guardadas': guardadas,
                'alertas': errores_img
            })
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        except Exception as e:
            return error_interno(500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- EDITAR Y ELIMINAR ---
@csrf_exempt
@requiere_staff
def editar_producto(request, producto_id):
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            producto = Producto.objects.get(id=producto_id)
            cambios = []
            if 'nombre' in data:
                nombre = ' '.join(str(data['nombre']).split())
                if not nombre or len(nombre) > 100:
                    raise ValueError('El nombre es obligatorio y de hasta 100 caracteres')
                producto.nombre = nombre
            if 'codigo' in data:
                codigo = str(data['codigo']).strip()
                if not codigo or len(codigo) > 50:
                    raise ValueError('El código es obligatorio y de hasta 50 caracteres')
                if Producto.objects.filter(codigo__iexact=codigo).exclude(id=producto.id).exists():
                    raise ValueError('Ya existe un producto con ese código')
                producto.codigo = codigo
            if 'marca' in data:
                marca = ' '.join(str(data['marca'] or '').split())
                if len(marca) > 50:
                    raise ValueError('La marca es demasiado larga')
                producto.marca = marca
            if 'descripcion' in data:
                producto.descripcion = str(data['descripcion'] or '').strip()
            if 'categoria_id' in data:
                if not Categoria.objects.filter(id=data['categoria_id']).exists():
                    raise ValueError('La categoría no existe')
                producto.categoria_id = int(data['categoria_id'])
            if 'precio' in data:
                cambios.append(f"precio {producto.precio} -> {data['precio']}")
                producto.precio = _entero_no_negativo(data['precio'], 'El precio')
            if 'stock' in data:
                cambios.append(f"stock {producto.stock} -> {data['stock']}")
                producto.stock = _entero_no_negativo(data['stock'], 'El stock')
            producto.save()
            auditar(request, 'Editar producto', f"{producto.codigo}: {', '.join(cambios) or 'datos generales'}")
            return JsonResponse({'mensaje': 'Producto actualizado correctamente'})
        except Producto.DoesNotExist:
            return JsonResponse({'error': 'Producto no encontrado'}, status=404)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        except Exception as e:
            return error_interno(400)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
@requiere_staff
def eliminar_producto(request, producto_id):
    if request.method == 'DELETE':
        try:
            producto = Producto.objects.get(id=producto_id)
            codigo, nombre = producto.codigo, producto.nombre
            producto.delete()
            auditar(request, 'Eliminar producto', f'{codigo} - {nombre}')
            return JsonResponse({'mensaje': 'Producto eliminado correctamente'})
        except Producto.DoesNotExist:
            return JsonResponse({'error': 'Producto no encontrado'}, status=404)
        except ProtectedError:
            return JsonResponse({'error': 'No se puede eliminar: el producto tiene ventas registradas. Déjalo con stock 0 para ocultarlo.'}, status=400)
        except Exception as e:
            return error_interno(400)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
@requiere_staff
def carga_masiva_productos(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            if not isinstance(data, list):
                return JsonResponse({'error': 'Se esperaba una lista []'}, status=400)
            guardados = 0
            errores = []
            for item in data:
                try:
                    Producto.objects.create(
                        nombre=item['nombre'],
                        codigo=item['codigo'],
                        precio=item['precio'],
                        stock=item['stock'],
                        marca=item.get('marca', ''),
                        categoria_id=item['categoria_id']
                    )
                    guardados += 1
                except Exception as e:
                    errores.append(f"Error en {item.get('nombre')}: datos inválidos")
            return JsonResponse({'mensaje': f'Se cargaron {guardados} productos', 'errores': errores})
        except Exception as e:
            return error_interno(400)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
@requiere_superusuario
def eliminar_todos_productos(request):
    if request.method == 'DELETE':
        cantidad = Producto.objects.all().delete()
        return JsonResponse({'mensaje': f'Se han eliminado {cantidad[0]} productos'})
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
@requiere_superusuario
def reemplazar_productos(request):
    if request.method == 'POST':
        try:
            ruta_archivo = os.path.join(settings.BASE_DIR, 'gestion', 'fixtures', 'productos.json')
            if not os.path.exists(ruta_archivo):
                return JsonResponse({'error': 'No se encontró productos.json'}, status=404)
            with open(ruta_archivo, 'r', encoding='utf-8') as archivo:
                data = json.load(archivo)
            Producto.objects.all().delete()
            guardados = 0
            errores = []
            for item in data:
                try:
                    Producto.objects.create(
                        nombre=item['nombre'],
                        codigo=item['codigo'],
                        precio=item['precio'],
                        stock=item['stock'],
                        marca=item.get('marca', ''),
                        categoria_id=item['categoria_id']
                    )
                    guardados += 1
                except Exception as e:
                    errores.append(f"Error en {item.get('nombre')}: datos inválidos")
            return JsonResponse({'mensaje': 'Base restaurada', 'creados': guardados, 'errores': errores})
        except Exception as e:
            return error_interno(500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)