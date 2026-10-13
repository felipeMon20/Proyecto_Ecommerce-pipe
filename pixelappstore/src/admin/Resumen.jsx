import { useState } from 'react'
import { Link } from 'react-router-dom'
import api, { formatoCLP, mensajeError } from '../api'
import Icono from '../components/Icono'
import { useDatos, usePanel } from './contexto'
import { Cargando, ErrorCaja, Tarjeta, Vacio } from './ui'

function Indicador({ icono, etiqueta, valor, tono = '', nota }) {
  return (
    <div className={`adm-kpi ${tono}`}>
      <span className="adm-kpi-icono"><Icono nombre={icono} tamano={22} /></span>
      <span className="adm-kpi-texto">
        <small>{etiqueta}</small>
        <strong>{valor}</strong>
        {nota && <em>{nota}</em>}
      </span>
    </div>
  )
}

function GraficoDias({ serie }) {
  const maximo = Math.max(...serie.map((d) => d.total), 1)
  return (
    <div className="adm-grafico" role="img" aria-label="Ventas pagadas de los últimos 14 días">
      {serie.map((d) => (
        <div key={d.fecha} className="adm-barra" title={`${d.fecha}: ${formatoCLP(d.total)}`}>
          <span style={{ height: `${Math.max((d.total / maximo) * 100, d.total ? 4 : 0)}%` }} />
          <small>{d.fecha.slice(8)}</small>
        </div>
      ))}
    </div>
  )
}

function Resumen() {
  const { ruta, avisar } = usePanel()
  const { datos, cargando, error, recargar } = useDatos(() => api.get('dashboard/metricas').then((r) => r.data))
  const [descargando, setDescargando] = useState(false)

  const descargarPdf = async () => {
    setDescargando(true)
    try {
      const { data } = await api.get('dashboard/reporte-pdf', { responseType: 'blob' })
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(data)
      enlace.download = 'reporte_ventas.pdf'
      enlace.click()
      URL.revokeObjectURL(enlace.href)
    } catch (e) {
      avisar('error', mensajeError(e, 'No se pudo generar el reporte'))
    } finally {
      setDescargando(false)
    }
  }

  if (cargando) return <Cargando />
  if (error) return <ErrorCaja texto={error} alReintentar={recargar} />

  const { finanzas, kpis, top_productos: top, ventas_recientes: recientes, ventas_por_dia: serie, stock_bajo: bajo, pendientes } = datos
  const maxTop = Math.max(...top.map((t) => t.total_vendido), 1)

  return (
    <div className="adm-pagina">
      <div className="adm-kpis">
        <Indicador icono="billetera" etiqueta="Ingresos" valor={formatoCLP(finanzas.ingresos)} nota="Ventas pagadas" />
        <Indicador icono="recibo" etiqueta="Egresos" valor={formatoCLP(finanzas.egresos)} nota="Gastos registrados" />
        <Indicador icono="panel" etiqueta="Ganancia neta" valor={formatoCLP(finanzas.ganancia_neta)} tono={finanzas.ganancia_neta >= 0 ? 'bueno' : 'malo'} nota={finanzas.estado_financiero} />
        <Indicador icono="carrito" etiqueta="Pedidos pagados" valor={kpis.pedidos_totales} nota={`Ticket promedio ${formatoCLP(kpis.ticket_promedio)}`} />
        <Indicador icono="usuario" etiqueta="Usuarios" valor={kpis.usuarios_totales} />
        <Indicador icono="alerta" etiqueta="Pedidos pendientes" valor={pendientes} tono={pendientes > 0 ? 'aviso' : ''} nota="Sin pago confirmado" />
      </div>

      <div className="adm-dos">
        <Tarjeta titulo="Ventas de los últimos 14 días" acciones={
          <button type="button" className="adm-boton secundario" onClick={descargarPdf} disabled={descargando}>
            <Icono nombre="descarga" tamano={16} /> {descargando ? 'Generando...' : 'Reporte PDF'}
          </button>
        }>
          <GraficoDias serie={serie} />
        </Tarjeta>

        <Tarjeta titulo="Productos más vendidos">
          {top.length === 0 ? <Vacio texto="Aún no hay ventas pagadas." /> : (
            <ul className="adm-ranking">
              {top.map((t, i) => (
                <li key={t.producto__nombre}>
                  <span className="adm-ranking-pos">{i + 1}</span>
                  <span className="adm-ranking-dato">
                    <strong>{t.producto__nombre}</strong>
                    <span className="adm-ranking-barra"><i style={{ width: `${(t.total_vendido / maxTop) * 100}%` }} /></span>
                  </span>
                  <em>{t.total_vendido} u.</em>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="adm-dos">
        <Tarjeta titulo="Ventas recientes" acciones={<Link to={`/${ruta}/ventas`} className="adm-enlace">Ver todas</Link>}>
          {recientes.length === 0 ? <Vacio texto="Sin ventas todavía." /> : (
            <table className="adm-tabla">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th className="der">Total</th></tr></thead>
              <tbody>
                {recientes.map((v) => (
                  <tr key={v.id}><td>#{v.id}</td><td>{v.usuario}</td><td>{v.fecha}</td><td className="der">{formatoCLP(v.total)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Tarjeta>

        <Tarjeta titulo="Stock bajo" acciones={<Link to={`/${ruta}/productos`} className="adm-enlace">Ir a productos</Link>}>
          {bajo.length === 0 ? <Vacio texto="Todo con stock suficiente." /> : (
            <ul className="adm-lista-simple">
              {bajo.map((p) => (
                <li key={p.id}>
                  <span>{p.nombre}<small>{p.codigo}</small></span>
                  <span className={p.stock === 0 ? 'adm-chip malo' : 'adm-chip aviso'}>{p.stock === 0 ? 'Agotado' : `${p.stock} u.`}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}

export default Resumen
