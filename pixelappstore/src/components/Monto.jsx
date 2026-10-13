import { useEffect, useRef, useState } from 'react'
import { formatoCLP } from '../api'

// Anima el monto hasta su nuevo valor en vez de cambiarlo de golpe
function Monto({ valor }) {
  const [mostrado, setMostrado] = useState(valor)
  const actual = useRef(valor)

  useEffect(() => {
    const desde = actual.current
    if (desde === valor) return undefined
    const inicio = performance.now()
    let cuadro
    const paso = (ahora) => {
      const avance = Math.min(1, (ahora - inicio) / 380)
      const suave = 1 - (1 - avance) ** 3
      actual.current = Math.round(desde + (valor - desde) * suave)
      setMostrado(actual.current)
      if (avance < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [valor])

  return formatoCLP(mostrado)
}

export default Monto
