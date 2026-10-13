from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from .models import DetalleVenta

# Tiempo que una venta pendiente aparta sus unidades; luego quedan libres para otros clientes
MINUTOS_RESERVA_STOCK = 15


def reservas_por_producto(excluir_usuario=None, producto_ids=None):
    """ {producto_id: unidades} apartadas por ventas pendientes recientes (clientes que están pagando) """
    detalles = DetalleVenta.objects.filter(
        venta__estado='pendiente',
        venta__fecha_compra__gte=timezone.now() - timedelta(minutes=MINUTOS_RESERVA_STOCK),
    )
    if producto_ids is not None:
        detalles = detalles.filter(producto_id__in=producto_ids)
    if excluir_usuario is not None and excluir_usuario.is_authenticated:
        detalles = detalles.exclude(venta__usuario=excluir_usuario)
    filas = detalles.values('producto_id').annotate(total=Sum('cantidad'))
    return {f['producto_id']: f['total'] for f in filas}


def stock_reservado(producto_id, excluir_usuario=None):
    return reservas_por_producto(excluir_usuario, [producto_id]).get(producto_id, 0)


def mensaje_sin_disponible(nombre, disponible):
    return (f'Otros clientes están pagando {nombre}. Por ahora quedan {max(disponible, 0)} '
            f'unidades disponibles; intenta de nuevo en unos minutos.')
