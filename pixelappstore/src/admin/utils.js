export const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function fechaCorta(texto) {
  const fecha = new Date(String(texto).replace(' ', 'T'))
  if (Number.isNaN(fecha.getTime())) return texto
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const horaDe = (texto) => String(texto).split(' ')[1] || ''

export const ESTADOS_VENTA = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
}
