import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { formatoCLP, mensajeError } from '../api'

function MisComprasPage() {
  const [estado, setEstado] = useState({ cargando: true, ventas: [] })
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    api.get('ventas/mis-compras')
      .then(({ data }) => {
        if (vigente) setEstado({ cargando: false, ventas: data.ventas })
      })
      .catch((e) => {
        if (!vigente) return
        setEstado({ cargando: false, ventas: [] })
        setError(mensajeError(e))
      })
    return () => { vigente = false }
  }, [recarga])

  const cancelar = async (id) => {
    setError(null)
    try {
      await api.post(`ventas/cancelar/${id}`)
      setRecarga((n) => n + 1)
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const { cargando, ventas } = estado

  return (
    <div className="contenedor">
      <h1>Mis compras</h1>
      {error && <div className="aviso error" style={{ marginBottom: 12 }}>{error}</div>}
      {cargando && <p className="vacio">Cargando...</p>}
      {!cargando && ventas.length === 0 && (
        <div className="tarjeta vacio">
          <p>Aún no tienes compras.</p>
          <Link to="/" className="boton">Ver catálogo</Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ventas.map((venta) => (
          <div key={venta.id} className="tarjeta">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>Pedido #{venta.id}</strong>
                <div className="nota">{venta.fecha}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`estado ${venta.estado}`}>{venta.estado}</span>
                <div className="precio">{formatoCLP(venta.total)}</div>
              </div>
            </div>
            {venta.items.map((item, indice) => (
              <div key={indice} className="resumen-fila">
                <span>{item.producto} × {item.cantidad}</span>
                <span>{formatoCLP(item.subtotal)}</span>
              </div>
            ))}
            {venta.estado === 'pendiente' && (
              <button className="boton peligro" style={{ marginTop: 8 }} onClick={() => cancelar(venta.id)}>
                Cancelar pedido
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MisComprasPage
