import { useCallback, useEffect, useState } from 'react'
import api from './api'

// Pregunta al backend si la acción exige captcha y guarda el token que entrega la casilla
function useCaptcha(accion) {
  const [estado, setEstado] = useState({ activo: false, siteKey: '', requerido: false })
  const [token, setToken] = useState('')
  const [reinicio, setReinicio] = useState(0)

  const consultar = useCallback(
    () => api.get('auth/captcha-estado', { params: { accion } })
      .then(({ data }) => setEstado({ activo: data.activo, siteKey: data.site_key, requerido: data.requerido }))
      .catch(() => {}),
    [accion],
  )

  useEffect(() => {
    consultar()
  }, [consultar])

  // Los tokens valen una sola vez: tras cada intento se pide uno nuevo y se vuelve a consultar
  const renovar = () => {
    setToken('')
    setReinicio((n) => n + 1)
    return consultar()
  }

  return { ...estado, token, setToken, reinicio, renovar }
}

export default useCaptcha
