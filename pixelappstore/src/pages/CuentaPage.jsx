import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { mensajeError } from '../api'
import Icono from '../components/Icono'
import { REGIONES } from '../regiones'
import { comunaDeRegion } from '../comunas'
import CampoComuna from '../components/CampoComuna'
import ReglasClave from '../components/ReglasClave'
import { evaluarClave } from '../reglasClave'

const DIRECCION_VACIA = { nombre: '', telefono: '', calle: '', numero: '', complemento: '', comuna: '', indicaciones: '' }
const IDEALES = ['nombre', 'telefono', 'calle', 'numero', 'comuna']

function Campo({ etiqueta, nombre, valor, alCambiar, ancho = 2, opcional = false, soloLectura = false, ...resto }) {
  return (
    <label className={`dir-campo dir-${ancho}`}>
      <span>{etiqueta}{opcional && <small> (opcional)</small>}</span>
      <input name={nombre} value={valor} onChange={(e) => alCambiar(nombre, e.target.value)} readOnly={soloLectura} className={soloLectura ? 'solo-lectura' : ''} {...resto} />
    </label>
  )
}

function CuentaPage() {
  const [carga, setCarga] = useState({ cargando: true, error: null })
  const [perfil, setPerfil] = useState(null)
  const [form, setForm] = useState(null)
  const [guardado, setGuardado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [clave, setClave] = useState({ actual: '', nueva: '', repetir: '' })
  const [avisoClave, setAvisoClave] = useState(null)
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const [verClave, setVerClave] = useState(false)
  const [parametros, setParametros] = useSearchParams()
  const seccion = parametros.get('seccion') === 'clave' ? 'clave' : 'datos'

  const aplicar = (data) => {
    const f = { nombre: data.nombre, apellido: data.apellido, region: data.region, direccion: { ...DIRECCION_VACIA, ...data.direccion } }
    setPerfil(data)
    setForm(f)
    setGuardado(JSON.stringify(f))
  }

  useEffect(() => {
    let vigente = true
    api.get('cuenta/perfil')
      .then(({ data }) => {
        if (!vigente) return
        aplicar(data)
        setCarga({ cargando: false, error: null })
      })
      .catch((e) => {
        if (vigente) setCarga({ cargando: false, error: mensajeError(e) })
      })
    return () => { vigente = false }
  }, [])

  if (carga.cargando) return <div className="contenedor"><p className="vacio">Cargando tu cuenta...</p></div>
  if (carga.error) return <div className="contenedor"><div className="aviso error">{carga.error}</div></div>

  const cambiarDireccion = (campo, valor) => setForm((f) => ({ ...f, direccion: { ...f.direccion, [campo]: valor } }))
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))
  const cambiarRegion = (region) => setForm((f) => ({
    ...f,
    region,
    direccion: comunaDeRegion(region, f.direccion.comuna) ? f.direccion : { ...f.direccion, comuna: '' },
  }))
  const cambiarCampoClave = (campo, valor) => {
    setAvisoClave(null)
    setClave((x) => ({ ...x, [campo]: valor }))
  }
  const cambiarSeccion = (nueva) => setParametros(nueva === 'clave' ? { seccion: 'clave' } : {}, { replace: true })

  const completados = IDEALES.filter((c) => form.direccion[c].trim()).length
  const porcentaje = Math.round((completados / IDEALES.length) * 100)
  const sinGuardar = JSON.stringify(form) !== guardado
  const inicial = (perfil.nombre || perfil.username).charAt(0).toUpperCase()
  const reglasClave = evaluarClave({ clave: clave.nueva, repetir: clave.repetir, actual: clave.actual, usuario: perfil.username, correo: perfil.email })
  const claveLista = reglasClave.every((r) => r.ok)

  const guardar = async (evento) => {
    evento.preventDefault()
    setAviso(null)
    setGuardando(true)
    try {
      const { data } = await api.post('cuenta/perfil', form)
      aplicar(data)
      setAviso({ tipo: 'ok', texto: 'Cambios guardados. Ya podrás usar estos datos al comprar.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) })
    } finally {
      setGuardando(false)
    }
  }

  const cambiarClave = async (evento) => {
    evento.preventDefault()
    setAvisoClave(null)
    if (!claveLista) {
      setAvisoClave({ tipo: 'error', texto: 'Aún faltan indicaciones por cumplir en la contraseña nueva.' })
      return
    }
    setCambiandoClave(true)
    try {
      await api.post('cuenta/cambiar-clave', { actual: clave.actual, nueva: clave.nueva })
      setClave({ actual: '', nueva: '', repetir: '' })
      setAvisoClave({ tipo: 'ok', texto: 'Contraseña actualizada. Se cerrará tu sesión en otros dispositivos.' })
    } catch (e) {
      setAvisoClave({ tipo: 'error', texto: mensajeError(e) })
    } finally {
      setCambiandoClave(false)
    }
  }

  return (
    <div className="contenedor">
      <div className="cuenta">
        <aside className="cuenta-lateral">
          <div className="cuenta-perfil">
            <span className="cuenta-avatar">{inicial}</span>
            <strong>{[perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || perfil.username}</strong>
            <small>@{perfil.username}</small>
            <small>{perfil.email}</small>
          </div>

          <div className="cuenta-ideal">
            <div className="cuenta-barra" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${porcentaje}%` }} />
            </div>
            <strong>Perfil al {porcentaje}%</strong>
            {porcentaje < 100 ? (
              <p>
                Es ideal completar tu dirección y teléfono: así no tendrás que escribirlos en cada compra.
                Puedes hacerlo ahora o más tarde; no es obligatorio.
              </p>
            ) : (
              <p>Listo: tus datos de entrega se rellenarán solos cuando compres.</p>
            )}
          </div>

          <Link to="/mis-compras" className="cuenta-enlace"><Icono nombre="tienda" tamano={18} /> Mis compras</Link>
        </aside>

        <div className="cuenta-principal">
          <div className="cuenta-pestanas" role="tablist">
            <button type="button" role="tab" aria-selected={seccion === 'datos'} className={seccion === 'datos' ? 'activa' : ''} onClick={() => cambiarSeccion('datos')}>
              <Icono nombre="usuario" tamano={18} /> Mi información
            </button>
            <button type="button" role="tab" aria-selected={seccion === 'clave'} className={seccion === 'clave' ? 'activa' : ''} onClick={() => cambiarSeccion('clave')}>
              <Icono nombre="candado" tamano={18} /> Contraseña
            </button>
          </div>

          <div key={seccion} className="cuenta-panel">
            {seccion === 'datos' ? (
              <form className="cuenta-bloque" onSubmit={guardar}>
                <h2>Mis datos</h2>
                <div className="dir-grid">
                  <Campo nombre="nombre" etiqueta="Nombre" valor={form.nombre} alCambiar={cambiar} maxLength={150} autoComplete="given-name" />
                  <Campo nombre="apellido" etiqueta="Apellido" valor={form.apellido} alCambiar={cambiar} maxLength={150} autoComplete="family-name" />
                  <Campo nombre="username" etiqueta="Usuario" valor={perfil.username} alCambiar={() => {}} soloLectura />
                  <Campo nombre="email" etiqueta="Correo" valor={perfil.email} alCambiar={() => {}} soloLectura />
                </div>
                <p className="cuenta-nota">El usuario y el correo no se pueden cambiar desde aquí.</p>

                <h2>Datos de entrega</h2>
                <label className="dir-campo dir-2">
                  <span>Región</span>
                  <select value={form.region} onChange={(e) => cambiarRegion(e.target.value)}>
                    {REGIONES.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
                  </select>
                </label>
                <div className="dir-grid">
                  <Campo nombre="nombre" etiqueta="Nombre de quien recibe" valor={form.direccion.nombre} alCambiar={cambiarDireccion} maxLength={100} autoComplete="name" />
                  <Campo nombre="telefono" etiqueta="Teléfono de contacto" valor={form.direccion.telefono} alCambiar={cambiarDireccion} type="tel" placeholder="+56 9 1234 5678" maxLength={30} autoComplete="tel" />
                  <Campo nombre="calle" etiqueta="Calle" valor={form.direccion.calle} alCambiar={cambiarDireccion} maxLength={150} autoComplete="address-line1" />
                  <Campo nombre="numero" etiqueta="Número" ancho={1} valor={form.direccion.numero} alCambiar={cambiarDireccion} maxLength={20} />
                  <Campo nombre="complemento" etiqueta="Depto / casa" ancho={1} opcional valor={form.direccion.complemento} alCambiar={cambiarDireccion} maxLength={60} />
                  <CampoComuna region={form.region} valor={form.direccion.comuna} alCambiar={cambiarDireccion} />
                  <Campo nombre="indicaciones" etiqueta="Indicaciones para el repartidor" opcional valor={form.direccion.indicaciones} alCambiar={cambiarDireccion} placeholder="Ej: portón negro, timbre 5" maxLength={255} />
                </div>

                {aviso && <div className={`aviso ${aviso.tipo}`} role="status">{aviso.texto}</div>}
                <div className="cuenta-guardar">
                  <button className="auth-boton" disabled={guardando || !sinGuardar}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
                  {sinGuardar && <span className="cuenta-pendiente">Tienes cambios sin guardar (puedes salir sin guardarlos).</span>}
                </div>
              </form>
            ) : (
              <form className="cuenta-bloque compacto" onSubmit={cambiarClave}>
                <h2>Restablecer contraseña</h2>
                <p className="cuenta-nota">Escribe tu contraseña actual y elige una nueva que cumpla las indicaciones.</p>
                <div className="clave-columnas">
                  <div className="clave-campos">
                    <Campo nombre="actual" etiqueta="Contraseña actual" valor={clave.actual} alCambiar={cambiarCampoClave} type={verClave ? 'text' : 'password'} autoComplete="current-password" required />
                    <Campo nombre="nueva" etiqueta="Contraseña nueva" valor={clave.nueva} alCambiar={cambiarCampoClave} type={verClave ? 'text' : 'password'} autoComplete="new-password" required />
                    <Campo nombre="repetir" etiqueta="Repetir contraseña nueva" valor={clave.repetir} alCambiar={cambiarCampoClave} type={verClave ? 'text' : 'password'} autoComplete="new-password" required />
                  </div>
                  <ReglasClave reglas={reglasClave} clave={clave.nueva} />
                </div>

                {avisoClave && <div className={`aviso ${avisoClave.tipo}`} role="status">{avisoClave.texto}</div>}
                <div className="cuenta-guardar">
                  <button className="auth-boton compacto" disabled={cambiandoClave || !clave.actual || !claveLista}>
                    {cambiandoClave ? 'Actualizando...' : 'Cambiar contraseña'}
                  </button>
                  <label className="clave-ver">
                    <input type="checkbox" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} />
                    Mostrar contraseñas
                  </label>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CuentaPage
