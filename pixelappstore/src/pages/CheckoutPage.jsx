import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { formatoCLP, mensajeError } from '../api'
import Icono from '../components/Icono'
import Monto from '../components/Monto'
import useCerrarAlExterior from '../useCerrarAlExterior'
import { REGIONES, costoEnvio } from '../regiones'
import { comunaDeRegion } from '../comunas'
import CampoComuna from '../components/CampoComuna'

const TASA_IVA = 0.19
const DIRECCION_VACIA = {
  nombre: '', telefono: '', calle: '', numero: '', complemento: '', comuna: '', indicaciones: '',
}

function validarDireccion(d, region) {
  const errores = {}
  if (d.nombre.trim().length < 3) errores.nombre = 'Escribe el nombre de quien recibe'
  const digitos = d.telefono.replace(/\D/g, '').length
  if (digitos < 8 || digitos > 12) errores.telefono = 'Escribe un teléfono válido'
  if (!d.calle.trim()) errores.calle = 'Escribe la calle'
  if (!d.numero.trim()) errores.numero = 'Falta el número'
  if (!d.comuna.trim()) errores.comuna = 'Elige tu comuna'
  else if (!comunaDeRegion(region, d.comuna)) errores.comuna = 'Elige una comuna de la lista para esta región'
  return errores
}

function Campo({ nombre, etiqueta, valor, error, alCambiar, ancho = 2, opcional = false, ...resto }) {
  return (
    <label className={`dir-campo dir-${ancho}${error ? ' con-error' : ''}`}>
      <span>{etiqueta}{opcional && <small> (opcional)</small>}</span>
      <input
        name={nombre}
        value={valor}
        onChange={(e) => alCambiar(nombre, e.target.value)}
        aria-invalid={Boolean(error)}
        {...resto}
      />
      {error && <em>{error}</em>}
    </label>
  )
}

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

function Pasos() {
  return (
    <ol className="pasos" aria-label="Pasos de la compra">
      <li className="paso-hecho">
        <Link to="/carrito"><span className="paso-punto"><Icono nombre="check" tamano={14} /></span> Carrito</Link>
      </li>
      <li className="paso-linea" aria-hidden="true" />
      <li className="paso-actual"><span className="paso-punto">2</span> Entrega y pago</li>
      <li className="paso-linea pendiente" aria-hidden="true" />
      <li className="paso-pendiente"><span className="paso-punto">3</span> Confirmación</li>
    </ol>
  )
}

function SelectorRegion({ valor, alElegir }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCerrarAlExterior(abierto, () => setAbierto(false))
  const actual = REGIONES.find(([v]) => v === valor) || REGIONES[0]

  return (
    <div className="region" ref={ref}>
      <button type="button" className="region-boton" onClick={() => setAbierto(!abierto)} aria-haspopup="listbox" aria-expanded={abierto}>
        <span className="region-icono"><Icono nombre="camion" tamano={22} /></span>
        <span className="region-texto">
          <small>Región de despacho</small>
          <strong>{actual[1]}</strong>
        </span>
        <span className="region-precio">{formatoCLP(costoEnvio(valor))}</span>
        <span className={abierto ? 'chevron-giro abierto' : 'chevron-giro'}><Icono nombre="chevron" tamano={16} /></span>
      </button>
      {abierto && (
        <ul className="region-lista" role="listbox">
          {REGIONES.map(([v, nombre]) => (
            <li key={v} role="option" aria-selected={v === valor}>
              <button
                type="button"
                className={v === valor ? 'activa' : ''}
                onClick={() => { setAbierto(false); alElegir(v) }}
              >
                <span>{nombre}</span>
                <small>{formatoCLP(costoEnvio(v))}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CheckoutPage() {
  const [estado, setEstado] = useState({ cargando: true, items: [], total: 0 })
  const [region, setRegion] = useState('RM')
  const [cupon, setCupon] = useState('')
  const [error, setError] = useState(null)
  const [pagando, setPagando] = useState(false)
  const [direccion, setDireccion] = useState(DIRECCION_VACIA)
  const [perfilCompleto, setPerfilCompleto] = useState(false)
  const [guardarEnCuenta, setGuardarEnCuenta] = useState(false)
  const [erroresDir, setErroresDir] = useState({})
  const [cuponAplicado, setCuponAplicado] = useState(null)
  const [errorCupon, setErrorCupon] = useState(null)
  const [validandoCupon, setValidandoCupon] = useState(false)
  const bloqueDireccion = useRef(null)

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

  // Los datos guardados en Mi cuenta rellenan la entrega; si no hay, se ofrece guardarlos
  useEffect(() => {
    let vigente = true
    api.get('cuenta/perfil')
      .then(({ data }) => {
        if (!vigente) return
        if (REGIONES.some(([valor]) => valor === data.region)) setRegion(data.region)
        const nombre = data.direccion.nombre || [data.nombre, data.apellido].filter(Boolean).join(' ')
        const comuna = comunaDeRegion(data.region, data.direccion.comuna) || ''
        setDireccion({ ...DIRECCION_VACIA, ...data.direccion, nombre, comuna })
        setPerfilCompleto(data.completo)
        setGuardarEnCuenta(!data.completo)
      })
      .catch(() => {})
    return () => { vigente = false }
  }, [])

  const { cargando, items, total } = estado
  const envio = costoEnvio(region)
  const descuento = cuponAplicado ? cuponAplicado.descuento : 0
  const totalEstimado = total - descuento + envio
  // Los precios de la tienda ya incluyen IVA: el monto se desglosa, no se suma
  const ivaIncluido = Math.round(totalEstimado - totalEstimado / (1 + TASA_IVA))
  const unidades = items.reduce((suma, i) => suma + i.cantidad, 0)

  const cambiarDireccion = (campo, valor) => {
    setDireccion((previa) => ({ ...previa, [campo]: valor }))
    setErroresDir((previos) => {
      if (!previos[campo]) return previos
      const copia = { ...previos }
      delete copia[campo]
      return copia
    })
  }

  // Si la comuna escrita no existe en la región nueva, se borra para elegir otra
  const cambiarRegion = (nueva) => {
    setRegion(nueva)
    setDireccion((previa) => (comunaDeRegion(nueva, previa.comuna) ? previa : { ...previa, comuna: '' }))
  }

  const cambiarCupon = (texto) => {
    setCupon(texto)
    setErrorCupon(null)
    setCuponAplicado(null)
  }

  const aplicarCupon = async () => {
    if (!cupon.trim()) return
    setErrorCupon(null)
    setValidandoCupon(true)
    try {
      const { data } = await api.post('cupones/validar', { codigo: cupon.trim() })
      setCuponAplicado(data)
    } catch (e) {
      setCuponAplicado(null)
      setErrorCupon(mensajeError(e))
    } finally {
      setValidandoCupon(false)
    }
  }

  const quitarCupon = () => {
    setCupon('')
    setCuponAplicado(null)
    setErrorCupon(null)
  }

  const pagar = async () => {
    setError(null)
    const faltas = validarDireccion(direccion, region)
    if (Object.keys(faltas).length > 0) {
      setErroresDir(faltas)
      bloqueDireccion.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setPagando(true)
    try {
      const { data } = await api.post('webpay/iniciar', {
        items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        region,
        cupon: cuponAplicado ? cuponAplicado.codigo : (cupon.trim() || null),
        direccion,
      })
      if (guardarEnCuenta) await api.post('cuenta/perfil', { region, direccion }).catch(() => {})
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
          <Link to="/catalogo" className="boton">Ver catálogo</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="contenedor">
      <h1 className="checkout-titulo">Finalizar compra</h1>
      <Pasos />

      <div className="carro-layout">
        <div className="checkout-columna">
          <section className="checkout-bloque" style={{ animationDelay: '0ms' }}>
            <h2><span className="bloque-numero">1</span> Entrega</h2>
            <SelectorRegion valor={region} alElegir={cambiarRegion} />
            <p className="checkout-plazo">
              <Icono nombre="tienda" tamano={16} /> Despacho en 5 días hábiles en Santiago y entre 5 y 25 días en regiones.
            </p>

            <h3 className="dir-titulo" ref={bloqueDireccion}>Dirección de entrega</h3>
            <div className="dir-grid">
              <Campo nombre="nombre" etiqueta="Nombre de quien recibe" valor={direccion.nombre} error={erroresDir.nombre} alCambiar={cambiarDireccion} autoComplete="name" maxLength={100} />
              <Campo nombre="telefono" etiqueta="Teléfono de contacto" valor={direccion.telefono} error={erroresDir.telefono} alCambiar={cambiarDireccion} type="tel" placeholder="+56 9 1234 5678" autoComplete="tel" maxLength={30} />
              <Campo nombre="calle" etiqueta="Calle" valor={direccion.calle} error={erroresDir.calle} alCambiar={cambiarDireccion} autoComplete="address-line1" maxLength={150} />
              <Campo nombre="numero" etiqueta="Número" ancho={1} valor={direccion.numero} error={erroresDir.numero} alCambiar={cambiarDireccion} maxLength={20} />
              <Campo nombre="complemento" etiqueta="Depto / casa" ancho={1} opcional valor={direccion.complemento} alCambiar={cambiarDireccion} maxLength={60} />
              <CampoComuna region={region} valor={direccion.comuna} error={erroresDir.comuna} alCambiar={cambiarDireccion} />
              <Campo nombre="indicaciones" etiqueta="Indicaciones para el repartidor" opcional valor={direccion.indicaciones} alCambiar={cambiarDireccion} placeholder="Ej: portón negro, timbre 5" maxLength={255} />
            </div>
            <label className="dir-guardar">
              <input type="checkbox" checked={guardarEnCuenta} onChange={(e) => setGuardarEnCuenta(e.target.checked)} />
              <span>
                {perfilCompleto ? 'Actualizar mis datos guardados con esta dirección' : 'Guardar estos datos en mi cuenta para no escribirlos la próxima vez'}
                {!perfilCompleto && <small> (recomendado, pero no obligatorio)</small>}
              </span>
            </label>
            <p className="dir-cuenta">Puedes ver y editar tus datos guardados en <Link to="/cuenta">Mi cuenta</Link>.</p>
          </section>

          <section className="checkout-bloque" style={{ animationDelay: '90ms' }}>
            <h2><span className="bloque-numero">2</span> Cupón de descuento</h2>
            {cuponAplicado ? (
              <div className="cupon-aplicado" role="status">
                <span className="cupon-check"><Icono nombre="check" tamano={18} /></span>
                <span className="cupon-texto">
                  <strong>{cuponAplicado.codigo} aplicado</strong>
                  <small>{cuponAplicado.porcentaje}% de descuento en productos: -{formatoCLP(cuponAplicado.descuento)}</small>
                </span>
                <button type="button" className="cupon-quitar" onClick={quitarCupon}>Quitar</button>
              </div>
            ) : (
              <form className={errorCupon ? 'cupon con-error' : 'cupon'} onSubmit={(e) => { e.preventDefault(); aplicarCupon() }}>
                <Icono nombre="estrella" tamano={18} />
                <input value={cupon} onChange={(e) => cambiarCupon(e.target.value)} placeholder="Ej: PIXEL10 (opcional)" aria-label="Cupón de descuento" />
                <button type="submit" className="cupon-aplicar" disabled={!cupon.trim() || validandoCupon}>
                  {validandoCupon ? 'Validando...' : 'Aplicar'}
                </button>
              </form>
            )}
            {errorCupon && <p className="cupon-error" role="alert"><Icono nombre="alerta" tamano={15} /> {errorCupon}</p>}
            <p className="checkout-plazo">Cada cupón tiene vencimiento y límites de uso; se vuelve a validar al pagar.</p>
          </section>

          <section className="checkout-bloque" style={{ animationDelay: '180ms' }}>
            <div className="bloque-cabecera">
              <h2><span className="bloque-numero">3</span> Tu pedido</h2>
              <Link to="/carrito" className="bloque-editar">Editar carrito</Link>
            </div>
            <ul className="pedido-lista">
              {items.map((i) => (
                <li key={i.item_id} className="pedido-item">
                  <span className="pedido-foto">
                    {i.imagen ? <img src={i.imagen} alt="" /> : <span className="nota">-</span>}
                  </span>
                  <span className="pedido-nombre">
                    <strong>{i.nombre}</strong>
                    <small>{formatoCLP(i.precio)} c/u</small>
                  </span>
                  <span className="pedido-cantidad">x{i.cantidad}</span>
                  <span className="pedido-subtotal">{formatoCLP(i.subtotal)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="carro-resumen">
          <h2>Resumen</h2>
          <div className="carro-fila"><span>Productos ({unidades})</span><strong><Monto valor={total} /></strong></div>
          <div className="carro-fila"><span>Envío</span><strong><Monto valor={envio} /></strong></div>
          {cuponAplicado ? (
            <div className="carro-fila carro-descuento"><span>Cupón {cuponAplicado.codigo} (-{cuponAplicado.porcentaje}%)</span><strong>-<Monto valor={descuento} /></strong></div>
          ) : (
            <div className="carro-fila"><span>Cupón</span><span className="carro-nota">sin cupón</span></div>
          )}
          <div className="carro-fila carro-total"><span>Total estimado</span><strong><Monto valor={totalEstimado} /></strong></div>
          <div className="carro-fila carro-iva"><span>Incluye IVA (19%)</span><span><Monto valor={ivaIncluido} /></span></div>

          {error && <div className="aviso error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="carro-pagar" onClick={pagar} disabled={pagando}>
            <Icono nombre="candado" tamano={18} />
            {pagando ? 'Redirigiendo a Webpay...' : 'Pagar con Webpay'}
            {!pagando && <Icono nombre="flecha" tamano={18} />}
          </button>
          <ul className="carro-garantias">
            <li><Icono nombre="candado" tamano={16} /> Pago seguro con tarjeta a través de Webpay</li>
            <li><Icono nombre="check" tamano={16} /> Todos los precios de la tienda incluyen IVA</li>
            <li><Icono nombre="camion" tamano={16} /> Despacho a todo Chile</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}

export default CheckoutPage
