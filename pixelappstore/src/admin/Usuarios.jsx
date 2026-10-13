import { useState } from 'react'
import api, { mensajeError } from '../api'
import Icono from '../components/Icono'
import ReglasClave from '../components/ReglasClave'
import { evaluarClave } from '../reglasClave'
import { useDatos, usePanel } from './contexto'
import { Campo, Cargando, Chip, ErrorCaja, Modal, Tarjeta, Vacio } from './ui'
import { normalizar } from './utils'

function FormularioEmpleado({ alTerminar, alCerrar }) {
  const { avisar } = usePanel()
  const [form, setForm] = useState({ nombre: '', username: '', email: '', password: '', repetir: '' })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const reglas = evaluarClave({ clave: form.password, repetir: form.repetir, usuario: form.username, correo: form.email })
  const lista = reglas.every((r) => r.ok)

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const guardar = async (evento) => {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await api.post('empleados/crear', { nombre: form.nombre, username: form.username, email: form.email, password: form.password })
      avisar('ok', 'Empleado creado')
      alTerminar()
    } catch (e) {
      setError(mensajeError(e))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nuevo empleado" alCerrar={alCerrar} ancho={620}>
      <form className="adm-formulario" onSubmit={guardar}>
        <div className="adm-grid-2">
          <Campo etiqueta="Nombre"><input value={form.nombre} onChange={cambiar('nombre')} required /></Campo>
          <Campo etiqueta="Usuario"><input value={form.username} onChange={cambiar('username')} autoComplete="off" required /></Campo>
          <Campo etiqueta="Correo" ayuda="Recibe el código de verificación al ingresar"><input type="email" value={form.email} onChange={cambiar('email')} required /></Campo>
          <span />
          <Campo etiqueta="Contraseña"><input type="password" value={form.password} onChange={cambiar('password')} autoComplete="new-password" required /></Campo>
          <Campo etiqueta="Repetir contraseña"><input type="password" value={form.repetir} onChange={cambiar('repetir')} autoComplete="new-password" required /></Campo>
        </div>
        <ReglasClave reglas={reglas} clave={form.password} />
        {error && <div className="adm-aviso error" role="alert">{error}</div>}
        <div className="adm-pie-modal">
          <button type="button" className="adm-boton secundario" onClick={alCerrar}>Cancelar</button>
          <button className="adm-boton" disabled={guardando || !lista}>{guardando ? 'Creando...' : 'Crear empleado'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Empleados() {
  const { avisar } = usePanel()
  const { datos, cargando, error, recargar } = useDatos(() => api.get('empleados/listar').then((r) => r.data.empleados))
  const [crear, setCrear] = useState(false)

  if (cargando) return <Cargando />
  if (error) return <ErrorCaja texto={error} alReintentar={recargar} />

  const alternar = async (empleado) => {
    try {
      await api.put(`empleados/editar/${empleado.id}`, { is_active: !empleado.is_active })
      avisar('ok', empleado.is_active ? 'Empleado desactivado' : 'Empleado activado')
      recargar()
    } catch (e) {
      avisar('error', mensajeError(e))
    }
  }

  return (
    <Tarjeta
      titulo={`Empleados (${datos.length})`}
      acciones={<button type="button" className="adm-boton" onClick={() => setCrear(true)}><Icono nombre="mas" tamano={16} /> Nuevo empleado</button>}
    >
      <p className="adm-nota">Los empleados pueden vender en mostrador, administrar productos y ver las ventas. Para quitarles el acceso, desactívalos.</p>
      {datos.length === 0 ? <Vacio texto="Aún no hay empleados." /> : (
        <div className="adm-scroll">
          <table className="adm-tabla">
            <thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Estado</th><th className="der">Acceso</th></tr></thead>
            <tbody>
              {datos.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.first_name || '-'}</strong></td>
                  <td>{e.username}</td>
                  <td>{e.email}</td>
                  <td>{e.is_active ? <Chip tono="bueno">Activo</Chip> : <Chip tono="malo">Desactivado</Chip>}</td>
                  <td className="der"><button type="button" className={e.is_active ? 'adm-boton secundario chico' : 'adm-boton chico'} onClick={() => alternar(e)}>{e.is_active ? 'Desactivar' : 'Activar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {crear && <FormularioEmpleado alCerrar={() => setCrear(false)} alTerminar={() => { setCrear(false); recargar() }} />}
    </Tarjeta>
  )
}

function Clientes() {
  const { avisar } = usePanel()
  const { datos, cargando, error, recargar } = useDatos(() => api.get('usuarios/listar').then((r) => r.data.usuarios))
  const [busqueda, setBusqueda] = useState('')
  const [aEliminar, setAEliminar] = useState(null)

  if (cargando) return <Cargando />
  if (error) return <ErrorCaja texto={error} alReintentar={recargar} />

  const texto = normalizar(busqueda)
  const clientes = datos.filter((u) => !u.is_staff && (!texto || normalizar(`${u.username} ${u.email}`).includes(texto)))

  const eliminar = async () => {
    try {
      await api.delete(`usuarios/eliminar/${aEliminar.id}`)
      avisar('ok', 'Cliente eliminado')
      recargar()
    } catch (e) {
      avisar('error', mensajeError(e))
    }
    setAEliminar(null)
  }

  return (
    <Tarjeta titulo={`Clientes (${clientes.length})`}>
      <label className="adm-buscador">
        <Icono nombre="lupa" tamano={16} />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por usuario o correo" />
      </label>
      {clientes.length === 0 ? <Vacio texto="No hay clientes con esa búsqueda." /> : (
        <div className="adm-scroll">
          <table className="adm-tabla">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Estado</th><th className="der">Eliminar</th></tr></thead>
            <tbody>
              {clientes.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.is_active ? <Chip tono="bueno">Activo</Chip> : <Chip>Inactivo</Chip>}</td>
                  <td className="der"><button type="button" className="adm-icono-boton peligro" onClick={() => setAEliminar(u)} aria-label={`Eliminar ${u.username}`}><Icono nombre="basura" tamano={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aEliminar && (
        <Modal titulo="Eliminar cliente" alCerrar={() => setAEliminar(null)} ancho={440}>
          <p>¿Eliminar la cuenta de <strong>{aEliminar.username}</strong>? Perderá su acceso y su carrito. Sus pedidos pasados se conservan.</p>
          <div className="adm-pie-modal">
            <button type="button" className="adm-boton secundario" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button type="button" className="adm-boton peligro" onClick={eliminar}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
    </Tarjeta>
  )
}

function Usuarios() {
  const [pestana, setPestana] = useState('empleados')
  return (
    <div className="adm-pagina">
      <div className="adm-pestanas grandes" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'empleados'} className={pestana === 'empleados' ? 'activa' : ''} onClick={() => setPestana('empleados')}>Empleados</button>
        <button type="button" role="tab" aria-selected={pestana === 'clientes'} className={pestana === 'clientes' ? 'activa' : ''} onClick={() => setPestana('clientes')}>Clientes</button>
      </div>
      {pestana === 'empleados' ? <Empleados /> : <Clientes />}
    </div>
  )
}

export default Usuarios
