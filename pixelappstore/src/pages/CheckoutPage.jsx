import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { formatoCLP, mensajeError } from '../api'

const REGIONES = [
  ['RM', 'Región Metropolitana'],
  ['Arica y Parinacota', 'Arica y Parinacota'],
  ['Tarapacá', 'Tarapacá'],
  ['Antofagasta', 'Antofagasta'],
  ['Atacama', 'Atacama'],
  ['Coquimbo', 'Coquimbo'],
  ['Valparaíso', 'Valparaíso'],
  ["O'Higgins", "O'Higgins"],
  ['Maule', 'Maule'],
  ['Ñuble', 'Ñuble'],
  ['Biobío', 'Biobío'],
  ['La Araucanía', 'La Araucanía'],
  ['Los Ríos', 'Los Ríos'],
  ['Los Lagos', 'Los Lagos'],
  ['Aysén', 'Aysén'],
  ['Magallanes', 'Magallanes'],
]

// Webpay exige entrar con un POST del navegador y el token en el campo token_ws
function enviarAWebpay(url, token) {
  const formulario = document.createElement('form')
  formulario.method = 'POST'
  formulario.action = url
  const campo = document.createElement('input')
  campo.type = 'hidden'
  campo.name = 'token_ws'
  campo.value = token
  formulario.appendChild(campo)
  document.body.appendChild(formulario)
  formulario.submit()
}

function CheckoutPage() {
  const [estado, setEstado] = useState({ cargando: true, items: [], total: 0 })
  const [region, setRegion] = useState('RM')
  const [cupon, setCupon] = useState('')
  const [error, setError] = useState(null)
  const [pagando, setPagando] = useState(false)

  useEffect(() => {
    let vigente = true
    api.get('carrito/ver')
      .then(({ data }) => {
        if (vigente) setEstado({ cargando: false, items: data.items, total: data.total_estimado })
      })
      .catch((e) => {
        if (!vigente) return
        setEstado({ cargando: false, items: [], total: 0 })
        setError(mensajeError(e))
      })
    return () => { vigente = false }
  }, [])

  const { cargando, items, total } = estado
  const envio = region === 'RM' ? 3000 : 6000

  const pagar = async () => {
    setError(null)
    setPagando(true)
    try {
      const { data } = await api.post('webpay/iniciar', {
        items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        region,
        cupon: cupon.trim() || null,
      })
      enviarAWebpay(data.url_webpay, data.token)
    } catch (e) {
      setError(mensajeError(e))
      setPagando(false)
    }
  }

  if (cargando) return <div className="contenedor"><p className="vacio">Cargando...</p></div>

  if (items.length === 0) {
    return (
      <div className="contenedor">
        <div className="tarjeta vacio">
          <p>No hay productos para pagar.</p>
          <Link to="/" className="boton">Ver catálogo</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="contenedor">
      <h1>Finalizar compra</h1>
      <div className="dos-columnas">
        <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2>Entrega</h2>
          <label className="campo">
            Región de despacho
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONES.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
            </select>
          </label>
          <label className="campo">
            Cupón de descuento (opcional)
            <input value={cupon} onChange={(e) => setCupon(e.target.value)} placeholder="Ej: PIXEL10" />
          </label>

          <h2 style={{ marginTop: 8 }}>Tu pedido</h2>
          {items.map((i) => (
            <div key={i.item_id} className="resumen-fila">
              <span>{i.nombre} × {i.cantidad}</span>
              <span>{formatoCLP(i.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="tarjeta">
          <h2>Resumen</h2>
          <div className="resumen-fila"><span>Productos</span><span>{formatoCLP(total)}</span></div>
          <div className="resumen-fila"><span>Envío</span><span>{formatoCLP(envio)}</span></div>
          <div className="resumen-fila"><span>Cupón</span><span className="nota">se aplica al pagar</span></div>
          <div className="resumen-fila resumen-total"><span>Total estimado</span><span>{formatoCLP(total + envio)}</span></div>

          {error && <div className="aviso error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="boton completo" style={{ marginTop: 14 }} onClick={pagar} disabled={pagando}>
            {pagando ? 'Redirigiendo a Webpay...' : 'Pagar con Webpay'}
          </button>
          <p className="nota">El total final lo confirma Webpay, con el descuento del cupón si corresponde.</p>
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
