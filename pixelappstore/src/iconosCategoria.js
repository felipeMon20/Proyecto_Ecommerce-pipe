// Agrupación e íconos pixel de las categorías, compartidos por el menú del header y la portada
export const GRUPOS_CATEGORIAS = [
  { id: 'perifericos', titulo: 'Periféricos', nombres: ['Mouse', 'Teclados', 'Audífonos', 'Controles'] },
  { id: 'pantallas', titulo: 'Pantallas y juegos', nombres: ['Monitores', 'Televisores', 'Consolas', 'Notebooks', 'Realidad virtual'] },
  { id: 'componentes', titulo: 'Componentes de PC', nombres: ['Tarjetas de video', 'Procesadores', 'Placas madre', 'Memorias RAM', 'Almacenamiento', 'Fuentes de poder', 'Refrigeración'] },
  { id: 'mas', titulo: 'Más', nombres: ['Streaming', 'Accesorios'] },
]

export const ICONO_CATEGORIA = {
  Mouse: 'mouse',
  Teclados: 'teclado',
  Audífonos: 'audifonos',
  Controles: 'gamepad',
  Monitores: 'monitor',
  Televisores: 'monitor',
  Consolas: 'gamepad',
  Notebooks: 'notebook',
  'Tarjetas de video': 'cpu',
  Procesadores: 'cpu',
  'Placas madre': 'cpu',
  'Memorias RAM': 'ram',
  Almacenamiento: 'ssd',
  'Realidad virtual': 'vr',
  'Fuentes de poder': 'fuente',
  Refrigeración: 'ventilador',
  Streaming: 'streaming',
  Accesorios: 'accesorios',
}

export const ORDEN_CATEGORIAS = GRUPOS_CATEGORIAS.flatMap((g) => g.nombres)
