import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AuthProvider, CarritoProvider } from './contexto/Proveedores'
import Header from './components/Header'
import RequireAuth from './components/RequireAuth'
import Footer from './components/Footer'
import Saturacion from './components/Saturacion'
import PortadaPage from './pages/PortadaPage'
import HomePage from './pages/HomePage'
import AuthLayout from './pages/AuthLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import PagoResultadoPage from './pages/PagoResultadoPage'
import MisComprasPage from './pages/MisComprasPage'
import CuentaPage from './pages/CuentaPage'
import RecuperarPage from './pages/RecuperarPage'
import RecuperarConfirmarPage from './pages/RecuperarConfirmarPage'
import RutaDesconocida from './pages/RutaDesconocida'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CarritoProvider>
          <Header />
          <main>
          <Routes>
            <Route path="/" element={<PortadaPage />} />
            <Route path="/catalogo" element={<HomePage />} />
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route path="/recuperar" element={<RecuperarPage />} />
              <Route path="/recuperar/confirmar" element={<RecuperarConfirmarPage />} />
            </Route>
            <Route path="/producto/:id" element={<ProductPage />} />
            <Route path="/carrito" element={<RequireAuth><CartPage /></RequireAuth>} />
            <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
            <Route path="/pago/resultado" element={<PagoResultadoPage />} />
            <Route path="/mis-compras" element={<RequireAuth><MisComprasPage /></RequireAuth>} />
            <Route path="/cuenta" element={<RequireAuth><CuentaPage /></RequireAuth>} />
            <Route path="*" element={<RutaDesconocida />} />
          </Routes>
          </main>
          <Footer />
          <Saturacion />
        </CarritoProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
