import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import PixelArt from '../components/PixelArt'

const SALIDA_MS = 220

const TEXTOS = {
  registro: {
    titulo: 'Únete a Pixel App Store',
    texto: 'Crea tu cuenta y arma tu setup gamer con lo mejor en tecnología.',
  },
  login: {
    titulo: 'Qué bueno verte de vuelta',
    texto: 'Ingresa para ver tu carrito, tus compras y seguir armando tu setup.',
  },
  recuperar: {
    titulo: 'Recupera tu acceso',
    texto: 'Te enviamos un enlace al correo para que elijas una contraseña nueva en pocos pasos.',
  },
}

// Login y registro comparten la misma escena: el panel se desliza al otro lado al cambiar de pantalla
function AuthLayout() {
  const { pathname, state } = useLocation()
  const navigate = useNavigate()
  const [saliendo, setSaliendo] = useState(false)
  const temporizador = useRef(null)

  const registro = pathname === '/registro'
  const clave = pathname.startsWith('/recuperar') ? 'recuperar' : (registro ? 'registro' : 'login')
  const modo = registro ? 'registro' : 'login'
  const textos = TEXTOS[clave]

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const cambiarA = (ruta, estado) => {
    setSaliendo(true)
    temporizador.current = setTimeout(() => {
      navigate(ruta, { state: { desde: state?.desde, ...estado } })
      setSaliendo(false)
    }, SALIDA_MS)
  }

  return (
    <div className="contenedor">
      <div className={`auth auth-${modo}`}>
        <aside className="auth-panel">
          <div className="auth-escena" aria-hidden="true">
            <div className="auth-local">
              <img src="/logo.png" alt="" className="escena-rotulo" />
              <PixelArt nombre="tienda" tamano={224} />
            </div>
            <div className="escena-suelo" />
          </div>
          <div key={clave} className="auth-texto">
            <h2>{textos.titulo}</h2>
            <p>{textos.texto}</p>
          </div>
        </aside>

        <div className="auth-caja">
          <div key={pathname} className={saliendo ? 'auth-contenido saliendo' : 'auth-contenido'}>
            <Outlet context={{ cambiarA }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
