import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="pie">
      <div className="pie-contenido">
        <div>
          <img src="/logo.png" alt="Pixel App Store" className="pie-logo" />
          <p>Productos tecnológicos con retiro en tienda y despacho a todo Chile.</p>
        </div>
        <div>
          <h3>Tienda</h3>
          <Link to="/catalogo">Catálogo</Link>
          <Link to="/carrito">Carrito</Link>
          <Link to="/mis-compras">Mis compras</Link>
        </div>
        <div>
          <h3>Despacho</h3>
          <p>Santiago: 5 días hábiles</p>
          <p>Regiones: 5 a 25 días hábiles</p>
          <p>Retiro inmediato en tienda</p>
        </div>
      </div>
      <div className="pie-final">
        <div>© {new Date().getFullYear()} Pixel App Store</div>
        <div className="pie-creditos">
          Fotos de productos: Wikimedia Commons (Phiarc, PantheraLeo1359531 y Triple-green, licencias CC BY y CC BY-SA),
          Logitech G y HyperX. Uso académico.
        </div>
      </div>
    </footer>
  )
}

export default Footer
