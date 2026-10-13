import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api, { mensajeError } from '../api'
import { useAuth } from '../contexto/auth'

function LoginPage() {
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const ubicacion = useLocation()
  const destino = ubicacion.state?.desde || '/'

  const [paso, setPaso] = useState(1)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const enviarCredenciales = async (evento) => {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await api.post('auth/login-paso1', { username, password })
      setPaso(2)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const verificarCodigo = async (evento) => {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const { data } = await api.post('auth/login-paso2', { username, codigo })
      iniciarSesion(data)
      navigate(destino, { replace: true })
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="contenedor">
      <div className="tarjeta formulario">
        <h1>Iniciar sesión</h1>

        {ubicacion.state?.registrado && (
          <div className="aviso ok">Cuenta creada. Ahora puedes ingresar.</div>
        )}

        {paso === 1 ? (
          <form className="formulario" onSubmit={enviarCredenciales}>
            <label className="campo">
              Usuario
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </label>
            <label className="campo">
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <div className="aviso error">{error}</div>}
            <button className="boton" disabled={enviando}>{enviando ? 'Verificando...' : 'Continuar'}</button>
            <p className="nota centrado">
              ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
            </p>
          </form>
        ) : (
          <form className="formulario" onSubmit={verificarCodigo}>
            <div className="aviso info">
              Te enviamos un código de 6 dígitos al correo de la cuenta. Vence en 10 minutos.
            </div>
            <label className="campo">
              Código de verificación
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </label>
            {error && <div className="aviso error">{error}</div>}
            <button className="boton" disabled={enviando || codigo.length !== 6}>
              {enviando ? 'Verificando...' : 'Ingresar'}
            </button>
            <button type="button" className="boton secundario" onClick={() => { setPaso(1); setCodigo(''); setError(null) }}>
              Volver
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default LoginPage
