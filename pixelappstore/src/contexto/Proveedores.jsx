import { useCallback, useEffect, useState } from 'react'
import api from '../api'
import { AuthContext, CarritoContext, useAuth } from './auth'

const CLAVE = 'pixel_usuario'

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

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerUsuario)

  // La sesión del backend dura 10 minutos: al recibir un 401 se olvida al usuario
  useEffect(() => {
    const alExpirar = () => {
      guardarUsuario(null)
      setUsuario(null)
    }
    window.addEventListener('sesion-expirada', alExpirar)
    return () => window.removeEventListener('sesion-expirada', alExpirar)
  }, [])

  const iniciarSesion = (datos) => {
    const nuevo = { username: datos.usuario, esAdmin: datos.es_admin, esSuperuser: datos.es_superuser }
    guardarUsuario(nuevo)
    setUsuario(nuevo)
  }

  const cerrarSesion = async () => {
    try {
      await api.post('auth/logout')
    } finally {
      guardarUsuario(null)
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

  const agregar = async (productoId, unidades = 1) => {
    await api.post('carrito/agregar', { producto_id: productoId, cantidad: unidades })
    refrescar()
  }

  return (
    <CarritoContext.Provider value={{ cantidad: usuario ? cantidad : 0, refrescar, agregar }}>
      {children}
    </CarritoContext.Provider>
  )
}
