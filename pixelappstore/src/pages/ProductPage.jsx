import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import api, { formatoCLP, mensajeError } from '../api'
import { Estrellas } from '../components/ProductCard'
import { useAuth, useCarrito } from '../contexto/auth'

function ProductPage() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const { agregar } = useCarrito()
  const navigate = useNavigate()
  const ubicacion = useLocation()

  const [estado, setEstado] = useState({ cargando: true, producto: null, relacionados: [] })
  const [imagenActiva, setImagenActiva] = useState(0)
  const [unidades, setUnidades] = useState(1)
  const [mensaje, setMensaje] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vigente = true
    Promise.all([
      api.get('productos/listar'),
      api.get(`productos/relacionados/${id}`).catch(() => ({ data: { relacionados: [] } })),
    ])
      .then(([listado, relacionados]) => {
        if (!vigente) return
        const producto = listado.data.productos.find((p) => String(p.id) === id) || null
        setEstado({ cargando: false, producto, relacionados: relacionados.data.relacionados })
      })
      .catch(() => {
        if (vigente) setEstado({ cargando: false, producto: null, relacionados: [] })
      })
    return () => { vigente = false }
  }, [id])

  const { cargando, producto, relacionados } = estado

  if (cargando) return <div className="contenedor"><p className="vacio">Cargando producto...</p></div>
  if (!producto) {
    return (
      <div className="contenedor">
        <p className="vacio">Producto no encontrado. <Link to="/">Volver al catálogo</Link></p>
      </div>
    )
  }

  const comprar = async (irAlCarrito) => {
    if (!usuario) {
      navigate('/login', { state: { desde: ubicacion.pathname } })
      return
    }
    setEnviando(true)
    setMensaje(null)
    try {
      await agregar(producto.id, unidades)
      if (irAlCarrito) navigate('/carrito')
      else setMensaje({ tipo: 'ok', texto: 'Producto agregado al carrito' })
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeError(error) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="contenedor">
      <p className="nota"><Link to="/">Inicio</Link> / {producto.categoria}</p>
      <div className="tarjeta detalle">
        <div>
          <div className="galeria-principal">
            {producto.imagenes.length > 0 ? (
              <img src={producto.imagenes[imagenActiva]} alt={producto.nombre} />
            ) : (
              <span className="nota">Sin imagen</span>
            )}
          </div>
          {producto.imagenes.length > 1 && (
            <div className="miniaturas">
              {producto.imagenes.map((url, indice) => (
                <img
                  key={url}
                  src={url}
                  alt={`Vista ${indice + 1}`}
                  className={indice === imagenActiva ? 'activa' : ''}
                  onClick={() => setImagenActiva(indice)}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          {producto.marca && <span className="producto-marca">{producto.marca}</span>}
          <h1>{producto.nombre}</h1>
          <Estrellas promedio={producto.calificacion_promedio} total={producto.total_reviews} />
          <p className="precio">{formatoCLP(producto.precio)}</p>
          {producto.descripcion && <p>{producto.descripcion}</p>}
          <p className="nota">Código: {producto.codigo}</p>

          {producto.stock > 0 ? (
            <>
              <p className="nota">{producto.stock} unidades disponibles</p>
              <div className="fila-cantidad">
                <label htmlFor="unidades">Cantidad</label>
                <input
                  id="unidades"
                  type="number"
                  min="1"
                  max={producto.stock}
                  value={unidades}
                  onChange={(e) => setUnidades(Math.min(producto.stock, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="boton secundario" onClick={() => comprar(false)} disabled={enviando}>
                  Agregar al carrito
                </button>
                <button className="boton" onClick={() => comprar(true)} disabled={enviando}>
                  Comprar ahora
                </button>
              </div>
            </>
          ) : (
            <p className="sin-stock">Sin stock</p>
          )}
          {mensaje && <div className={`aviso ${mensaje.tipo}`} style={{ marginTop: 12 }}>{mensaje.texto}</div>}
        </div>
      </div>

      {relacionados.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Productos relacionados</h2>
          <div className="cuadricula">
            {relacionados.map((r) => (
              <Link key={r.id} to={`/producto/${r.id}`} className="producto-card">
                <div className="producto-imagen">
                  {r.imagen ? <img src={r.imagen} alt={r.nombre} /> : <span className="nota">Sin imagen</span>}
                </div>
                <span className="producto-nombre">{r.nombre}</span>
                <span className="precio">{formatoCLP(r.precio)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ProductPage
