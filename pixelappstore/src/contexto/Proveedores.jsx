import { useCallback, useEffect, useState } from 'react'
import api, { PASIVO } from '../api'
import useRefrescoPeriodico from '../useRefrescoPeriodico'
import { AuthContext, CarritoContext, useAuth } from './auth'

const CLAVE = 'pixel_usuario'
const CLAVE_DIRECCION = 'pixel_direccion'

function leerUsuario() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE))
  } catch {
    return null
  }
}

function guardarUsuario(usuario) {
  try {
    if (usuario) localStorage.setItem(CLAVE, JSON.stringify(usuario))
    else localStorage.removeItem(CLAVE)
  } catch {
    // sin almacenamiento disponible: la sesión sigue viviendo en la cookie
  }
}

// Limpia la dirección que versiones anteriores guardaban en el navegador; ahora vive en la cuenta
function olvidarDireccion() {
  try {
    localStorage.removeItem(CLAVE_DIRECCION)
  } catch {
    // sin almacenamiento disponible
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerUsuario)

  // La sesión del backend dura 10 minutos: al recibir un 401 se olvida al usuario
  useEffect(() => {
    const alExpirar = () => {
      guardarUsuario(null)
      olvidarDireccion()
      setUsuario(null)
    }
    window.addEventListener('sesion-expirada', alExpirar)
    return () => window.removeEventListener('sesion-expirada', alExpirar)
  }, [])

  const iniciarSesion = (datos) => {
    const nuevo = { username: datos.usuario }
    guardarUsuario(nuevo)
    setUsuario(nuevo)
  }

  const cerrarSesion = async () => {
    try {
      await api.post('auth/logout')
    } finally {
      guardarUsuario(null)
      olvidarDireccion()
      setUsuario(null)
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function CarritoProvider({ children }) {
  const { usuario } = useAuth()
  const [cantidad, setCantidad] = useState(0)
  const [version, setVersion] = useState(0)
  const [pulso, setPulso] = useState(0)

  useEffect(() => {
    if (!usuario) return
    let vigente = true
    api.get('carrito/ver')
      .then(({ data }) => {
        if (vigente) setCantidad(data.items.reduce((suma, item) => suma + item.cantidad, 0))
      })
      .catch(() => {
        if (vigente) setCantidad(0)
      })
    return () => { vigente = false }
  }, [usuario, version])

  const refrescar = useCallback(() => setVersion((n) => n + 1), [])

  // Comprueba cada tanto que la sesión siga viva (si no, el 401 olvida al usuario) sin renovarla
  useRefrescoPeriodico(() => {
    if (usuario) api.get('carrito/ver', PASIVO).catch(() => {})
  }, 30000)

  const agregar = async (productoId, unidades = 1) => {
    await api.post('carrito/agregar', { producto_id: productoId, cantidad: unidades })
    refrescar()
    setPulso((n) => n + 1)
  }

  return (
    <CarritoContext.Provider value={{ cantidad: usuario ? cantidad : 0, pulso, refrescar, agregar }}>
      {children}
    </CarritoContext.Provider>
  )
}
