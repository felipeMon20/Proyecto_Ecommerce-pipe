import { ICONOS, PALETA } from './iconosPixel'

// Une los píxeles contiguos de un mismo color en una sola fila para generar menos rectángulos
function rectangulos(filas) {
  const lista = []
  filas.forEach((fila, y) => {
    let x = 0
    while (x < fila.length) {
      const color = fila[x]
      if (color === '.') {
        x += 1
        continue
      }
      let ancho = 1
      while (fila[x + ancho] === color) ancho += 1
      lista.push({ x, y, ancho, color: PALETA[color] })
      x += ancho
    }
  })
  return lista
}

function PixelArt({ nombre, tamano = 64, className = '' }) {
  const filas = ICONOS[nombre]
  if (!filas) return null
  const columnas = filas[0].length
  return (
    <svg
      className={`pixel-art ${className}`}
      width={tamano}
      height={(tamano * filas.length) / columnas}
      viewBox={`0 0 ${columnas} ${filas.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rectangulos(filas).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.ancho} height="1" fill={r.color} />
      ))}
    </svg>
  )
}

export default PixelArt
