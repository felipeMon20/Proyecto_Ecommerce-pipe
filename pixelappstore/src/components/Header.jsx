import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth, useCarrito } from '../contexto/auth'

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

function MenuCategorias() {
  const [abierto, setAbierto] = useState(false)
  const [categorias, setCategorias] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('productos/listar')
      .then(({ data }) => {
        const unicas = new Map()
        data.productos.forEach((p) => {
          if (p.categoria_id) unicas.set(p.categoria_id, p.categoria)
        })
        setCategorias([...unicas].map(([id, nombre]) => ({ id, nombre })))
      })
      .catch(() => setCategorias([]))
  }, [])

  const elegir = (id) => {
    setAbierto(false)
    navigate(id ? `/?categoria=${id}` : '/')
  }

  return (
    <div className="menu-categorias">
      <button className="boton-categorias" onClick={() => setAbierto(!abierto)}>
        Categorías ▾
      </button>
      {abierto && (
        <div className="lista-categorias">
          <button onClick={() => elegir(null)}>Todas</button>
          {categorias.map((c) => (
            <button key={c.id} onClick={() => elegir(c.id)}>{c.nombre}</button>
          ))}
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
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }

  return (
    <form className="buscador" onSubmit={buscar}>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar productos..."
        aria-label="Buscar productos"
      />
      <button type="submit">Buscar</button>
    </form>
  )
}

function Header() {
  const { usuario, cerrarSesion } = useAuth()
  const { cantidad } = useCarrito()
  const navigate = useNavigate()

  const salir = async () => {
    await cerrarSesion()
    navigate('/')
  }

  return (
    <header>
      <div className="franja-superior" />
      <nav className="navbar">
        <div className="navbar-contenido">
          <Logo />
          <MenuCategorias />
          <Buscador />
          <div className="acciones-nav">
            {usuario ? (
              <>
                <Link to="/mis-compras">Mis compras</Link>
                <span>Hola, {usuario.username}</span>
                <button onClick={salir}>Salir</button>
              </>
            ) : (
              <>
                <Link to="/login">Ingresar</Link>
                <Link to="/registro">Registrarse</Link>
              </>
            )}
            <Link to="/carrito">
              🛒 Carrito{cantidad > 0 && <span className="insignia">{cantidad}</span>}
            </Link>
          </div>
        </div>
      </nav>
      <div className="franja-info">
        Retiro inmediato en tienda | Envío en 5 días hábiles en Santiago | 🌎 Regiones 5 a 25 días hábiles
      </div>
    </header>
  )
}

export default Header
