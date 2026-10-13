import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCarrito } from '../contexto/auth'

const MENSAJES = {
  exito: {
    icono: '✅',
    titulo: '¡Pago confirmado!',
    texto: 'Recibimos tu pago. Te enviamos el resumen a tu correo.',
  },
  rechazado: {
    icono: '❌',
    titulo: 'El pago fue rechazado',
    texto: 'No se realizó ningún cobro. Puede que el banco lo rechazara o que el producto se quedara sin stock.',
  },
  cancelado: {
    icono: '↩️',
    titulo: 'Cancelaste el pago',
    texto: 'No se realizó ningún cobro. Tus productos siguen en el carrito.',
  },
  error: {
    icono: '⚠️',
    titulo: 'No pudimos confirmar tu pago',
    texto: 'Si te aparece un cobro en tu tarjeta, será reversado. Revisa "Mis compras" o inténtalo de nuevo.',
  },
}

function PagoResultadoPage() {
  const [parametros] = useSearchParams()
  const estado = parametros.get('estado')
  const venta = parametros.get('venta')
  const { refrescar } = useCarrito()
  const info = MENSAJES[estado] || MENSAJES.error

  // Al pagar, el backend vacía lo comprado del carrito: se actualiza el contador
  useEffect(() => {
    refrescar()
  }, [refrescar])

  return (
    <div className="contenedor">
      <div className="tarjeta resultado-pago">
        <div className="icono">{info.icono}</div>
        <h1>{info.titulo}</h1>
        {venta && <p className="nota">Pedido #{venta}</p>}
        <p>{info.texto}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {estado === 'exito' ? (
            <>
              <Link to="/mis-compras" className="boton">Ver mis compras</Link>
              <Link to="/" className="boton secundario">Seguir comprando</Link>
            </>
          ) : (
            <>
              <Link to="/carrito" className="boton">Volver al carrito</Link>
              <Link to="/mis-compras" className="boton secundario">Mis compras</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PagoResultadoPage
