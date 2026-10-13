import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import api, { formatoCLP, mensajeError, PASIVO } from '../api'
import Icono from '../components/Icono'
import ProductCard, { Estrellas } from '../components/ProductCard'
import { useAuth, useCarrito } from '../contexto/auth'
import useRefrescoPeriodico from '../useRefrescoPeriodico'

const BENEFICIOS = [
  { icono: 'camion', titulo: 'Despacho a todo Chile', texto: 'Se calcula según tu región al pagar' },
  { icono: 'candado', titulo: 'Pago seguro', texto: 'Con tarjeta a través de Webpay' },
  { icono: 'check', titulo: 'Precio final', texto: 'Incluye IVA (19%)' },
]

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
  const [agregado, setAgregado] = useState(false)

  const idVigente = useRef(id)

  const cargar = useCallback((silencioso) => {
    idVigente.current = id
    return api.get('productos/listar', silencioso ? PASIVO : undefined)
      .then(({ data }) => {
        if (idVigente.current !== id) return
        const producto = data.productos.find((p) => String(p.id) === id) || null
        const relacionados = producto
          ? data.productos
            .filter((p) => p.categoria_id === producto.categoria_id && p.id !== producto.id && p.disponible > 0)
            .sort((a, b) => b.calificacion_promedio - a.calificacion_promedio)
            .slice(0, 4)
          : []
        setEstado({ cargando: false, producto, relacionados })
      })
      .catch(() => {
        if (!silencioso && idVigente.current === id) setEstado({ cargando: false, producto: null, relacionados: [] })
      })
  }, [id])

  useEffect(() => {
    cargar(false)
  }, [cargar])

  useRefrescoPeriodico(() => cargar(true))

  useEffect(() => {
    if (!agregado) return undefined
    const temporizador = setTimeout(() => setAgregado(false), 1800)
    return () => clearTimeout(temporizador)
  }, [agregado])

  const { cargando, producto, relacionados } = estado

  if (cargando) return <div className="contenedor"><p className="vacio">Cargando producto...</p></div>
  if (!producto) {
    return (
      <div className="contenedor">
        <p className="vacio">Producto no encontrado. <Link to="/catalogo">Volver al catálogo</Link></p>
      </div>
    )
  }

  const cantidad = Math.min(unidades, Math.max(producto.disponible, 1))
  const cambiarUnidades = (valor) => setUnidades(Math.min(producto.disponible, Math.max(1, valor || 1)))

  const comprar = async (irAlCarrito) => {
    if (!usuario) {
      navigate('/login', { state: { desde: ubicacion.pathname } })
      return
    }
    setEnviando(true)
    setMensaje(null)
    try {
      await agregar(producto.id, cantidad)
      if (irAlCarrito) navigate('/carrito')
      else setAgregado(true)
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeError(error) })
    } finally {
      setEnviando(false)
    }
  }

  const pocasUnidades = producto.disponible > 0 && producto.disponible <= 5
  const reservado = producto.disponible <= 0 && producto.stock > 0

  return (
    <div className="contenedor">
      <nav className="migas" aria-label="Ruta">
        <Link to="/">Inicio</Link>
        <span className="migas-sep">/</span>
        <Link to={`/catalogo?categoria=${producto.categoria_id}`}>{producto.categoria}</Link>
        <span className="migas-sep">/</span>
        <span>{producto.nombre}</span>
      </nav>

      <div className="ficha">
        <div className="ficha-galeria">
          <div className="ficha-imagen">
            <span className="ficha-categoria">{producto.categoria}</span>
            {producto.imagenes.length > 0 ? (
              <img key={imagenActiva} src={producto.imagenes[imagenActiva]} alt={producto.nombre} />
            ) : (
              <span className="nota">Sin imagen</span>
            )}
          </div>
          {producto.imagenes.length > 1 && (
            <div className="ficha-miniaturas">
              {producto.imagenes.map((url, indice) => (
                <button
                  type="button"
                  key={url}
                  className={indice === imagenActiva ? 'activa' : ''}
                  onClick={() => setImagenActiva(indice)}
                  aria-label={`Ver imagen ${indice + 1}`}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ficha-info">
          {producto.marca && <span className="ficha-marca">{producto.marca}</span>}
          <h1>{producto.nombre}</h1>
          <div className="ficha-valoracion">
            <Estrellas promedio={producto.calificacion_promedio} total={producto.total_reviews} />
            <span className="nota">{producto.total_reviews === 1 ? '1 valoración' : `${producto.total_reviews} valoraciones`}</span>
          </div>

          <div className="ficha-precio">
            <span className="precio">{formatoCLP(producto.precio)}</span>
            <small>Incluye IVA</small>
          </div>

          {producto.descripcion && <p className="ficha-descripcion">{producto.descripcion}</p>}

          {producto.disponible > 0 ? (
            <>
              <div className={pocasUnidades ? 'ficha-stock pocas' : 'ficha-stock'}>
                <span className="ficha-punto" />
                {pocasUnidades ? `Quedan solo ${producto.disponible} unidades` : `${producto.disponible} unidades disponibles`}
              </div>

              <div className="ficha-compra">
                <div className="ficha-cantidad" role="group" aria-label="Cantidad">
                  <button type="button" onClick={() => cambiarUnidades(cantidad - 1)} disabled={cantidad <= 1} aria-label="Restar una unidad">-</button>
                  <input
                    type="number"
                    min="1"
                    max={producto.disponible}
                    value={cantidad}
                    onChange={(e) => cambiarUnidades(Number(e.target.value))}
                    aria-label="Cantidad"
                  />
                  <button type="button" onClick={() => cambiarUnidades(cantidad + 1)} disabled={cantidad >= producto.disponible} aria-label="Sumar una unidad">+</button>
                </div>
                <div className="ficha-subtotal">
                  <small>Subtotal</small>
                  <strong>{formatoCLP(producto.precio * cantidad)}</strong>
                </div>
              </div>

              <div className="ficha-botones">
                <button className={agregado ? 'ficha-agregar agregado' : 'ficha-agregar'} onClick={() => comprar(false)} disabled={enviando}>
                  {agregado ? (
                    <span className="agregado-contenido"><Icono nombre="check" tamano={20} /> Agregado</span>
                  ) : enviando ? 'Agregando...' : 'Agregar al carrito'}
                </button>
                <button className="ficha-comprar" onClick={() => comprar(true)} disabled={enviando}>
                  Comprar ahora
                </button>
              </div>
            </>
          ) : (
            <div className="ficha-agotado">
              <Icono nombre="alerta" tamano={24} />
              {reservado ? (
                <span><strong>Reservado por otros clientes</strong><small>Están pagando las últimas unidades. Si no completan el pago, se liberan en unos minutos.</small></span>
              ) : (
                <span><strong>Sin stock por ahora</strong><small>Vuelve a revisar pronto o mira productos similares más abajo.</small></span>
              )}
            </div>
          )}
          {mensaje && (
            <div className="ficha-mensaje" role="alert">
              <span className="ficha-mensaje-icono"><Icono nombre="alerta" tamano={22} /></span>
              <span>
                <strong>{mensaje.texto.split('.')[0]}</strong>
                {mensaje.texto.includes('.') && mensaje.texto.split('.').slice(1).join('.').trim() && (
                  <small>{mensaje.texto.split('.').slice(1).join('.').trim()}</small>
                )}
              </span>
              <button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar aviso">x</button>
            </div>
          )}

          <ul className="ficha-beneficios">
            {BENEFICIOS.map((b) => (
              <li key={b.titulo}>
                <span className="ficha-beneficio-icono"><Icono nombre={b.icono} tamano={20} /></span>
                <span><strong>{b.titulo}</strong><small>{b.texto}</small></span>
              </li>
            ))}
          </ul>
          <p className="ficha-codigo">Código de producto: {producto.codigo}</p>
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="ficha-relacionados">
          <div className="ficha-relacionados-cabecera">
            <h2>Otros productos de {producto.categoria}</h2>
            <Link to={`/catalogo?categoria=${producto.categoria_id}&orden=valorados`}>Ver más</Link>
          </div>
          <div className="cuadricula cuadricula-catalogo">
            {relacionados.map((r) => <ProductCard key={r.id} producto={r} />)}
          </div>
        </section>
      )}
    </div>
  )
}

export default ProductPage
