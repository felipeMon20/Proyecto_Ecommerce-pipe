// Tipos de producto de la portada. Se cuentan buscando en nombre, marca y descripción.
export const TIPOS = [
  { id: 'mouse', nombre: 'Mouse', consulta: 'mouse', claves: ['mouse'], icono: 'mouse' },
  { id: 'teclados', nombre: 'Teclados', consulta: 'teclado', claves: ['teclado', 'keyboard'], icono: 'teclado' },
  { id: 'audifonos', nombre: 'Audífonos', consulta: 'audífono', claves: ['audifono', 'headset', 'headphone'], icono: 'audifonos' },
  { id: 'procesadores', nombre: 'Procesadores', consulta: 'procesador', claves: ['procesador', 'ryzen', 'intel core', 'cpu'], icono: 'cpu' },
  { id: 'memorias', nombre: 'Memorias RAM', consulta: 'memoria', claves: ['memoria', 'ram'], icono: 'ram' },
  { id: 'monitores', nombre: 'Monitores', consulta: 'monitor', claves: ['monitor', 'pantalla'], icono: 'monitor' },
  { id: 'notebooks', nombre: 'Notebooks', consulta: 'notebook', claves: ['notebook', 'laptop', 'portatil'], icono: 'notebook' },
  { id: 'celulares', nombre: 'Celulares', consulta: 'celular', claves: ['celular', 'smartphone', 'telefono'], icono: 'celular' },
  { id: 'controles', nombre: 'Controles', consulta: 'control', claves: ['control', 'joystick', 'gamepad', 'mando'], icono: 'gamepad' },
  { id: 'almacenamiento', nombre: 'Almacenamiento', consulta: 'ssd', claves: ['ssd', 'disco', 'nvme', 'hdd', 'pendrive'], icono: 'ssd' },
]

const normalizar = (texto) => (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function contarPorTipo(productos) {
  return TIPOS
    .map((tipo) => {
      const patrones = tipo.claves.map((clave) => new RegExp(`\\b${clave}`))
      const total = productos.filter((p) => {
        const texto = normalizar(`${p.nombre} ${p.marca} ${p.descripcion}`)
        return patrones.some((patron) => patron.test(texto))
      }).length
      return { ...tipo, total }
    })
    .filter((tipo) => tipo.total > 0)
}
