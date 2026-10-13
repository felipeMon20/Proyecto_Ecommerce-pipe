import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { formatoCLP } from '../api'
import { useAuth, useCarrito } from '../contexto/auth'
import Icono from '../components/Icono'

const MENSAJES = {
  exito: {
    icono: 'check',
    tono: 'ok',
    titulo: '¡Pago confirmado!',
    texto: 'Recibimos tu pago y ya estamos preparando tu pedido. Te enviamos el resumen a tu correo.',
  },
  rechazado: {
    icono: 'cerrar',
    tono: 'mal',
    titulo: 'El pago fue rechazado',
    texto: 'No se realizó ningún cobro. Puede que el banco lo rechazara o que un producto se quedara sin stock mientras pagabas.',
    consejos: ['Revisa los datos de tu tarjeta o prueba con otro medio de pago.', 'Verifica que los productos sigan disponibles en tu carrito.'],
  },
  cancelado: {
    icono: 'volver',
    tono: 'neutro',
    titulo: 'Cancelaste el pago',
    texto: 'No se realizó ningún cobro y tus productos siguen en el carrito, esperándote.',
  },
  error: {
    icono: 'alerta',
    tono: 'aviso',
    titulo: 'No pudimos confirmar tu pago',
    texto: 'Si ves un cobro en tu tarjeta, será reversado automáticamente.',
    consejos: ['Revisa "Mis compras" para ver si el pedido quedó registrado.', 'Si no aparece, puedes intentar el pago de nuevo.'],
  },
}

const CONFETI = Array.from({ length: 22 }, (_, i) => ({
  izquierda: `${(i * 37) % 100}%`,
  demora: `${((i * 13) % 14) / 10}s`,
  duracion: `${2.4 + ((i * 7) % 12) / 10}s`,
  color: ['#ffd95a', '#19d3e6', '#ff4fa3', '#8e3bb0'][i % 4],
  tamano: 6 + (i % 3) * 3,
}))

const esRM = (region) => ['rm', 'metropolitana'].includes(String(region).toLowerCase())
const diasEntrega = (region) => (esRM(region) ? '5 días hábiles' : '5 a 25 días hábiles')

function Resumen({ venta }) {
  const productos = venta.items.reduce((suma, i) => suma + i.subtotal, 0)
  const d = venta.direccion || {}
  const lineaDireccion = [d.calle && `${d.calle} ${d.numero}`, d.complemento, d.comuna].filter(Boolean).join(', ')

  return (
    <div className="pago-resumen">
      <div className="pago-bloque">
        <h2>Tu pedido</h2>
        <ul className="pago-items">
          {venta.items.map((item, i) => (
            <li key={i}>
              <span className="pago-miniatura">
                {item.imagen ? <img src={item.imagen} alt="" /> : <Icono nombre="tienda" tamano={20} />}
              </span>
              <span className="pago-item-nombre">{item.producto}<small>{item.cantidad} {item.cantidad === 1 ? 'unidad' : 'unidades'}</small></span>
              <strong>{formatoCLP(item.subtotal)}</strong>
            </li>
          ))}
        </ul>
        <div className="pago-totales">
          <div><span>Productos</span><span>{formatoCLP(productos)}</span></div>
          <div><span>Envío</span><span>{formatoCLP(venta.envio)}</span></div>
          {venta.descuento > 0 && (
            <div className="pago-descuento"><span>Cupón {venta.cupon}</span><span>-{formatoCLP(venta.descuento)}</span></div>
          )}
          <div className="pago-total"><span>Total pagado</span><strong>{formatoCLP(venta.total)}</strong></div>
        </div>
      </div>

      <div className="pago-bloque">
        <h2>Entrega</h2>
        {lineaDireccion ? (
          <p className="pago-direccion">
            <strong>{d.nombre}</strong>
            {lineaDireccion}
            {d.telefono && <span>Tel. {d.telefono}</span>}
          </p>
        ) : (
          <p className="nota">Sin dirección registrada.</p>
        )}
        <p className="pago-entrega"><Icono nombre="camion" tamano={18} /> Llega en {diasEntrega(venta.region)}</p>

        <h2 className="pago-subtitulo">Qué sigue</h2>
        <ol className="pago-pasos">
          <li className="hecho"><span><Icono nombre="check" tamano={14} /></span>Pago confirmado</li>
          <li><span>2</span>Preparamos tu pedido</li>
          <li><span>3</span>Lo despachamos a tu dirección</li>
        </ol>
      </div>
    </div>
  )
}

function PagoResultadoPage() {
  const [parametros] = useSearchParams()
  const estado = parametros.get('estado')
  const idVenta = parametros.get('venta')
  const { usuario } = useAuth()
  const { refrescar } = useCarrito()
  const [venta, setVenta] = useState(null)
  const info = MENSAJES[estado] || MENSAJES.error

  // Al pagar, el backend vacía lo comprado del carrito: se actualiza el contador
  useEffect(() => {
    refrescar()
  }, [refrescar])

  useEffect(() => {
    if (estado !== 'exito' || !idVenta || !usuario) return undefined
    let vigente = true
    api.get('ventas/mis-compras')
      .then(({ data }) => {
        if (vigente) setVenta(data.ventas.find((v) => String(v.id) === idVenta) || null)
      })
      .catch(() => {})
    return () => { vigente = false }
  }, [estado, idVenta, usuario])

  const exito = estado === 'exito'

  return (
    <div className="contenedor">
      <div className="pago">
        <section className={`pago-hero ${info.tono}`}>
          {exito && (
            <div className="pago-confeti" aria-hidden="true">
              {CONFETI.map((c, i) => (
                <span key={i} style={{ left: c.izquierda, animationDelay: c.demora, animationDuration: c.duracion, background: c.color, width: c.tamano, height: c.tamano }} />
              ))}
            </div>
          )}
          <div className="pago-icono"><Icono nombre={info.icono} tamano={48} /></div>
          <h1>{info.titulo}</h1>
          {idVenta && <span className="pago-pedido">Pedido #{idVenta}</span>}
          <p>{info.texto}</p>
          {info.consejos && (
            <ul className="pago-consejos">
              {info.consejos.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
          <div className="pago-acciones">
            {exito ? (
              <>
                <Link to="/mis-compras" className="boton amarillo boton-mas">Ver mis compras</Link>
                <Link to="/catalogo" className="pago-secundario">Seguir comprando</Link>
              </>
            ) : (
              <>
                <Link to="/carrito" className="boton amarillo boton-mas">Volver al carrito</Link>
                <Link to="/mis-compras" className="pago-secundario">Mis compras</Link>
              </>
            )}
          </div>
        </section>

        {venta && <Resumen venta={venta} />}
      </div>
    </div>
  )
}

export default PagoResultadoPage
