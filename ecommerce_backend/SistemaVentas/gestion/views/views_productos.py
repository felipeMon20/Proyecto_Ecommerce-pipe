from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Avg
from ..models import Producto, Categoria, ImagenProducto, Valoracion, Venta
from ..permisos import requiere_staff, requiere_superusuario
import json
import os

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
        
        # Iniciamos con todos
        productos = Producto.objects.all()

        # 1. Filtro por Buscador (Texto)
        if query:
            productos = productos.filter(
                Q(nombre__icontains=query) | 
                Q(descripcion__icontains=query) |
                Q(marca__icontains=query)
            )

        # 2. Filtro por Categoría
        if categoria_id:
            productos = productos.filter(categoria_id=categoria_id)

        # 3. Filtro por Rango de Precio
        if precio_min:
            productos = productos.filter(precio__gte=precio_min)
        if precio_max:
            productos = productos.filter(precio__lte=precio_max)

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
                'marca': p.marca,
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
            return JsonResponse({'error': str(e)}, status=500)
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
@csrf_exempt
@requiere_staff
def crear_producto(request):
    if request.method == 'POST':
        try:
            nombre = request.POST.get('nombre')
            codigo = request.POST.get('codigo')
            precio = request.POST.get('precio')
            stock = request.POST.get('stock')
            categoria_id = request.POST.get('categoria_id')
            marca = request.POST.get('marca', '')

            if not all([nombre, codigo, precio, stock, categoria_id]):
                return JsonResponse({'error': 'Faltan datos obligatorios'}, status=400)

            nuevo_producto = Producto.objects.create(
                nombre=nombre,
                codigo=codigo,
                precio=int(precio),
                stock=int(stock),
                marca=marca,
                categoria_id=int(categoria_id)
            )

            archivos = request.FILES.getlist('imagenes')
            guardadas = 0
            errores_img = []

            for archivo in archivos:
                if archivo.name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    ImagenProducto.objects.create(
                        producto=nuevo_producto,
                        imagen=archivo
                    )
                    guardadas += 1
                else:
                    errores_img.append(f"{archivo.name} no es PNG/JPG")

            return JsonResponse({
                'mensaje': 'Producto creado exitosamente',
                'id': nuevo_producto.id,
                'imagenes_guardadas': guardadas,
                'alertas': errores_img
            })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- FUNCIONES LEGACY ---
@csrf_exempt
@requiere_staff
def editar_producto(request, producto_id):
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            producto = Producto.objects.get(id=producto_id)
            if 'nombre' in data: producto.nombre = data['nombre']
            if 'precio' in data: producto.precio = data['precio']
            if 'stock' in data: producto.stock = data['stock']
            producto.save()
            return JsonResponse({'mensaje': 'Producto actualizado correctamente'})
        except Producto.DoesNotExist:
            return JsonResponse({'error': 'Producto no encontrado'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
@requiere_staff
def eliminar_producto(request, producto_id):
    if request.method == 'DELETE':
        try:
            producto = Producto.objects.get(id=producto_id)
            producto.delete()
            return JsonResponse({'mensaje': 'Producto eliminado correctamente'})
        except Producto.DoesNotExist:
            return JsonResponse({'error': 'Producto no encontrado'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
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
                    errores.append(f"Error en {item.get('nombre')}: {str(e)}")
            return JsonResponse({'mensaje': f'Se cargaron {guardados} productos', 'errores': errores})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
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
                    errores.append(f"Error en {item.get('nombre')}: {str(e)}")
            return JsonResponse({'mensaje': 'Base restaurada', 'creados': guardados, 'errores': errores})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)