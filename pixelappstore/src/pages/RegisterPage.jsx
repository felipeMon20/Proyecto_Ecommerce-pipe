import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { mensajeError } from '../api'

function RegisterPage() {
  const navigate = useNavigate()
  const [datos, setDatos] = useState({ nombre: '', apellido: '', username: '', email: '', password: '', repetir: '' })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value })

  const registrar = async (evento) => {
    evento.preventDefault()
    setError(null)
    if (datos.password !== datos.repetir) {
      setError('Las contraseñas no coinciden')
      return
    }
    setEnviando(true)
    try {
      await api.post('auth/registro', { ...datos, repetir: undefined })
      navigate('/login', { state: { registrado: true } })
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="contenedor">
      <form className="tarjeta formulario" onSubmit={registrar}>
        <h1>Crear cuenta</h1>
        <label className="campo">Nombre<input value={datos.nombre} onChange={cambiar('nombre')} required /></label>
        <label className="campo">Apellido<input value={datos.apellido} onChange={cambiar('apellido')} required /></label>
        <label className="campo">Usuario<input value={datos.username} onChange={cambiar('username')} autoComplete="username" required /></label>
        <label className="campo">
          Correo
          <input type="email" value={datos.email} onChange={cambiar('email')} autoComplete="email" required />
        </label>
        <p className="nota" style={{ margin: 0 }}>Aquí recibirás el código de verificación para ingresar.</p>
        <label className="campo">
          Contraseña
          <input type="password" value={datos.password} onChange={cambiar('password')} autoComplete="new-password" required />
        </label>
        <label className="campo">
          Repetir contraseña
          <input type="password" value={datos.repetir} onChange={cambiar('repetir')} autoComplete="new-password" required />
        </label>
        {error && <div className="aviso error">{error}</div>}
        <button className="boton" disabled={enviando}>{enviando ? 'Creando...' : 'Crear cuenta'}</button>
        <p className="nota centrado">
          ¿Ya tienes cuenta? <Link to="/login">Ingresa</Link>
        </p>
      </form>
    </div>
  )
}

export default RegisterPage
