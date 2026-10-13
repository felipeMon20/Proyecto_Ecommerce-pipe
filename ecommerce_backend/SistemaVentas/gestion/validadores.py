import string

from django.core.exceptions import ValidationError

# Símbolos admitidos; no se aceptan comillas, barras, paréntesis, = ni -, ni letras con tilde o ñ
ESPECIALES_PERMITIDOS = '!#$%&*+?@_.,^~'
PERMITIDOS = set(string.ascii_letters + string.digits + ESPECIALES_PERMITIDOS)


class ComplejidadPasswordValidator:
    """ Exige una mayúscula (A-Z), un símbolo permitido y solo caracteres permitidos """

    def validate(self, password, user=None):
        errores = []
        no_permitidos = []
        for c in password:
            if c not in PERMITIDOS and c not in no_permitidos:
                no_permitidos.append(c)
        if no_permitidos:
            lista = ', '.join('espacio' if c == ' ' else c for c in no_permitidos)
            errores.append(ValidationError(
                'La contraseña tiene caracteres no permitidos (%(lista)s). Usa letras sin tildes ni ñ, números y estos símbolos: %(simbolos)s',
                code='caracteres_no_permitidos',
                params={'lista': lista, 'simbolos': ESPECIALES_PERMITIDOS},
            ))
        if not any(c in string.ascii_uppercase for c in password):
            errores.append(ValidationError('La contraseña debe tener al menos una letra mayúscula (A-Z, sin tildes ni Ñ).', code='sin_mayuscula'))
        if not any(c in ESPECIALES_PERMITIDOS for c in password):
            errores.append(ValidationError(
                'La contraseña debe tener al menos un símbolo de estos: %(simbolos)s',
                code='sin_simbolo',
                params={'simbolos': ESPECIALES_PERMITIDOS},
            ))
        if errores:
            raise ValidationError(errores)

    def get_help_text(self):
        return f'Debe incluir una mayúscula (sin tildes) y un símbolo de estos: {ESPECIALES_PERMITIDOS}. No se permiten comillas, barras, paréntesis, = ni -, ni tildes o ñ.'
