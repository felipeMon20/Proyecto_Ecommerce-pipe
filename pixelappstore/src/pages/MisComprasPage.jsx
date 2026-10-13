import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { formatoCLP, mensajeError } from '../api'
import Icono from '../components/Icono'
import PixelArt from '../components/PixelArt'

const ESTADOS = {
  pagado: { etiqueta: 'Pagado', icono: 'check' },
  pendiente: { etiqueta: 'Pendiente de pago', icono: 'alerta' },
  rechazado: { etiqueta: 'Rechazado', icono: 'cerrar' },
  anulado: { etiqueta: 'Anulado', icono: 'cerrar' },
}

const EVENTOS = {
  pendiente: 'Pedido creado',
  pagado: 'Pago confirmado',
  rechazado: 'Pago rechazado',
  anulado: 'Pedido anulado',
}

const FILTROS = [
  ['todas', 'Todas', () => true],
  ['pagado', 'Pagadas', (v) => v.estado === 'pagado'],
  ['pendiente', 'Pendientes', (v) => v.estado === 'pendiente'],
  ['fallidas', 'Rechazadas o anuladas', (v) => v.estado === 'rechazado' || v.estado === 'anulado'],
]

function fechaLarga(texto) {
  const fecha = new Date(String(texto).replace(' ', 'T'))
  if (Number.isNaN(fecha.getTime())) return texto
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const hora = (texto) => String(texto).split(' ')[1] || ''

function Pedido({ venta, abierto, alAlternar, confirmando, alConfirmar, alCancelar }) {
  const estado = ESTADOS[venta.estado] || { etiqueta: venta.estado, icono: 'alerta' }
  const productos = venta.items.reduce((suma, i) => suma + i.subtotal, 0)
  const unidades = venta.items.reduce((suma, i) => suma + i.cantidad, 0)
  const d = venta.direccion || {}
  const lineaDireccion = [d.calle && `${d.calle} ${d.numero}`, d.complemento, d.comuna].filter(Boolean).join(', ')
  const visibles = venta.items.slice(0, 4)

  return (
    <article className={`pedido ${venta.estado}`}>
      <button type="button" className="pedido-cabecera" onClick={alAlternar} aria-expanded={abierto}>
        <span className="pedido-datos">
          <strong>Pedido #{venta.id}</strong>
          <small>{fechaLarga(venta.fecha)} · {unidades} {unidades === 1 ? 'producto' : 'productos'}</small>
        </span>
        <span className="pedido-fotos" aria-hidden="true">
          {visibles.map((item, i) => (
            <span key={i} className="pedido-foto">
              {item.imagen ? <img src={item.imagen} alt="" /> : <Icono nombre="tienda" tamano={18} />}
            </span>
          ))}
          {venta.items.length > visibles.length && <span className="pedido-foto mas">+{venta.items.length - visibles.length}</span>}
        </span>
        <span className="pedido-resumen">
          <span className={`pedido-estado ${venta.estado}`}><Icono nombre={estado.icono} tamano={14} /> {estado.etiqueta}</span>
          <strong className="pedido-total">{formatoCLP(venta.total)}</strong>
        </span>
        <span className={abierto ? 'pedido-flecha abierta' : 'pedido-flecha'}><Icono nombre="chevron" tamano={16} /></span>
      </button>

      {abierto && (
        <div className="pedido-detalle">
          <div className="pedido-col">
            <h3>Productos</h3>
            <ul className="pago-items">
              {venta.items.map((item, i) => (
                <li key={i}>
                  <span className="pago-miniatura">{item.imagen ? <img src={item.imagen} alt="" /> : <Icono nombre="tienda" tamano={20} />}</span>
                  <span className="pago-item-nombre">{item.producto}<small>{item.cantidad} × {formatoCLP(item.precio_unit)}</small></span>
                  <strong>{formatoCLP(item.subtotal)}</strong>
                </li>
              ))}
            </ul>
            <div className="pago-totales">
              <div><span>Productos</span><span>{formatoCLP(productos)}</span></div>
              <div><span>Envío</span><span>{formatoCLP(venta.envio)}</span></div>
              {venta.descuento > 0 && <div className="pago-descuento"><span>Cupón {venta.cupon}</span><span>-{formatoCLP(venta.descuento)}</span></div>}
              <div className="pago-total"><span>Total</span><strong>{formatoCLP(venta.total)}</strong></div>
            </div>
          </div>

          <div className="pedido-col">
            <h3>Entrega</h3>
            {lineaDireccion ? (
              <p className="pago-direccion">
                <strong>{d.nombre}</strong>
                {lineaDireccion}
                {d.telefono && <span>Tel. {d.telefono}</span>}
                {d.indicaciones && <span>{d.indicaciones}</span>}
              </p>
            ) : (
              <p className="nota">Este pedido no tiene dirección registrada.</p>
            )}

            {venta.historial && venta.historial.length > 0 && (
              <>
                <h3>Historial</h3>
                <ol className="pedido-linea">
                  {venta.historial.map((h, i) => (
                    <li key={i} className={h.estado}>
                      <span className="pedido-punto" />
                      <span>{EVENTOS[h.estado] || h.estado}<small>{fechaLarga(h.fecha)} · {hora(h.fecha)}</small></span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {venta.estado === 'pendiente' && (
              <div className="pedido-acciones">
                <p className="nota">Este pedido todavía no tiene el pago confirmado. Si no lo vas a pagar, puedes cancelarlo.</p>
                {confirmando ? (
                  <span className="pedido-confirma">
                    <strong>¿Cancelar el pedido?</strong>
                    <button type="button" className="pedido-si" onClick={alCancelar}>Sí, cancelar</button>
                    <button type="button" className="pedido-no" onClick={() => alConfirmar(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="pedido-cancelar" onClick={() => alConfirmar(venta.id)}>Cancelar pedido</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function MisComprasPage() {
  const [estado, setEstado] = useState({ cargando: true, ventas: [] })
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const [filtro, setFiltro] = useState('todas')
  const [abiertos, setAbiertos] = useState([])
  const [confirmando, setConfirmando] = useState(null)

  useEffect(() => {
    let vigente = true
    api.get('ventas/mis-compras')
      .then(({ data }) => {
        if (!vigente) return
        setEstado({ cargando: false, ventas: data.ventas })
        setAbiertos((previos) => (previos.length === 0 && data.ventas[0] ? [data.ventas[0].id] : previos))
      })
      .catch((e) => {
        if (!vigente) return
        setEstado({ cargando: false, ventas: [] })
        setError(mensajeError(e))
      })
    return () => { vigente = false }
  }, [recarga])

  const cancelar = async () => {
    setError(null)
    try {
      await api.post(`ventas/cancelar/${confirmando}`)
      setConfirmando(null)
      setRecarga((n) => n + 1)
    } catch (e) {
      setError(mensajeError(e))
      setConfirmando(null)
    }
  }

  const alternar = (id) => setAbiertos((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]))

  const { cargando, ventas } = estado
  const regla = FILTROS.find(([clave]) => clave === filtro)[2]
  const visibles = ventas.filter(regla)
  const gastado = ventas.filter((v) => v.estado === 'pagado').reduce((suma, v) => suma + v.total, 0)

  return (
    <div className="contenedor">
      <div className="compras">
        <header className="compras-cabecera">
          <div>
            <h1>Mis compras</h1>
            <p>Revisa el estado de tus pedidos y su historial.</p>
          </div>
          {ventas.length > 0 && (
            <div className="compras-stats">
              <span><strong>{ventas.length}</strong> pedidos</span>
              <span><strong>{formatoCLP(gastado)}</strong> en compras pagadas</span>
            </div>
          )}
        </header>

        {error && <div className="aviso error" role="alert">{error}</div>}
        {cargando && <p className="vacio">Cargando...</p>}

        {!cargando && ventas.length === 0 && (
          <div className="compras-vacio">
            <PixelArt nombre="tienda" tamano={150} />
            <h2>Aún no tienes compras</h2>
            <p>Cuando hagas tu primer pedido aparecerá aquí con su historial.</p>
            <Link to="/catalogo" className="boton amarillo boton-mas">Explorar el catálogo</Link>
          </div>
        )}

        {ventas.length > 0 && (
          <>
            <div className="compras-filtros" role="tablist">
              {FILTROS.map(([clave, etiqueta, regla2]) => (
                <button key={clave} type="button" role="tab" aria-selected={filtro === clave} className={filtro === clave ? 'activo' : ''} onClick={() => setFiltro(clave)}>
                  {etiqueta} <span>{ventas.filter(regla2).length}</span>
                </button>
              ))}
            </div>

            {visibles.length === 0 ? (
              <p className="compras-nada">No hay pedidos en esta categoría.</p>
            ) : (
              <div className="compras-lista">
                {visibles.map((venta) => (
                  <Pedido
                    key={venta.id}
                    venta={venta}
                    abierto={abiertos.includes(venta.id)}
                    alAlternar={() => alternar(venta.id)}
                    confirmando={confirmando === venta.id}
                    alConfirmar={setConfirmando}
                    alCancelar={cancelar}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MisComprasPage
