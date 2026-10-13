import axios from 'axios'

// Todas las llamadas pasan por el proxy de Vite (/api -> backend Django)
const api = axios.create({ baseURL: '/api', withCredentials: true })

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('sesion-expirada'))
    }
    return Promise.reject(error)
  },
)

export function mensajeError(error, porDefecto = 'Ocurrió un error. Intenta de nuevo.') {
  if (!error.response) return 'No hay conexión con el servidor. ¿Está encendido el backend?'
  return error.response.data?.error || porDefecto
}

export const formatoCLP = (valor) => `$${Number(valor || 0).toLocaleString('es-CL')}`

export default api
