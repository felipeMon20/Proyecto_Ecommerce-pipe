import { useState } from 'react'
import api from '../api'
import Icono from '../components/Icono'
import { useDatos } from './contexto'
import { Cargando, ErrorCaja, Tarjeta, Vacio } from './ui'
import { normalizar } from './utils'

function Auditoria() {
  const { datos, cargando, error, recargar } = useDatos(() => api.get('panel/auditoria').then((r) => r.data.registros))
  const [busqueda, setBusqueda] = useState('')

  if (cargando) return <Cargando />
  if (error) return <ErrorCaja texto={error} alReintentar={recargar} />

  const texto = normalizar(busqueda)
  const visibles = datos.filter((r) => !texto || normalizar(`${r.usuario} ${r.accion} ${r.detalle}`).includes(texto))

  return (
    <div className="adm-pagina">
      <Tarjeta titulo="Registro de actividad" acciones={<button type="button" className="adm-boton secundario" onClick={recargar}>Actualizar</button>}>
        <p className="adm-nota">Las últimas 200 acciones del equipo: cambios de productos, ventas de mostrador, cupones, gastos y descargas de reportes.</p>
        <label className="adm-buscador">
          <Icono nombre="lupa" tamano={16} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por usuario, acción o detalle" />
        </label>
        {visibles.length === 0 ? <Vacio texto="Sin registros." /> : (
          <div className="adm-scroll">
            <table className="adm-tabla">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.id}><td className="nowrap">{r.fecha}</td><td>{r.usuario}</td><td><strong>{r.accion}</strong></td><td>{r.detalle}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}

export default Auditoria
