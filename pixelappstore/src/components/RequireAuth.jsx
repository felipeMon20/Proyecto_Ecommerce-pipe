import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexto/auth'

function RequireAuth({ children }) {
  const { usuario } = useAuth()
  const ubicacion = useLocation()

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  }
  return children
}

export default RequireAuth
