from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from .models import Cupon, Venta

# Una venta pendiente reciente reserva el uso del cupón mientras el cliente paga
MINUTOS_RESERVA = 30


def validar_cupon(codigo, usuario, total_productos):
    """ Devuelve (cupon, descuento, error). El descuento se aplica solo a los productos """
    codigo = str(codigo or '').strip()
    cupon = Cupon.objects.filter(codigo__iexact=codigo, activo=True).first() if codigo else None
    if cupon is None:
        return None, 0, 'Cupón inválido'
    if cupon.fecha_expiracion < timezone.now():
        return None, 0, 'El cupón ha expirado'

    pagadas = Venta.objects.filter(cupon_usado=cupon.codigo, estado='pagado')

    if cupon.usos_maximos is not None:
        reservadas = Venta.objects.filter(
            cupon_usado=cupon.codigo,
            estado='pendiente',
            fecha_compra__gte=timezone.now() - timedelta(minutes=MINUTOS_RESERVA),
        )
        if pagadas.count() + reservadas.count() >= cupon.usos_maximos:
            return None, 0, 'El cupón ya alcanzó su límite de usos'

    if cupon.usos_por_usuario is not None:
        if not (usuario and usuario.is_authenticated):
            return None, 0, 'Inicia sesión para usar este cupón'
        if pagadas.filter(usuario=usuario).count() >= cupon.usos_por_usuario:
            return None, 0, 'Ya usaste este cupón'

    porcentaje = min(max(cupon.descuento_porcentaje, 0), 100)
    return cupon, int(total_productos * (porcentaje / 100)), None
