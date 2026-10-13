import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensajeError, PASIVO } from '../api'
import useRefrescoPeriodico from '../useRefrescoPeriodico'
import ProductCard from '../components/ProductCard'
import PixelArt from '../components/PixelArt'
import CargandoProductos from '../components/CargandoProductos'
import Icono from '../components/Icono'
import { GRUPOS_CATEGORIAS, ICONO_CATEGORIA, ORDEN_CATEGORIAS } from '../iconosCategoria'

function Hero() {
  return (
    <section className="hero">
      <div className="hero-contenido">
        <span className="hero-etiqueta">Productos tecnológicos</span>
        <h1>Tecnología con estilo <span className="resaltado">pixel</span></h1>
        <p>
          Periféricos, componentes y accesorios para tu setup. Elige, paga con Webpay
          y retira en tienda o recíbelo en casa.
        </p>
        <div className="hero-botones">
          <Link to="/catalogo" className="boton amarillo">Ver catálogo</Link>
          <a href="#destacados" className="boton fantasma">Lo más nuevo</a>
        </div>
      </div>
      <div className="hero-imagen">
        <img src="/icono.png" alt="Pixel App Store" />
      </div>
    </section>
  )
}

function textoCantidad(total) {
  return `${total} ${total === 1 ? 'producto' : 'productos'}`
}

const VISIBLES_INICIAL = 9

function categoriasDe(productos) {
  const mapa = new Map()
  productos.forEach((p) => {
    if (!p.categoria_id) return
    const actual = mapa.get(p.categoria_id) || { id: p.categoria_id, nombre: p.categoria, total: 0 }
    mapa.set(p.categoria_id, { ...actual, total: actual.total + 1 })
  })
  const posicion = (nombre) => {
    const i = ORDEN_CATEGORIAS.indexOf(nombre)
    return i === -1 ? ORDEN_CATEGORIAS.length : i
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || posicion(a.nombre) - posicion(b.nombre))
}

function Categorias({ categorias }) {
  const [expandido, setExpandido] = useState(false)
  if (categorias.length === 0) return null

  const hayMas = categorias.length > VISIBLES_INICIAL
  const mostradas = expandido || !hayMas ? categorias : categorias.slice(0, VISIBLES_INICIAL)
  const ocultas = categorias.length - VISIBLES_INICIAL

  return (
    <section>
      <h2 className="titulo-seccion"><span>Compra por categoría</span></h2>
      <div className="cats-circulos">
        {mostradas.map((c, i) => (
          <Link
            key={c.id}
            to={`/catalogo?categoria=${c.id}`}
            className={i >= VISIBLES_INICIAL ? 'circulo-item aparece-cat' : 'circulo-item'}
            style={i >= VISIBLES_INICIAL ? { animationDelay: `${(i - VISIBLES_INICIAL) * 0.04}s` } : undefined}
          >
            <span className="circulo">
              {ICONO_CATEGORIA[c.nombre]
                ? <PixelArt nombre={ICONO_CATEGORIA[c.nombre]} tamano={56} />
                : <Icono nombre="tienda" tamano={36} />}
            </span>
            <strong>{c.nombre}</strong>
            <small>{textoCantidad(c.total)}</small>
          </Link>
        ))}
      </div>
      {hayMas && (
        <p className="centrado">
          <button className="boton amarillo boton-mas" onClick={() => setExpandido(!expandido)} aria-expanded={expandido}>
            {expandido ? 'Ver menos categorías' : `Ver ${ocultas} categorías más`}
            <span className={expandido ? 'chevron-giro abierto' : 'chevron-giro'}><Icono nombre="chevron" tamano={16} /></span>
          </button>
        </p>
      )}
    </section>
  )
}

const ESTANTES = [
  { titulo: 'Notebooks gamer', categoria: 'Notebooks' },
  { titulo: 'Televisores', categoria: 'Televisores' },
  { titulo: 'Componentes de PC', grupo: 'componentes' },
  { titulo: 'Consolas', categoria: 'Consolas' },
  { titulo: 'Periféricos', grupo: 'perifericos' },
]

function Estante({ estante, productos }) {
  const nombres = estante.grupo
    ? GRUPOS_CATEGORIAS.find((g) => g.id === estante.grupo).nombres
    : [estante.categoria]
  const lista = productos
    .filter((p) => nombres.includes(p.categoria))
    .sort((a, b) => (b.stock > 0) - (a.stock > 0) || b.calificacion_promedio - a.calificacion_promedio || b.total_reviews - a.total_reviews)
    .slice(0, 6)
  if (lista.length === 0) return null

  const idCategoria = estante.categoria ? lista[0].categoria_id : null
  const destino = estante.grupo
    ? `/catalogo?grupo=${estante.grupo}&orden=valorados`
    : `/catalogo?categoria=${idCategoria}&orden=valorados`

  return (
    <section className="estante">
      <div className="estante-cabecera">
        <h2 className="titulo-seccion"><span>{estante.titulo}</span></h2>
        <Link to={destino} className="estante-mas">
          Ver más <Icono nombre="flecha" tamano={16} />
        </Link>
      </div>
      <div className="destacados">
        {lista.map((producto) => <ProductCard key={producto.id} producto={producto} />)}
      </div>
    </section>
  )
}

function PortadaPage() {
  const [estado, setEstado] = useState({ cargando: true, productos: [], error: null })

  const cargar = useCallback((silencioso) => api.get('productos/listar', silencioso ? PASIVO : undefined)
    .then(({ data }) => {
      setEstado({ cargando: false, productos: data.productos, error: null })
    })
    .catch((error) => {
      if (!silencioso) setEstado({ cargando: false, productos: [], error: mensajeError(error) })
    }), [])

  useEffect(() => {
    cargar(false)
  }, [cargar])

  useRefrescoPeriodico(() => cargar(true))

  const { cargando, productos, error } = estado

  const categorias = categoriasDe(productos)

  const destacados = [...productos]
    .filter((p) => p.stock > 0)
    .sort((a, b) => b.calificacion_promedio - a.calificacion_promedio || b.id - a.id)
    .slice(0, 6)

  return (
    <>
      <Hero />
      <div className="contenedor">
        {error && <div className="aviso error">{error}</div>}
        <Categorias categorias={categorias} />

        <section id="destacados">
          <h2 className="titulo-seccion"><span>Destacados</span></h2>
          {cargando && <CargandoProductos tarjetas={6} clase="destacados" />}
          <div className="destacados">
            {destacados.map((producto) => (
              <ProductCard
                key={producto.id}
                producto={producto}
                variante="variante-a"
                etiqueta={producto.calificacion_promedio > 0 ? 'Mejor valorado' : 'Destacado'}
              />
            ))}
          </div>
          {!cargando && productos.length > 0 && (
            <p className="centrado" style={{ marginTop: 24 }}>
              <Link to="/catalogo" className="boton secundario">Ver todos los productos</Link>
            </p>
          )}
        </section>

        {!cargando && ESTANTES.map((e) => <Estante key={e.titulo} estante={e} productos={productos} />)}
      </div>
    </>
  )
}

export default PortadaPage
