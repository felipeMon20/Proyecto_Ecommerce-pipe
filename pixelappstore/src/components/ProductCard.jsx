import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatoCLP, mensajeError } from '../api'
import { useAuth, useCarrito } from '../contexto/auth'
import Icono from './Icono'

export function Estrellas({ promedio, total }) {
  const llenas = Math.round(promedio)
  return (
    <span className="estrellas" title={`${promedio} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icono key={n} nombre="estrella" tamano={14} relleno={n <= llenas} />
      ))}
      <span className="nota"> ({total})</span>
    </span>
  )
}

function ProductCard({ producto, variante = '', etiqueta = '' }) {
  const hayStock = (producto.disponible ?? producto.stock) > 0
  const reservado = !hayStock && producto.stock > 0
  const { usuario } = useAuth()
  const { agregar } = useCarrito()
  const navigate = useNavigate()
  const ubicacion = useLocation()
  const [mensaje, setMensaje] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [agregado, setAgregado] = useState(false)

  useEffect(() => {
    if (!agregado) return undefined
    const temporizador = setTimeout(() => setAgregado(false), 1800)
    return () => clearTimeout(temporizador)
  }, [agregado])

  const agregarAlCarrito = async () => {
    if (!usuario) {
      navigate('/login', { state: { desde: ubicacion.pathname + ubicacion.search } })
      return
    }
    setEnviando(true)
    setMensaje(null)
    try {
      await agregar(producto.id, 1)
      setAgregado(true)
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeError(error) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={`producto-card ${variante}${hayStock ? '' : ' agotada'}`}>
      <Link to={`/producto/${producto.id}`} className="producto-imagen">
        {!hayStock ? (
          <span className="producto-agotado">{reservado ? 'Reservado' : 'Agotado'}</span>
        ) : etiqueta && <span className="producto-etiqueta">{etiqueta}</span>}
        {producto.imagenes.length > 0 ? (
          <img src={producto.imagenes[0]} alt={producto.nombre} loading="lazy" />
        ) : (
          <span className="nota">Sin imagen</span>
        )}
      </Link>
      <div className="producto-datos">
        {producto.marca && <span className="producto-marca">{producto.marca}</span>}
        <Link to={`/producto/${producto.id}`} className="producto-nombre">{producto.nombre}</Link>
        <Estrellas promedio={producto.calificacion_promedio} total={producto.total_reviews} />
        <span className="precio">{formatoCLP(producto.precio)}</span>
        {hayStock ? (
          <button className={agregado ? 'boton agregado' : 'boton'} onClick={agregarAlCarrito} disabled={enviando}>
            {agregado ? (
              <span className="agregado-contenido"><Icono nombre="check" tamano={20} /> Agregado</span>
            ) : enviando ? 'Agregando...' : 'Agregar al carrito'}
          </button>
        ) : (
          <span className="boton-agotado">
            <Icono nombre="alerta" tamano={18} /> {reservado ? 'En proceso de pago' : 'Sin stock'}
          </span>
        )}
        {mensaje && <span className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</span>}
      </div>
    </div>
  )
}

export default ProductCard
