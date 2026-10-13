import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icono from '../components/Icono'

export function Modal({ titulo, alCerrar, children, ancho = 560 }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') alCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [alCerrar])

  // En el body: así ningún contenedor con animación o transformación altera su posición
  return createPortal(
    <div className="adm-modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar() }}>
      <div className="adm-modal" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button type="button" className="adm-icono-boton" onClick={alCerrar} aria-label="Cerrar"><Icono nombre="cerrar" tamano={18} /></button>
        </header>
        <div className="adm-modal-cuerpo">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Cargando({ texto = 'Cargando...' }) {
  return <div className="adm-cargando"><span className="adm-spinner" />{texto}</div>
}

export function ErrorCaja({ texto, alReintentar }) {
  return (
    <div className="adm-error">
      <Icono nombre="alerta" tamano={20} /> {texto}
      {alReintentar && <button type="button" onClick={alReintentar}>Reintentar</button>}
    </div>
  )
}

export function Vacio({ texto }) {
  return <p className="adm-vacio">{texto}</p>
}

export function Tarjeta({ titulo, acciones, children, className = '' }) {
  return (
    <section className={`adm-tarjeta ${className}`}>
      {(titulo || acciones) && (
        <header>
          {titulo && <h2>{titulo}</h2>}
          {acciones && <div className="adm-acciones">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Chip({ tono = 'neutro', children }) {
  return <span className={`adm-chip ${tono}`}>{children}</span>
}

export function Campo({ etiqueta, children, ayuda }) {
  return (
    <label className="adm-campo">
      <span>{etiqueta}</span>
      {children}
      {ayuda && <small>{ayuda}</small>}
    </label>
  )
}
