import { useState } from 'react'
import api, { mensajeError } from '../api'
import Icono from '../components/Icono'
import { useDatos, usePanel } from './contexto'
import { Campo, Cargando, Chip, ErrorCaja, Modal, Tarjeta, Vacio } from './ui'

function manana() {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
}

function FormularioCupon({ cupon, alTerminar, alCerrar }) {
  const { avisar } = usePanel()
  const edicion = Boolean(cupon)
  const [form, setForm] = useState(edicion ? {
    codigo: cupon.codigo, porcentaje: String(cupon.porcentaje), expira: cupon.expira,
    usos_maximos: cupon.usos_maximos ?? '', usos_por_usuario: cupon.usos_por_usuario ?? '', activo: cupon.activo,
  } : { codigo: '', porcentaje: '10', expira: manana(), usos_maximos: '', usos_por_usuario: '1', activo: true })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const guardar = async (evento) => {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await api.post('panel/cupones/guardar', { ...form, id: cupon?.id })
      avisar('ok', 'Cupón guardado')
      alTerminar()
    } catch (e) {
      setError(mensajeError(e))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={edicion ? `Editar ${cupon.codigo}` : 'Nuevo cupón'} alCerrar={alCerrar} ancho={520}>
      <form className="adm-formulario" onSubmit={guardar}>
        <div className="adm-grid-2">
          <Campo etiqueta="Código" ayuda="Letras, números y _ (se guarda en mayúsculas)"><input value={form.codigo} onChange={cambiar('codigo')} maxLength={40} required /></Campo>
          <Campo etiqueta="Descuento (%)" ayuda="Solo sobre los productos, no el envío"><input type="number" min="1" max="100" value={form.porcentaje} onChange={cambiar('porcentaje')} required /></Campo>
          <Campo etiqueta="Vence el"><input type="date" value={form.expira} onChange={cambiar('expira')} required /></Campo>
          <Campo etiqueta="Usos por cliente" ayuda="Vacío = sin tope"><input type="number" min="1" value={form.usos_por_usuario} onChange={cambiar('usos_por_usuario')} /></Campo>
          <Campo etiqueta="Usos totales" ayuda="Vacío = sin tope. ¡Ojo con dejarlo sin límite!"><input type="number" min="1" value={form.usos_maximos} onChange={cambiar('usos_maximos')} /></Campo>
          <label className="adm-interruptor">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            <span>Cupón activo</span>
          </label>
        </div>
        {error && <div className="adm-aviso error" role="alert">{error}</div>}
        <div className="adm-pie-modal">
          <button type="button" className="adm-boton secundario" onClick={alCerrar}>Cancelar</button>
          <button className="adm-boton" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cupón'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Cupones() {
  const { datos, cargando, error, recargar } = useDatos(() => api.get('panel/cupones').then((r) => r.data.cupones))
  const [formulario, setFormulario] = useState(null)

  if (cargando) return <Cargando />
  if (error) return <ErrorCaja texto={error} alReintentar={recargar} />

  return (
    <div className="adm-pagina">
      <Tarjeta
        titulo="Cupones de descuento"
        acciones={<button type="button" className="adm-boton" onClick={() => setFormulario('nuevo')}><Icono nombre="mas" tamano={16} /> Nuevo cupón</button>}
      >
        {datos.length === 0 ? <Vacio texto="Aún no hay cupones." /> : (
          <div className="adm-scroll">
            <table className="adm-tabla">
              <thead><tr><th>Código</th><th>Descuento</th><th>Vence</th><th>Usos</th><th>Límites</th><th>Estado</th><th className="der">Editar</th></tr></thead>
              <tbody>
                {datos.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.codigo}</strong></td>
                    <td>{c.porcentaje}%</td>
                    <td>{c.expira}</td>
                    <td>{c.usos}{c.usos_maximos ? ` de ${c.usos_maximos}` : ''}</td>
                    <td>{c.usos_por_usuario ? `${c.usos_por_usuario} por cliente` : 'Sin tope por cliente'}</td>
                    <td>{c.vencido ? <Chip tono="malo">Vencido</Chip> : c.activo ? <Chip tono="bueno">Activo</Chip> : <Chip>Inactivo</Chip>}</td>
                    <td className="der"><button type="button" className="adm-icono-boton" onClick={() => setFormulario(c)} aria-label={`Editar ${c.codigo}`}><Icono nombre="lapiz" tamano={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {formulario && (
        <FormularioCupon
          cupon={formulario === 'nuevo' ? null : formulario}
          alCerrar={() => setFormulario(null)}
          alTerminar={() => { setFormulario(null); recargar() }}
        />
      )}
    </div>
  )
}

export default Cupones
