import { useState } from 'react'
import api, { formatoCLP, mensajeError } from '../api'
import Icono from '../components/Icono'
import { useDatos, usePanel } from './contexto'
import { Campo, Cargando, ErrorCaja, Tarjeta, Vacio } from './ui'

const CATEGORIAS = ['General', 'Insumos', 'Sueldos', 'Arriendo', 'Servicios', 'Marketing', 'Despacho', 'Otros']

function Finanzas() {
  const { avisar } = usePanel()
  const egresos = useDatos(() => api.get('finanzas/egresos/listar').then((r) => r.data.egresos))
  const resumen = useDatos(() => api.get('dashboard/metricas').then((r) => r.data.finanzas))
  const [form, setForm] = useState({ descripcion: '', monto: '', categoria: 'General' })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  if (egresos.cargando || resumen.cargando) return <Cargando />
  if (egresos.error) return <ErrorCaja texto={egresos.error} alReintentar={egresos.recargar} />

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const guardar = async (evento) => {
    evento.preventDefault()
    setError(null)
    const monto = Number(form.monto)
    if (!Number.isInteger(monto) || monto <= 0) {
      setError('El monto debe ser un número entero mayor a 0')
      return
    }
    setGuardando(true)
    try {
      await api.post('finanzas/egresos/crear', { descripcion: form.descripcion.trim(), monto, categoria: form.categoria })
      avisar('ok', 'Gasto registrado')
      setForm({ descripcion: '', monto: '', categoria: 'General' })
      egresos.recargar()
      resumen.recargar()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const f = resumen.datos

  return (
    <div className="adm-pagina">
      {f && (
        <div className="adm-kpis tres">
          <div className="adm-kpi"><span className="adm-kpi-icono"><Icono nombre="billetera" tamano={22} /></span><span className="adm-kpi-texto"><small>Ingresos</small><strong>{formatoCLP(f.ingresos)}</strong></span></div>
          <div className="adm-kpi"><span className="adm-kpi-icono"><Icono nombre="recibo" tamano={22} /></span><span className="adm-kpi-texto"><small>Egresos</small><strong>{formatoCLP(f.egresos)}</strong></span></div>
          <div className={`adm-kpi ${f.ganancia_neta >= 0 ? 'bueno' : 'malo'}`}><span className="adm-kpi-icono"><Icono nombre="panel" tamano={22} /></span><span className="adm-kpi-texto"><small>Ganancia neta</small><strong>{formatoCLP(f.ganancia_neta)}</strong><em>{f.estado_financiero}</em></span></div>
        </div>
      )}

      <div className="adm-dos desigual">
        <Tarjeta titulo="Gastos registrados">
          {egresos.datos.length === 0 ? <Vacio texto="Aún no hay gastos registrados." /> : (
            <div className="adm-scroll">
              <table className="adm-tabla">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Registró</th><th className="der">Monto</th></tr></thead>
                <tbody>
                  {egresos.datos.map((g) => (
                    <tr key={g.id}><td>{g.fecha}</td><td>{g.descripcion}</td><td>{g.categoria}</td><td>{g.registrado_por}</td><td className="der">{formatoCLP(g.monto)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Registrar un gasto">
          <form className="adm-formulario" onSubmit={guardar}>
            <Campo etiqueta="Descripción"><input value={form.descripcion} onChange={cambiar('descripcion')} maxLength={255} required /></Campo>
            <Campo etiqueta="Monto (CLP)"><input type="number" min="1" step="1" value={form.monto} onChange={cambiar('monto')} required /></Campo>
            <Campo etiqueta="Categoría">
              <select value={form.categoria} onChange={cambiar('categoria')}>
                {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
            {error && <div className="adm-aviso error" role="alert">{error}</div>}
            <button className="adm-boton" disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar gasto'}</button>
          </form>
        </Tarjeta>
      </div>
    </div>
  )
}

export default Finanzas
