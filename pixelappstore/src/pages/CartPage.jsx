import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { formatoCLP, mensajeError, PASIVO } from '../api'
import { useCarrito } from '../contexto/auth'
import PixelArt from '../components/PixelArt'
import Icono from '../components/Icono'
import Monto from '../components/Monto'
import useRefrescoPeriodico from '../useRefrescoPeriodico'

function Caminante({ frames }) {
  return (
    <span className="caminante">
      <PixelArt nombre={frames[0]} tamano={100} className="paso paso-1" />
      <PixelArt nombre={frames[1]} tamano={100} className="paso paso-2" />
    </span>
  )
}

function Carro() {
  return (
    <span className="carro">
      <PixelArt nombre="carro" tamano={77} />
    </span>
  )
}

function Empujando() {
  return (
    <>
      <span className="persona-caja">
        <span className="fase-agarra"><PixelArt nombre="persona_agarra" tamano={100} /></span>
        <span className="fase-empuja"><Caminante frames={['persona_emp1', 'persona_emp2']} /></span>
      </span>
      <Carro />
    </>
  )
}

function ConBolsas() {
  return (
    <span className="persona-caja">
      <Caminante frames={['persona_bol1', 'persona_bol2']} />
      <span className="bolsa bolsa-atras"><PixelArt nombre="bolsa_rosa" tamano={32} /></span>
      <span className="bolsa bolsa-frente"><PixelArt nombre="bolsa_cian" tamano={32} /></span>
    </span>
  )
}

function CarritoVacio() {
  return (
    <div className="carrito-vacio">
      <div className="escena-tienda" aria-hidden="true">
        <div className="escena-local">
          <img src="/logo.png" alt="" className="escena-rotulo" />
          <PixelArt nombre="tienda" tamano={224} />
        </div>
        <span className="escena-puerta" />
        <div className="escena-suelo" />
        <div className="carro-espera"><Carro /></div>
        <div className="actor a-camina">
          <span className="persona-caja"><Caminante frames={['persona_cam1', 'persona_cam2']} /></span>
        </div>
        <div className="actor a-empuja"><Empujando /></div>
        <div className="actor a-vuelta"><ConBolsas /></div>
      </div>
      <h2>Tu carrito está vacío</h2>
      <p>Pasa por la tienda y vuelve con algo para tu setup.</p>
      <Link to="/catalogo" className="boton amarillo boton-mas">Explorar el catálogo</Link>
    </div>
  )
}

const SALIDA_MS = 420
const ESCALON_MS = 70

const avisoDisponible = (item) => (item.disponible !== undefined && item.cantidad > item.disponible
  ? `Ahora solo quedan ${item.disponible} disponibles. Baja la cantidad para poder pagar.`
  : null)

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

function CartPage() {
  const { refrescar, agregar } = useCarrito()
  const [estado, setEstado] = useState({ cargando: true, items: [], total: 0 })
  const [error, setError] = useState(null)
  const [saliendo, setSaliendo] = useState([])
  const [vaciando, setVaciando] = useState(false)
  const [erroresItem, setErroresItem] = useState({})
  const colas = useRef(new Map())

  const cargar = useCallback((pasivo) => api.get('carrito/ver', pasivo === true ? PASIVO : undefined)
    .then(({ data }) => {
      setEstado({ cargando: false, items: data.items, total: data.total_estimado })
    })
    .catch((e) => {
      setEstado({ cargando: false, items: [], total: 0 })
      setError(mensajeError(e))
    }), [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // No se refresca mientras hay cambios en camino, para no pisar lo que el cliente está haciendo
  useRefrescoPeriodico(() => {
    const ocupado = [...colas.current.values()].some((c) => c.pendientes > 0)
    if (!ocupado && !vaciando && saliendo.length === 0) cargar(true)
  })

  const accion = async (peticion) => {
    setError(null)
    try {
      await peticion()
      await cargar()
      await refrescar()
      return true
    } catch (e) {
      setError(mensajeError(e))
      return false
    }
  }

  const ajustar = (itemId, delta) => {
    setEstado((previo) => {
      const objetivo = previo.items.find((i) => i.item_id === itemId)
      if (!objetivo) return previo
      return {
        ...previo,
        items: previo.items.map((i) => (i.item_id === itemId
          ? { ...i, cantidad: i.cantidad + delta, subtotal: i.precio * (i.cantidad + delta) }
          : i)),
        total: previo.total + objetivo.precio * delta,
      }
    })
  }

  const ponerErrorItem = (itemId, mensaje) => {
    setErroresItem((previo) => {
      const copia = { ...previo }
      if (mensaje) copia[itemId] = mensaje
      else delete copia[itemId]
      return copia
    })
  }

  // El cambio se ve al instante y las peticiones de un mismo producto van en fila.
  // Si el servidor lo rechaza (por ejemplo, sin stock) se revierte y el aviso sale en su tarjeta.
  const cambiarCantidad = (item, delta, peticion) => {
    if (delta < 0 && item.cantidad <= 1) return
    if (delta > 0 && item.disponible !== undefined && item.cantidad >= item.disponible) return
    ponerErrorItem(item.item_id, null)
    ajustar(item.item_id, delta)

    const cola = colas.current.get(item.item_id) || { cadena: Promise.resolve(), pendientes: 0 }
    cola.pendientes += 1
    cola.cadena = cola.cadena
      .then(peticion)
      .catch((e) => {
        ajustar(item.item_id, -delta)
        ponerErrorItem(item.item_id, mensajeError(e))
        setTimeout(() => ponerErrorItem(item.item_id, null), 4500)
      })
      .then(() => {
        cola.pendientes -= 1
        if (cola.pendientes === 0) {
          cargar()
          refrescar()
        }
      })
    colas.current.set(item.item_id, cola)
  }

  const quitar = async (item) => {
    setSaliendo((lista) => [...lista, item.item_id])
    await esperar(SALIDA_MS)
    const ok = await accion(() => api.delete(`carrito/eliminar/${item.item_id}`))
    if (!ok) setSaliendo((lista) => lista.filter((id) => id !== item.item_id))
  }

  const vaciar = async () => {
    setVaciando(true)
    await esperar(SALIDA_MS + estado.items.length * ESCALON_MS)
    const ok = await accion(() => api.delete('carrito/vaciar'))
    if (!ok) setVaciando(false)
  }

  const { cargando, items, total } = estado
  const unidades = items.reduce((suma, item) => suma + item.cantidad, 0)

  if (cargando) return <div className="contenedor"><p className="vacio">Cargando carrito...</p></div>

  return (
    <div className="contenedor">
      <div className="carro-titulo">
        <h1>Carrito de compras</h1>
        {items.length > 0 && <span className="carro-chip">{unidades} {unidades === 1 ? 'unidad' : 'unidades'}</span>}
      </div>
      {error && <div className="aviso error" style={{ marginBottom: 12 }}>{error}</div>}

      {items.length === 0 ? (
        <div className="vacio-entra"><CarritoVacio /></div>
      ) : (
        <div className="carro-layout">
          <div className="carro-lista">
            {items.map((item, i) => {
              const sale = vaciando || saliendo.includes(item.item_id)
              const retardo = vaciando ? i * ESCALON_MS : sale ? 0 : i * ESCALON_MS
              return (
                <article
                  key={item.item_id}
                  className={sale ? 'carro-item sale' : 'carro-item'}
                  style={{ animationDelay: `${retardo}ms` }}
                >
                  <Link to={`/producto/${item.producto_id}`} className="carro-foto">
                    {item.imagen ? <img src={item.imagen} alt={item.nombre} /> : <span className="nota">Sin imagen</span>}
                  </Link>
                  <div className="carro-info">
                    <Link to={`/producto/${item.producto_id}`} className="carro-nombre">{item.nombre}</Link>
                    <span className="carro-unitario">{formatoCLP(item.precio)} c/u</span>
                    <div className="carro-cantidad">
                      <span>Cantidad</span>
                      {item.cantidad > 1 && (
                        <button
                          className="carro-menos"
                          onClick={() => cambiarCantidad(item, -1, () => api.post(`carrito/restar/${item.item_id}`))}
                          aria-label={`Descartar una unidad de ${item.nombre}`}
                          title="Descartar una unidad"
                        >
                          -1
                        </button>
                      )}
                      <strong key={item.cantidad} className="carro-numero">{item.cantidad}</strong>
                      <button
                        className="carro-mas"
                        onClick={() => cambiarCantidad(item, 1, () => agregar(item.producto_id, 1))}
                        disabled={item.disponible !== undefined && item.cantidad >= item.disponible}
                        title={item.disponible !== undefined && item.cantidad >= item.disponible ? `Disponible: ${item.disponible}` : 'Agregar una unidad'}
                        aria-label={`Agregar una unidad de ${item.nombre}`}
                      >
                        +1
                      </button>
                    </div>
                    {(erroresItem[item.item_id] || avisoDisponible(item)) && (
                      <span className="carro-error" role="alert">
                        <Icono nombre="alerta" tamano={15} /> {erroresItem[item.item_id] || avisoDisponible(item)}
                      </span>
                    )}
                  </div>
                  <div className="carro-derecha">
                    <span className="carro-subtotal">{formatoCLP(item.subtotal)}</span>
                    <button className="carro-quitar" onClick={() => quitar(item)} disabled={sale}>
                      <Icono nombre="cerrar" tamano={14} /> Quitar
                    </button>
                  </div>
                </article>
              )
            })}
            <div className="carro-pie">
              <Link to="/catalogo" className="carro-seguir"><Icono nombre="volver" tamano={16} /> Seguir comprando</Link>
              <button className="carro-vaciar" onClick={vaciar} disabled={vaciando}>Vaciar carrito</button>
            </div>
          </div>

          <aside className="carro-resumen">
            <h2>Resumen</h2>
            <div className="carro-fila"><span>Productos ({unidades})</span><strong><Monto valor={total} /></strong></div>
            <div className="carro-fila"><span>Envío</span><span className="carro-nota">se calcula al pagar</span></div>
            <div className="carro-fila carro-total"><span>Subtotal</span><strong><Monto valor={total} /></strong></div>
            <Link to="/checkout" className="carro-pagar">
              <Icono nombre="candado" tamano={18} /> Ir a pagar <Icono nombre="flecha" tamano={18} />
            </Link>
            <ul className="carro-garantias">
              <li><Icono nombre="candado" tamano={16} /> Pago seguro con Webpay</li>
              <li><Icono nombre="camion" tamano={16} /> Despacho: $3.000 en la RM y $6.000 en regiones</li>
              <li><Icono nombre="tienda" tamano={16} /> Retiro inmediato en tienda</li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  )
}

export default CartPage
