import axios from 'axios'

// Todas las llamadas pasan por el proxy de Vite (/api -> backend Django)
const api = axios.create({ baseURL: '/api', withCredentials: true })

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('sesion-expirada'))
    }
    // El servidor pide frenar (recargas seguidas o demasiada gente): se muestra la pantalla de espera
    if (error.response?.status === 429 && error.response.data?.saturacion) {
      window.dispatchEvent(new CustomEvent('saturacion', { detail: error.response.data }))
    }
    return Promise.reject(error)
  },
)

// Consultas automáticas: no cuentan como actividad del usuario para la expiración de la sesión
export const PASIVO = { headers: { 'X-Actividad-Pasiva': '1' } }

export function mensajeError(error, porDefecto = 'Ocurrió un error. Intenta de nuevo.') {
  if (!error.response) return 'No hay conexión con el servidor. ¿Está encendido el backend?'
  return error.response.data?.error || porDefecto
}

export const formatoCLP = (valor) => `$${Number(valor || 0).toLocaleString('es-CL')}`

export default api
