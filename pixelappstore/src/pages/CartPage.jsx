import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { formatoCLP, mensajeError } from '../api'
import { useCarrito } from '../contexto/auth'

function CartPage() {
  const { refrescar } = useCarrito()
  const [estado, setEstado] = useState({ cargando: true, items: [], total: 0 })
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    api.get('carrito/ver')
      .then(({ data }) => {
        if (vigente) setEstado({ cargando: false, items: data.items, total: data.total_estimado })
      })
      .catch((e) => {
        if (!vigente) return
        setEstado({ cargando: false, items: [], total: 0 })
        setError(mensajeError(e))
      })
    return () => { vigente = false }
  }, [recarga])

  const accion = async (peticion) => {
    setError(null)
    try {
      await peticion()
      setRecarga((n) => n + 1)
      await refrescar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const { cargando, items, total } = estado

  if (cargando) return <div className="contenedor"><p className="vacio">Cargando carrito...</p></div>

  return (
    <div className="contenedor">
      <h1>Carrito de compras</h1>
      {error && <div className="aviso error" style={{ marginBottom: 12 }}>{error}</div>}

      {items.length === 0 ? (
        <div className="tarjeta vacio">
          <p>Tu carrito está vacío.</p>
          <Link to="/" className="boton">Ver catálogo</Link>
        </div>
      ) : (
        <div className="dos-columnas">
          <div className="tarjeta">
            {items.map((item) => (
              <div key={item.item_id} className="linea-carrito">
                {item.imagen ? <img src={item.imagen} alt={item.nombre} /> : <div />}
                <div>
                  <Link to={`/producto/${item.producto_id}`}><strong>{item.nombre}</strong></Link>
                  <div className="nota">{formatoCLP(item.precio)} c/u</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <span>Cantidad: <strong>{item.cantidad}</strong></span>
                    <button
                      className="boton secundario"
                      style={{ padding: '2px 10px' }}
                      onClick={() => accion(() => api.post('carrito/agregar', { producto_id: item.producto_id, cantidad: 1 }))}
                      aria-label={`Agregar una unidad de ${item.nombre}`}
                    >
                      +1
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="precio">{formatoCLP(item.subtotal)}</div>
                  <button
                    className="boton peligro"
                    style={{ padding: '4px 10px', marginTop: 6 }}
                    onClick={() => accion(() => api.delete(`carrito/eliminar/${item.item_id}`))}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            <button className="boton secundario" style={{ marginTop: 12 }} onClick={() => accion(() => api.delete('carrito/vaciar'))}>
              Vaciar carrito
            </button>
          </div>

          <div className="tarjeta">
            <h2>Resumen</h2>
            <div className="resumen-fila"><span>Productos</span><span>{formatoCLP(total)}</span></div>
            <div className="resumen-fila"><span>Envío</span><span className="nota">se calcula al pagar</span></div>
            <div className="resumen-fila resumen-total"><span>Subtotal</span><span>{formatoCLP(total)}</span></div>
            <Link to="/checkout" className="boton completo" style={{ marginTop: 14 }}>Ir a pagar</Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default CartPage
