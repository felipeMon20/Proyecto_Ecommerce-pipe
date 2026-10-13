import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'

// Importamos las páginas que acabas de crear
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'

// Un componente simple para el MENU (luego lo haremos bonito en su propio archivo)
function Navbar() {
  return (
    <nav style={{ padding: '15px', borderBottom: '1px solid #ccc', marginBottom: '20px', display: 'flex', gap: '20px', background: '#f8f9fa' }}>
      <Link to="/" style={{ textDecoration: 'none', fontWeight: 'bold', color: '#333' }}>🏢 PixelAppStore</Link>
      <div style={{ flexGrow: 1 }}></div> {/* Empuja los items a la derecha */}
      <Link to="/registro">📝 Registrarse</Link>
      <Link to="/login">🔐 Login</Link>
      <Link to="/carrito">🛒 Carrito</Link>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      {/* El Menú se verá en TODAS las páginas */}
      <Navbar />

      <div style={{ padding: '20px' }}>
        {/* Aquí cambiamos de pantalla según la URL */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/producto/:id" element={<ProductPage />} /> {/* :id es dinámico para saber qué producto es */}
          <Route path="/carrito" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App