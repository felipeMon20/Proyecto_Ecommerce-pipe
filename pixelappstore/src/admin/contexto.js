import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { mensajeError } from '../api'

export const PanelContext = createContext(null)
export const usePanel = () => useContext(PanelContext)

// Carga datos al abrir y cada vez que se pide recargar; "peticion" devuelve una promesa con los datos
export function useDatos(peticion) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null })
  const [version, setVersion] = useState(0)
  const ultima = useRef(peticion)

  useEffect(() => {
    ultima.current = peticion
  })

  useEffect(() => {
    let vigente = true
    ultima.current()
      .then((datos) => {
        if (vigente) setEstado({ datos, cargando: false, error: null })
      })
      .catch((e) => {
        if (vigente) setEstado({ datos: null, cargando: false, error: mensajeError(e) })
      })
    return () => { vigente = false }
  }, [version])

  return { ...estado, recargar: () => setVersion((n) => n + 1) }
}
