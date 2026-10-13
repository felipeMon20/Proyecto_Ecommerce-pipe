import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AuthProvider, CarritoProvider } from './contexto/Proveedores'
import Header from './components/Header'
import RequireAuth from './components/RequireAuth'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import PagoResultadoPage from './pages/PagoResultadoPage'
import MisComprasPage from './pages/MisComprasPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CarritoProvider>
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/producto/:id" element={<ProductPage />} />
            <Route path="/carrito" element={<RequireAuth><CartPage /></RequireAuth>} />
            <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
            <Route path="/pago/resultado" element={<PagoResultadoPage />} />
            <Route path="/mis-compras" element={<RequireAuth><MisComprasPage /></RequireAuth>} />
            <Route path="*" element={<div className="contenedor"><p className="vacio">Página no encontrada</p></div>} />
          </Routes>
        </CarritoProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
