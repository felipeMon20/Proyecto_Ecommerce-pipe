import { useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import api, { mensajeError } from '../api'
import ReglasClave from '../components/ReglasClave'
import { evaluarClave } from '../reglasClave'

function RecuperarConfirmarPage() {
  const { cambiarA } = useOutletContext()
  const [parametros] = useSearchParams()
  const uid = parametros.get('uid')
  const token = parametros.get('token')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const reglas = evaluarClave({ clave: nueva, repetir, usuario: '', correo: '' })

  const guardar = async (evento) => {
    evento.preventDefault()
    setError(null)
    if (!reglas.every((r) => r.ok)) {
      setError('Aún faltan indicaciones por cumplir en la contraseña.')
      return
    }
    setEnviando(true)
    try {
      await api.post('auth/recuperar-confirmar', { uid, token, new_password: nueva })
      cambiarA('/login', { recuperada: true })
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  if (!uid || !token) {
    return (
      <div className="auth-form">
        <h1>Enlace incompleto</h1>
        <p className="auth-sub">Este enlace no es válido. Pide uno nuevo para recuperar tu contraseña.</p>
        <Link to="/recuperar" className="auth-boton auth-enlace" onClick={(e) => { e.preventDefault(); cambiarA('/recuperar') }}>
          Pedir un enlace nuevo
        </Link>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={guardar}>
      <h1>Nueva contraseña</h1>
      <p className="auth-sub">Elige una contraseña segura que no uses en otros sitios.</p>
      <label className="campo">
        Contraseña nueva
        <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required />
      </label>
      <label className="campo">
        Repetir contraseña
        <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required />
      </label>
      <ReglasClave reglas={reglas} clave={nueva} />
      {error && (
        <div className="aviso error" role="alert">
          {error} {error.includes('enlace') && <Link to="/recuperar" onClick={(e) => { e.preventDefault(); cambiarA('/recuperar') }}>Pedir uno nuevo</Link>}
        </div>
      )}
      <button className="auth-boton" disabled={enviando}>{enviando ? 'Guardando...' : 'Guardar contraseña'}</button>
    </form>
  )
}

export default RecuperarConfirmarPage
