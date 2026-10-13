from django.http import JsonResponse, HttpResponse # <--- Importamos HttpResponse para PDF
from django.db.models import Sum, Count, F
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from ..models import Venta, DetalleVenta, Producto, User, Egreso, AuditLog # <--- Import AuditLog
import json

# --- IMPORTS PARA PDF (REPORTLAB) ---
# Requiere: pip install reportlab
try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
except ImportError:
    canvas = None 

@csrf_exempt
def obtener_dashboard(request):
    """ Retorna métricas clave para el panel administrativo """
    if request.method == 'GET':
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({'error': 'Acceso denegado. Solo administradores.'}, status=403)

        try:
            ingresos_totales = Venta.objects.filter(estado='pagado').aggregate(Sum('total'))['total__sum'] or 0
            egresos_totales = Egreso.objects.aggregate(Sum('monto'))['monto__sum'] or 0
            balance = ingresos_totales - egresos_totales

            pedidos_totales = Venta.objects.filter(estado='pagado').count()
            usuarios_totales = User.objects.count()

            productos_top = (DetalleVenta.objects
                             .filter(venta__estado='pagado')
                             .values('producto__nombre')
                             .annotate(total_vendido=Sum('cantidad'))
                             .order_by('-total_vendido')[:5])
            
            lista_top_productos = list(productos_top)

            ultimas_ventas = Venta.objects.filter(estado='pagado').order_by('-fecha_compra')[:5]
            lista_ultimas = []
            for v in ultimas_ventas:
                lista_ultimas.append({
                    'id': v.id,
                    'usuario': v.usuario.username if v.usuario else "Invitado",
                    'total': v.total,
                    'fecha': v.fecha_compra.strftime("%Y-%m-%d %H:%M")
                })

            return JsonResponse({
                'finanzas': {
                    'ingresos': ingresos_totales,
                    'egresos': egresos_totales,
                    'ganancia_neta': balance,
                    'estado_financiero': 'Superávit' if balance >= 0 else 'Déficit'
                },
                'kpis': {
                    'pedidos_totales': pedidos_totales,
                    'usuarios_totales': usuarios_totales,
                    'ticket_promedio': int(ingresos_totales / pedidos_totales) if pedidos_totales > 0 else 0
                },
                'top_productos': lista_top_productos,
                'ventas_recientes': lista_ultimas
            })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def registrar_egreso(request):
    """ Permite al admin registrar un gasto """
    if request.method == 'POST':
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)

        try:
            data = json.loads(request.body)
            descripcion = data.get('descripcion')
            monto = data.get('monto')
            categoria = data.get('categoria', 'General')

            if not descripcion or not monto:
                return JsonResponse({'error': 'Faltan datos'}, status=400)

            nuevo_egreso = Egreso.objects.create(
                descripcion=descripcion,
                monto=int(monto),
                categoria=categoria,
                usuario=request.user,
                fecha=timezone.now()
            )

            # AUDITORÍA (ID 22)
            AuditLog.objects.create(
                usuario=request.user,
                accion="Registrar Gasto",
                detalle=f"Gasto: {descripcion} (${monto})"
            )

            return JsonResponse({
                'mensaje': 'Gasto registrado correctamente',
                'id': nuevo_egreso.id
            })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

def listar_egresos(request):
    if request.method == 'GET':
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)

        gastos = Egreso.objects.all().order_by('-fecha')
        resultado = []
        for g in gastos:
            resultado.append({
                'id': g.id,
                'descripcion': g.descripcion,
                'monto': g.monto,
                'categoria': g.categoria,
                'fecha': g.fecha.strftime("%Y-%m-%d %H:%M"),
                'registrado_por': g.usuario.username if g.usuario else 'Sistema'
            })
        
        return JsonResponse({'egresos': resultado}, safe=False)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

# --- NUEVO: REPORTE PDF (ID 18) ---
def exportar_reporte_pdf(request):
    """ Genera un PDF con el resumen de ventas del mes """
    if request.method == 'GET':
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({'error': 'Acceso denegado'}, status=403)

        if not canvas:
            return JsonResponse({'error': 'Librería reportlab no instalada en el servidor'}, status=500)

        # 1. Crear la respuesta HTTP tipo PDF
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="reporte_ventas.pdf"'

        # 2. Crear el objeto Canvas de ReportLab
        p = canvas.Canvas(response, pagesize=letter)
        w, h = letter

        # 3. Dibujar Encabezado
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, h - 50, "Reporte Oficial de Ventas - E-commerce")
        
        p.setFont("Helvetica", 10)
        p.drawString(50, h - 70, f"Generado el: {timezone.now().strftime('%d-%m-%Y %H:%M')}")
        p.drawString(50, h - 85, f"Solicitado por: {request.user.username}")

        # 4. Datos Financieros Resumidos
        ingresos = Venta.objects.filter(estado='pagado').aggregate(Sum('total'))['total__sum'] or 0
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, h - 120, f"Ingresos Totales Históricos: ${ingresos}")
        
        # 5. Tabla de Últimas Ventas
        p.drawString(50, h - 150, "Detalle de Últimas 20 Ventas Pagadas:")
        
        y = h - 180
        ventas = Venta.objects.filter(estado='pagado').order_by('-fecha_compra')[:20]
        
        p.setFont("Courier", 9) # Fuente monoespaciada para alinear
        p.drawString(50, y, f"{'ID':<5} {'FECHA':<20} {'CLIENTE':<20} {'TOTAL':<10}")
        y -= 15
        p.line(50, y, 500, y)
        y -= 15

        for v in ventas:
            if y < 50: # Si se acaba la hoja, nueva página
                p.showPage()
                y = h - 50
            
            cliente = v.usuario.username if v.usuario else "Invitado"
            fecha = v.fecha_compra.strftime("%Y-%m-%d %H:%M")
            
            linea = f"#{v.id:<4} {fecha:<20} {cliente[:18]:<20} ${v.total:<10}"
            p.drawString(50, y, linea)
            y -= 15

        # 6. Finalizar y guardar PDF
        p.showPage()
        p.save()

        # AUDITORÍA (ID 22)
        AuditLog.objects.create(
            usuario=request.user,
            accion="Descargar Reporte PDF",
            detalle="Se generó reporte de ventas general"
        )

        return response
    
    return JsonResponse({'error': 'Método no permitido'}, status=405)