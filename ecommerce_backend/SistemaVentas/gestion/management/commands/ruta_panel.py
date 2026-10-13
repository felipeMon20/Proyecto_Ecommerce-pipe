from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Muestra la dirección secreta del panel de administración'

    def handle(self, *args, **opciones):
        self.stdout.write(f'/{settings.PANEL_RUTA}')
