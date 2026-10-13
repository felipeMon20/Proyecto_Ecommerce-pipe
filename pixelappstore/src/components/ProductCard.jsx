import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatoCLP, mensajeError } from '../api'
import { useAuth, useCarrito } from '../contexto/auth'

export function Estrellas({ promedio, total }) {
  const llenas = Math.round(promedio)
  return (
    <span className="estrellas" title={`${promedio} de 5`}>
      {'★'.repeat(llenas)}{'☆'.repeat(5 - llenas)}
      <span className="nota"> ({total})</span>
    </span>
  )
}

function ProductCard({ producto }) {
  const { usuario } = useAuth()
  const { agregar } = useCarrito()
  const navigate = useNavigate()
  const ubicacion = useLocation()
  const [mensaje, setMensaje] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const agregarAlCarrito = async () => {
    if (!usuario) {
      navigate('/login', { state: { desde: ubicacion.pathname + ubicacion.search } })
      return
    }
    setEnviando(true)
    setMensaje(null)
    try {
      await agregar(producto.id, 1)
      setMensaje({ tipo: 'ok', texto: 'Agregado al carrito' })
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeError(error) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="producto-card">
      <Link to={`/producto/${producto.id}`} className="producto-imagen">
        {producto.imagenes.length > 0 ? (
          <img src={producto.imagenes[0]} alt={producto.nombre} loading="lazy" />
        ) : (
          <span className="nota">Sin imagen</span>
        )}
      </Link>
      {producto.marca && <span className="producto-marca">{producto.marca}</span>}
      <Link to={`/producto/${producto.id}`} className="producto-nombre">{producto.nombre}</Link>
      <Estrellas promedio={producto.calificacion_promedio} total={producto.total_reviews} />
      <span className="precio">{formatoCLP(producto.precio)}</span>
      {producto.stock > 0 ? (
        <button className="boton" onClick={agregarAlCarrito} disabled={enviando}>
          {enviando ? 'Agregando...' : 'Agregar al carrito'}
        </button>
      ) : (
        <span className="sin-stock">Sin stock</span>
      )}
      {mensaje && <span className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</span>}
    </div>
  )
}

export default ProductCard
