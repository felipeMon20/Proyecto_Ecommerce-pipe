// Las mismas reglas que valida el servidor, para mostrarlas mientras se escribe.
// La lista de claves comunes es solo una muestra: el servidor revisa una lista mucho más grande.
const COMUNES = new Set([
  '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', 'qwertyui', 'qwerty123', 'qwertyuiop',
  'password', 'password1', 'password123', 'contraseña', 'contrasena', 'contraseña1', 'contrasena1', 'admin123',
  'administrador', 'iloveyou', 'abc12345', 'abcd1234', '1q2w3e4r', '1qaz2wsx', 'letmein1', 'welcome1', 'bienvenido',
  'chile123', 'santiago', 'futbol123', 'colocolo', 'princesa', 'superman', 'pokemon1', 'minecraft', 'gamer123',
  'football', 'baseball', 'dragon12', 'monkey12', 'sunshine', 'master123', 'shadow12', 'michael1', 'jennifer',
])

// Debe coincidir con gestion/validadores.py
export const ESPECIALES_PERMITIDOS = '!#$%&*+?@_.,^~'
const PERMITIDO = /^[A-Za-z0-9!#$%&*+?@_.,^~]$/

const sinTildes = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function seParece(clave, usuario, correo) {
  const c = sinTildes(clave)
  const partes = [usuario, String(correo || '').split('@')[0]].map(sinTildes).filter((p) => p.length >= 3)
  return partes.some((p) => c.includes(p) || p.includes(c))
}

// Devuelve cada regla con su estado para pintar la lista de indicaciones
export function evaluarClave({ clave, repetir, usuario, correo, actual }) {
  const hay = clave.length > 0
  const noPermitidos = [...new Set([...clave].filter((c) => !PERMITIDO.test(c)))]
  const reglas = [
    { id: 'largo', texto: 'Mínimo 8 caracteres', ok: clave.length >= 8 },
    { id: 'mayuscula', texto: 'Una mayúscula (A-Z, sin tildes ni Ñ)', ok: /[A-Z]/.test(clave) },
    { id: 'simbolo', texto: `Un símbolo: ${ESPECIALES_PERMITIDOS}`, ok: [...clave].some((c) => ESPECIALES_PERMITIDOS.includes(c)) },
    {
      id: 'permitidos',
      texto: noPermitidos.length > 0
        ? `No uses: ${noPermitidos.map((c) => (c === ' ' ? 'espacio' : c)).join('  ')}`
        : 'Solo caracteres permitidos (sin tildes ni ñ)',
      ok: hay && noPermitidos.length === 0,
    },
    { id: 'numeros', texto: 'No son solo números', ok: hay && !/^\d+$/.test(clave) },
    { id: 'comun', texto: 'No es una clave común (12345678, password)', ok: hay && !COMUNES.has(clave.toLowerCase()) },
    { id: 'parecida', texto: 'No se parece a tu usuario o correo', ok: hay && !seParece(clave, usuario, correo) },
  ]
  if (actual !== undefined) {
    reglas.push({ id: 'distinta', texto: 'Distinta de la contraseña actual', ok: hay && actual !== '' && clave !== actual })
  }
  reglas.push({ id: 'coincide', texto: 'Las dos contraseñas coinciden', ok: hay && repetir !== '' && clave === repetir })
  return reglas
}

// Fortaleza orientativa: 0 (vacía) a 4
export function fortalezaClave(clave, reglas) {
  const bloqueada = reglas.some((r) => ['numeros', 'comun', 'parecida', 'mayuscula', 'simbolo', 'permitidos'].includes(r.id) && !r.ok)
  if (!clave || bloqueada || clave.length < 8) return clave ? 1 : 0
  const puntos = [
    clave.length >= 12,
    /[a-z]/.test(clave) && /[A-Z]/.test(clave),
    /\d/.test(clave),
    /[^A-Za-z0-9]/.test(clave),
  ].filter(Boolean).length
  return Math.min(1 + Math.ceil(puntos * 0.75), 4)
}

export const ETIQUETAS_FORTALEZA = ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte']
