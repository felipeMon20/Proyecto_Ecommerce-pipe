import { useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import api, { mensajeError } from '../api'
import { useAuth } from '../contexto/auth'
import Captcha from '../components/Captcha'
import useCaptcha from '../useCaptcha'

function LoginPage() {
  const { iniciarSesion } = useAuth()
  const { cambiarA } = useOutletContext()
  const navigate = useNavigate()
  const ubicacion = useLocation()
  const destino = ubicacion.state?.desde || '/'

  const [paso, setPaso] = useState(1)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const captcha = useCaptcha('login')

  const enviarCredenciales = async (evento) => {
    evento.preventDefault()
    setError(null)
    if (captcha.requerido && !captcha.token) {
      setError('Completa la verificación de seguridad')
      return
    }
    setEnviando(true)
    try {
      await api.post('auth/login-paso1', { username, password, captcha: captcha.token })
      setPaso(2)
    } catch (e) {
      setError(mensajeError(e))
      captcha.renovar()
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
    <div className="auth-form">
      <h1>Iniciar sesión</h1>
      <p className="auth-sub">{paso === 1 ? 'Ingresa con tu usuario y contraseña.' : 'Un último paso para proteger tu cuenta.'}</p>

      {ubicacion.state?.registrado && (
        <div className="aviso ok">Listo. Ahora puedes ingresar con tu usuario. Si tu correo ya tenía una cuenta, te avisamos por correo para que la recuperes.</div>
      )}
      {ubicacion.state?.recuperada && (
        <div className="aviso ok">Contraseña actualizada. Ya puedes ingresar con la nueva.</div>
      )}

      {paso === 1 ? (
        <form className="auth-paso" onSubmit={enviarCredenciales}>
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
          {captcha.requerido && <Captcha siteKey={captcha.siteKey} onToken={captcha.setToken} reinicio={captcha.reinicio} />}
          {error && <div className="aviso error" role="alert">{error}</div>}
          <button className="auth-boton" disabled={enviando}>{enviando ? 'Verificando...' : 'Continuar'}</button>
          <p className="nota centrado">
            <Link to="/recuperar" onClick={(e) => { e.preventDefault(); cambiarA('/recuperar') }}>¿Olvidaste tu contraseña?</Link>
          </p>
          <p className="nota centrado">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" onClick={(e) => { e.preventDefault(); cambiarA('/registro') }}>Regístrate</Link>
          </p>
        </form>
      ) : (
        <form className="auth-paso auth-paso-codigo" onSubmit={verificarCodigo}>
          <div className="aviso info">
            Te enviamos un código de 6 dígitos al correo de la cuenta. Vence en 10 minutos.
          </div>
          <label className="campo">
            Código de verificación
            <input
              className="auth-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
          </label>
          {error && <div className="aviso error" role="alert">{error}</div>}
          <button className="auth-boton" disabled={enviando || codigo.length !== 6}>
            {enviando ? 'Verificando...' : 'Ingresar'}
          </button>
          <button type="button" className="auth-boton secundario" onClick={() => { setPaso(1); setCodigo(''); setError(null) }}>
            Volver
          </button>
        </form>
      )}
    </div>
  )
}

export default LoginPage
