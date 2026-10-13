import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../contexto/auth'
import NoEncontradaPage from './NoEncontradaPage'

// El código del panel va en un paquete aparte: solo se descarga si el servidor confirma el acceso
const AdminApp = lazy(() => import('../admin/AdminApp'))

// Cualquier dirección desconocida: para el público es una 404. La dirección del panel no está escrita en el
// sitio; solo el servidor sabe cuál es y solo la acepta si la sesión es de staff.
function RutaDesconocida() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const primera = pathname.split('/')[1] || ''
  const [resultado, setResultado] = useState({ para: null, acceso: null })

  useEffect(() => {
    if (!usuario || !primera) return undefined
    let vigente = true
    api.post('panel/acceso', { ruta: primera })
      .then(({ data }) => {
        if (vigente) setResultado({ para: primera, acceso: data })
      })
      .catch(() => {
        if (vigente) setResultado({ para: primera, acceso: false })
      })
    return () => { vigente = false }
  }, [usuario, primera])

  if (!usuario || !primera) return <NoEncontradaPage />
  if (resultado.para !== primera) return null
  if (!resultado.acceso) return <NoEncontradaPage />

  return (
    <Suspense fallback={null}>
      <AdminApp acceso={resultado.acceso} />
    </Suspense>
  )
}

export default RutaDesconocida
