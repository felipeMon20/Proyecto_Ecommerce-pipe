import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth, useCarrito } from '../contexto/auth'
import Icono from './Icono'
import PixelArt from './PixelArt'
import useCerrarAlExterior from '../useCerrarAlExterior'
import { GRUPOS_CATEGORIAS, ICONO_CATEGORIA } from '../iconosCategoria'

const BENEFICIOS = [
  { icono: 'tienda', titulo: 'Retiro inmediato', texto: 'Retira tu compra en tienda sin esperar.' },
  { icono: 'camion', titulo: 'Despacho a todo Chile', texto: '5 días hábiles en Santiago, 5 a 25 en regiones.' },
  { icono: 'candado', titulo: 'Pago seguro', texto: 'Paga con tarjeta a través de Webpay.' },
]

function elementosFranja() {
  return BENEFICIOS.map((b) => (
    <div key={b.titulo} className="franja-item">
      <span className="franja-icono"><Icono nombre={b.icono} tamano={18} /></span>
      <strong>{b.titulo}</strong>
      <span className="franja-texto">{b.texto}</span>
    </div>
  ))
}

function Franja() {
  return (
    <div className="franja-info">
      <div className="franja-pista">
        {[0, 1, 2, 3].map((copia) => (
          <div key={copia} className="franja-grupo" aria-hidden={copia > 0}>{elementosFranja()}</div>
        ))}
      </div>
    </div>
  )
}

function Logo() {
  const [sinImagen, setSinImagen] = useState(false)
  return (
    <Link to="/" className="logo" aria-label="Pixel App Store">
      {sinImagen ? (
        <span><span className="pixel">pixel</span>appstore</span>
      ) : (
        <img src="/logo.png" alt="Pixel App Store" onError={() => setSinImagen(true)} />
      )}
    </Link>
  )
}

function agruparCategorias(categorias) {
  const usadas = new Set()
  const grupos = GRUPOS_CATEGORIAS.map((g) => ({
    titulo: g.titulo,
    items: g.nombres.map((n) => categorias.find((c) => c.nombre === n)).filter(Boolean),
  }))
  grupos.forEach((g) => g.items.forEach((c) => usadas.add(c.id)))
  const otras = categorias.filter((c) => !usadas.has(c.id))
  if (otras.length > 0) grupos.push({ titulo: 'Otras', items: otras })
  return grupos.filter((g) => g.items.length > 0)
}

function MenuCategorias() {
  const [abierto, setAbierto] = useState(false)
  const [categorias, setCategorias] = useState([])
  const navigate = useNavigate()
  const ref = useCerrarAlExterior(abierto, () => setAbierto(false))

  useEffect(() => {
    api.get('productos/listar')
      .then(({ data }) => {
        const unicas = new Map()
        data.productos.forEach((p) => {
          if (!p.categoria_id) return
          const actual = unicas.get(p.categoria_id) || { nombre: p.categoria, total: 0 }
          unicas.set(p.categoria_id, { ...actual, total: actual.total + 1 })
        })
        setCategorias([...unicas].map(([id, c]) => ({ id, ...c })))
      })
      .catch(() => setCategorias([]))
  }, [])

  const elegir = (id) => {
    setAbierto(false)
    navigate(id ? `/catalogo?categoria=${id}` : '/catalogo')
  }

  return (
    <div className="menu-categorias" ref={ref}>
      <button className="boton-categorias" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        Categorías <Icono nombre="chevron" tamano={14} />
      </button>
      {abierto && (
        <div className="mega-categorias">
          <div className="mega-cabecera">
            <div>
              <strong>Explora por categoría</strong>
              <small>{categorias.length} categorías de tecnología gamer</small>
            </div>
            <button className="mega-todo" onClick={() => elegir(null)}>
              Ver todo el catálogo <Icono nombre="flecha" tamano={16} />
            </button>
          </div>
          <div className="mega-grupos">
            {agruparCategorias(categorias).map((g) => (
              <div key={g.titulo} className="mega-grupo">
                <h4>{g.titulo}</h4>
                {g.items.map((c) => (
                  <button key={c.id} className="mega-item" onClick={() => elegir(c.id)}>
                    <span className="mega-icono">
                      {ICONO_CATEGORIA[c.nombre]
                        ? <PixelArt nombre={ICONO_CATEGORIA[c.nombre]} tamano={28} />
                        : <Icono nombre="tienda" tamano={20} />}
                    </span>
                    <span className="mega-nombre">{c.nombre}</span>
                    <small>{c.total}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Buscador() {
  const [texto, setTexto] = useState('')
  const navigate = useNavigate()

  const buscar = (evento) => {
    evento.preventDefault()
    const q = texto.trim()
    navigate(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo')
  }

  return (
    <form className="buscador" onSubmit={buscar} role="search">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Busca aquí la tecnología en PixelAppStore"
        aria-label="Buscar productos"
      />
      <button type="submit" aria-label="Buscar" title="Buscar">
        <Icono nombre="lupa" tamano={20} />
      </button>
    </form>
  )
}

function MenuUsuario() {
  const { usuario, cerrarSesion } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const navigate = useNavigate()
  const ref = useCerrarAlExterior(abierto, () => setAbierto(false))
  const [panel, setPanel] = useState(null)

  // Solo quien es staff recibe la dirección del panel; para el resto el sitio no la menciona
  useEffect(() => {
    if (!usuario) return undefined
    let vigente = true
    api.get('panel/estado')
      .then(({ data }) => {
        if (vigente) setPanel(data.staff ? data.ruta : null)
      })
      .catch(() => {})
    return () => { vigente = false }
  }, [usuario])
  const rutaPanel = usuario ? panel : null

  const ir = (ruta) => {
    setAbierto(false)
    navigate(ruta)
  }

  const salir = async () => {
    setAbierto(false)
    await cerrarSesion()
    navigate('/')
  }

  return (
    <div className="menu-usuario" ref={ref}>
      <button className="boton-usuario" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <Icono nombre="usuario" tamano={26} />
        <span className="usuario-texto">
          <small>Hola,</small>
          <strong>{usuario ? usuario.username : 'Ingresa'}</strong>
        </span>
        <Icono nombre="chevron" tamano={14} />
      </button>

      {abierto && (
        <div className="lista-usuario">
          {usuario ? (
            <>
              {rutaPanel && <button className="principal" onClick={() => ir(`/${rutaPanel}`)}>Panel de administración</button>}
              <button onClick={() => ir('/cuenta')}>Mi cuenta</button>
              <button onClick={() => ir('/mis-compras')}>Mis compras</button>
              <button onClick={salir}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <button className="principal" onClick={() => ir('/login')}>Iniciar sesión</button>
              <button onClick={() => ir('/registro')}>Registrarse</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Header() {
  const { cantidad, pulso } = useCarrito()
  return (
    <>
      <nav className="navbar">
        <div className="navbar-contenido">
          <Logo />
          <MenuCategorias />
          <Buscador />
          <div className="acciones-nav">
            <MenuUsuario />
            <Link to="/carrito" className="boton-carrito" title="Carrito" aria-label={`Carrito, ${cantidad} productos`}>
              <span key={`icono-${pulso}`} className={pulso > 0 ? 'carrito-icono rebote' : 'carrito-icono'}>
                <Icono nombre="carrito" tamano={32} />
              </span>
              {cantidad > 0 && (
                <span key={`cantidad-${pulso}`} className={pulso > 0 ? 'insignia-carrito aparece' : 'insignia-carrito'}>
                  {cantidad > 99 ? '99+' : cantidad}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>
      <Franja />
    </>
  )
}

export default Header
