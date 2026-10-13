import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import api, { mensajeError } from '../api'
import Captcha from '../components/Captcha'
import ReglasClave from '../components/ReglasClave'
import { evaluarClave } from '../reglasClave'
import useCaptcha from '../useCaptcha'

function RegisterPage() {
  const { cambiarA } = useOutletContext()
  const [datos, setDatos] = useState({ nombre: '', apellido: '', username: '', email: '', password: '', repetir: '' })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const captcha = useCaptcha('registro')
  const reglas = evaluarClave({ clave: datos.password, repetir: datos.repetir, usuario: datos.username, correo: datos.email })

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value })

  const registrar = async (evento) => {
    evento.preventDefault()
    setError(null)
    if (!reglas.every((r) => r.ok)) {
      setError('Aún faltan indicaciones por cumplir en la contraseña.')
      return
    }
    if (captcha.requerido && !captcha.token) {
      setError('Completa la verificación de seguridad')
      return
    }
    setEnviando(true)
    try {
      await api.post('auth/registro', { ...datos, repetir: undefined, captcha: captcha.token })
      cambiarA('/login', { registrado: true })
    } catch (e) {
      setError(mensajeError(e))
      captcha.renovar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={registrar}>
      <h1>Crear cuenta</h1>
      <p className="auth-sub">Completa tus datos para empezar a comprar.</p>
      <div className="auth-fila">
        <label className="campo">Nombre<input value={datos.nombre} onChange={cambiar('nombre')} autoComplete="given-name" required /></label>
        <label className="campo">Apellido<input value={datos.apellido} onChange={cambiar('apellido')} autoComplete="family-name" required /></label>
      </div>
      <label className="campo">Usuario<input value={datos.username} onChange={cambiar('username')} autoComplete="username" required /></label>
      <label className="campo">
        Correo
        <input type="email" value={datos.email} onChange={cambiar('email')} autoComplete="email" required />
        <small>Aquí recibirás el código de verificación para ingresar.</small>
      </label>
      <div className="auth-fila">
        <label className="campo">
          Contraseña
          <input type="password" value={datos.password} onChange={cambiar('password')} autoComplete="new-password" required />
        </label>
        <label className="campo">
          Repetir contraseña
          <input type="password" value={datos.repetir} onChange={cambiar('repetir')} autoComplete="new-password" required />
        </label>
      </div>
      <ReglasClave reglas={reglas} clave={datos.password} />
      {captcha.requerido && <Captcha siteKey={captcha.siteKey} onToken={captcha.setToken} reinicio={captcha.reinicio} />}
      {error && <div className="aviso error" role="alert">{error}</div>}
      <button className="auth-boton" disabled={enviando}>{enviando ? 'Creando...' : 'Crear cuenta'}</button>
      <p className="nota centrado">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" onClick={(e) => { e.preventDefault(); cambiarA('/login') }}>Ingresa</Link>
      </p>
    </form>
  )
}

export default RegisterPage
