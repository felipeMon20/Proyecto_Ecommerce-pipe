import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import api, { mensajeError } from '../api'
import Captcha from '../components/Captcha'
import Icono from '../components/Icono'
import useCaptcha from '../useCaptcha'

function RecuperarPage() {
  const { cambiarA } = useOutletContext()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const captcha = useCaptcha('recuperar')

  const solicitar = async (evento) => {
    evento.preventDefault()
    setError(null)
    if (captcha.requerido && !captcha.token) {
      setError('Completa la verificación de seguridad')
      return
    }
    setEnviando(true)
    try {
      await api.post('auth/recuperar-solicitar', { email: email.trim(), captcha: captcha.token })
      setEnviado(true)
    } catch (e) {
      setError(mensajeError(e))
      captcha.renovar()
    } finally {
      setEnviando(false)
    }
  }

  const volver = (e) => {
    e.preventDefault()
    cambiarA('/login')
  }

  if (enviado) {
    return (
      <div className="auth-form auth-exito">
        <span className="auth-exito-icono"><Icono nombre="check" tamano={34} /></span>
        <h1>Revisa tu correo</h1>
        <p className="auth-sub">
          Si hay una cuenta con ese correo, te enviamos un enlace para elegir una contraseña nueva. El enlace vale 1 hora.
        </p>
        <p className="nota">Si no llega, revisa la carpeta de spam o inténtalo de nuevo en unos minutos.</p>
        <Link to="/login" className="auth-boton auth-enlace" onClick={volver}>Volver a iniciar sesión</Link>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={solicitar}>
      <h1>Recuperar contraseña</h1>
      <p className="auth-sub">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>
      <label className="campo">
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      {captcha.requerido && <Captcha siteKey={captcha.siteKey} onToken={captcha.setToken} reinicio={captcha.reinicio} />}
      {error && <div className="aviso error" role="alert">{error}</div>}
      <button className="auth-boton" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar enlace'}</button>
      <p className="nota centrado">
        <Link to="/login" onClick={volver}>Volver a iniciar sesión</Link>
      </p>
    </form>
  )
}

export default RecuperarPage
