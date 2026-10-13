import { useState } from 'react'
import api, { formatoCLP } from '../api'
import Icono from '../components/Icono'
import { useDatos } from './contexto'
import { Cargando, Chip, ErrorCaja, Tarjeta, Vacio } from './ui'
import { ESTADOS_VENTA, fechaCorta, horaDe, normalizar } from './utils'

const TONOS = { pagado: 'bueno', pendiente: 'aviso', rechazado: 'malo', anulado: 'malo' }
const POR_PAGINA = 20

function Detalle({ venta }) {
  const d = venta.direccion || {}
  const linea = [d.calle && `${d.calle} ${d.numero}`, d.complemento, d.comuna].filter(Boolean).join(', ')
  const subtotal = venta.items.reduce((suma, i) => suma + i.subtotal, 0)
  return (
    <div className="adm-detalle">
      <div>
        <h3>Productos</h3>
        <ul className="adm-lista-simple">
          {venta.items.map((i, k) => (
            <li key={k}><span>{i.producto}<small>{i.cantidad} × {formatoCLP(i.precio_unit)}</small></span><strong>{formatoCLP(i.subtotal)}</strong></li>
          ))}
        </ul>
        <div className="adm-totales">
          <span>Productos <b>{formatoCLP(subtotal)}</b></span>
          <span>Envío <b>{formatoCLP(venta.envio)}</b></span>
          {venta.descuento > 0 && <span>Cupón {venta.cupon} <b>-{formatoCLP(venta.descuento)}</b></span>}
          <span className="total">Total <b>{formatoCLP(venta.total)}</b></span>
        </div>
      </div>
      <div>
        <h3>Entrega</h3>
        {linea ? (
          <p className="adm-direccion"><strong>{d.nombre}</strong>{linea}{d.telefono && <span>Tel. {d.telefono}</span>}{d.indicaciones && <span>{d.indicaciones}</span>}</p>
        ) : <p className="adm-nota">Sin dirección (venta de mostrador o anterior a la dirección).</p>}
        <h3>Historial</h3>
        <ol className="adm-linea">
          {(venta.historial || []).map((h, k) => (
            <li key={k} className={TONOS[h.estado]}><i />{ESTADOS_VENTA[h.estado] || h.estado}<small>{fechaCorta(h.fecha)} · {horaDe(h.fecha)}</small></li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Ventas() {
  const { datos, cargando, error, recargar } = useDatos(() => api.get('ventas/historial').then((r) => r.data.ventas))
  const [estado, setEstado] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [abierta, setAbierta] = useState(null)
  const [pagina, setPagina] = useState(1)

  if (cargando) return <Cargando />
  if (error) return <ErrorCaja texto={error} alReintentar={recargar} />

  const texto = normalizar(busqueda)
  const filtradas = datos.filter((v) => (
    (estado === 'todas' || v.estado === estado)
    && (!texto || normalizar(`${v.id} ${v.responsable} ${v.email_contacto}`).includes(texto))
  ))
  const paginas = Math.max(Math.ceil(filtradas.length / POR_PAGINA), 1)
  const actual = Math.min(pagina, paginas)
  const visibles = filtradas.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA)
  const conteo = (e) => datos.filter((v) => v.estado === e).length

  return (
    <div className="adm-pagina">
      <Tarjeta titulo={`Ventas (${filtradas.length})`}>
        <div className="adm-filtros">
          <div className="adm-pestanas">
            {[['todas', 'Todas', datos.length], ['pagado', 'Pagadas', conteo('pagado')], ['pendiente', 'Pendientes', conteo('pendiente')], ['rechazado', 'Rechazadas', conteo('rechazado')], ['anulado', 'Anuladas', conteo('anulado')]].map(([clave, etiqueta, n]) => (
              <button key={clave} type="button" className={estado === clave ? 'activa' : ''} onClick={() => { setEstado(clave); setPagina(1) }}>{etiqueta} <span>{n}</span></button>
            ))}
          </div>
          <label className="adm-buscador">
            <Icono nombre="lupa" tamano={16} />
            <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }} placeholder="Buscar por pedido o cliente" />
          </label>
        </div>

        {visibles.length === 0 ? <Vacio texto="No hay ventas con esos filtros." /> : (
          <div className="adm-scroll">
            <table className="adm-tabla">
              <thead><tr><th></th><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th className="der">Total</th></tr></thead>
              <tbody>
                {visibles.map((v) => (
                  <FilaVenta key={v.id} venta={v} abierta={abierta === v.id} alAlternar={() => setAbierta(abierta === v.id ? null : v.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <nav className="adm-paginas" aria-label="Páginas">
            <button type="button" disabled={actual === 1} onClick={() => setPagina(actual - 1)}>Anterior</button>
            <span>Página {actual} de {paginas}</span>
            <button type="button" disabled={actual === paginas} onClick={() => setPagina(actual + 1)}>Siguiente</button>
          </nav>
        )}
      </Tarjeta>
    </div>
  )
}

function FilaVenta({ venta, abierta, alAlternar }) {
  return (
    <>
      <tr className={abierta ? 'adm-fila-abierta' : 'adm-fila-click'} onClick={alAlternar}>
        <td><span className={abierta ? 'adm-flecha abierta' : 'adm-flecha'}><Icono nombre="chevron" tamano={14} /></span></td>
        <td><strong>#{venta.id}</strong></td>
        <td>{venta.fecha}</td>
        <td>{venta.responsable}<small className="adm-sub">{venta.email_contacto}</small></td>
        <td>{venta.tipo_operacion}</td>
        <td><Chip tono={TONOS[venta.estado]}>{ESTADOS_VENTA[venta.estado] || venta.estado}</Chip></td>
        <td className="der">{formatoCLP(venta.total)}</td>
      </tr>
      {abierta && <tr className="adm-fila-detalle"><td colSpan={7}><Detalle venta={venta} /></td></tr>}
    </>
  )
}

export default Ventas
