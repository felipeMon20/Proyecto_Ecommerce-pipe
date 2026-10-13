import { useEffect, useRef } from 'react'

// Cierra un menú desplegable al hacer clic fuera de él o presionar Escape
export default function useCerrarAlExterior(abierto, cerrar) {
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const alClic = (evento) => {
      if (ref.current && !ref.current.contains(evento.target)) cerrar()
    }
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') cerrar()
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto, cerrar])

  return ref
}
