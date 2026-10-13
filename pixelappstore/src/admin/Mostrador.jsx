import { useState } from 'react'
import api, { formatoCLP, mensajeError } from '../api'
import Icono from '../components/Icono'
import { useDatos, usePanel } from './contexto'
import { Cargando, ErrorCaja, Tarjeta, Vacio } from './ui'
import { normalizar } from './utils'

function Mostrador() {
  const { avisar } = usePanel()
  const { datos, cargando, error, recargar } = useDatos(() => api.get('panel/productos').then((r) => r.data.productos))
  const [busqueda, setBusqueda] = useState('')
  const [carro, setCarro] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)

  if (cargando) return <Cargando />
  if (error) return <ErrorCaja texto={error} alReintentar={recargar} />

  const porId = Object.fromEntries(datos.map((p) => [p.id, p]))
  const texto = normalizar(busqueda)
  const resultados = datos
    .filter((p) => p.stock > 0 && (!texto || normalizar(`${p.nombre} ${p.codigo} ${p.marca}`).includes(texto)))
    .slice(0, 30)

  const lineas = Object.entries(carro).map(([id, cantidad]) => ({ producto: porId[id], cantidad })).filter((l) => l.producto)
  const total = lineas.reduce((suma, l) => suma + l.producto.precio * l.cantidad, 0)

  const cambiar = (producto, delta) => {
    setAviso(null)
    setCarro((previo) => {
      const nueva = (previo[producto.id] || 0) + delta
      const copia = { ...previo }
      if (nueva <= 0) delete copia[producto.id]
      else copia[producto.id] = Math.min(nueva, producto.stock)
      return copia
    })
  }

  const registrar = async () => {
    setAviso(null)
    setEnviando(true)
    try {
      const { data } = await api.post('ventas/registrar', {
        items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
      })
      avisar('ok', `Venta #${data.id_venta} registrada por ${formatoCLP(data.total_pagado)}`)
      setCarro({})
      recargar()
    } catch (e) {
      setAviso(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="adm-pagina adm-pos">
      <Tarjeta titulo="Productos disponibles">
        <label className="adm-buscador">
          <Icono nombre="lupa" tamano={16} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, código o marca" autoFocus />
        </label>
        {resultados.length === 0 ? <Vacio texto="No hay productos con stock que coincidan." /> : (
          <ul className="adm-pos-lista">
            {resultados.map((p) => (
              <li key={p.id}>
                <span className="adm-miniatura">{p.imagenes[0] ? <img src={p.imagenes[0].url} alt="" /> : <Icono nombre="caja" tamano={18} />}</span>
                <span className="adm-pos-nombre"><strong>{p.nombre}</strong><small>{p.codigo} · {p.stock} en stock</small></span>
                <span className="adm-pos-precio">{formatoCLP(p.precio)}</span>
                <button type="button" className="adm-icono-boton relleno" onClick={() => cambiar(p, 1)} aria-label={`Agregar ${p.nombre}`}><Icono nombre="mas" tamano={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Venta actual" className="adm-pos-caja">
        {lineas.length === 0 ? <Vacio texto="Agrega productos para armar la venta." /> : (
          <ul className="adm-pos-carro">
            {lineas.map((l) => (
              <li key={l.producto.id}>
                <span className="adm-pos-nombre"><strong>{l.producto.nombre}</strong><small>{formatoCLP(l.producto.precio)} c/u</small></span>
                <span className="adm-cantidad">
                  <button type="button" onClick={() => cambiar(l.producto, -1)} aria-label="Restar"><Icono nombre="menos" tamano={14} /></button>
                  <b>{l.cantidad}</b>
                  <button type="button" onClick={() => cambiar(l.producto, 1)} disabled={l.cantidad >= l.producto.stock} aria-label="Sumar"><Icono nombre="mas" tamano={14} /></button>
                </span>
                <strong className="adm-pos-sub">{formatoCLP(l.producto.precio * l.cantidad)}</strong>
              </li>
            ))}
          </ul>
        )}
        <div className="adm-pos-total"><span>Total</span><strong>{formatoCLP(total)}</strong></div>
        {aviso && <div className="adm-aviso error" role="alert">{aviso}</div>}
        <p className="adm-nota">Se registra como pagada al instante y descuenta el stock. Queda anotada a tu nombre.</p>
        <button type="button" className="adm-boton grande" onClick={registrar} disabled={enviando || lineas.length === 0}>
          <Icono nombre="registradora" tamano={18} /> {enviando ? 'Registrando...' : 'Registrar venta'}
        </button>
        {lineas.length > 0 && <button type="button" className="adm-boton secundario" onClick={() => setCarro({})}>Vaciar</button>}
      </Tarjeta>
    </div>
  )
}

export default Mostrador
