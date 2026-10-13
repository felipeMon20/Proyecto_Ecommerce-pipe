import { useEffect, useState } from 'react'
import PixelArt from './PixelArt'

const RADIO = 46
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

const TEXTOS = {
  ip: {
    titulo: '¡Vas muy rápido!',
    texto: 'Detectamos muchas recargas seguidas. Para cuidar la tienda y que todos puedan comprar, espera unos segundos.',
  },
  global: {
    titulo: 'Hay mucha gente en la tienda',
    texto: 'Estamos recibiendo muchas visitas al mismo tiempo. Haz fila con nosotros: en unos segundos podrás entrar.',
  },
}

function Persona({ demora }) {
  return (
    <span className="sat-persona" style={{ animationDelay: demora }}>
      <PixelArt nombre="persona_cam1" tamano={62} className="nf-paso nf-paso-1" />
      <PixelArt nombre="persona_cam2" tamano={62} className="nf-paso nf-paso-2" />
    </span>
  )
}

// Pantalla de espera: aparece cuando el servidor pide frenar (recargas seguidas o demasiada gente a la vez)
function Saturacion() {
  const [espera, setEspera] = useState(null)

  useEffect(() => {
    const alSaturar = (evento) => {
      const segundos = Math.max(Number(evento.detail?.espera) || 10, 1)
      setEspera((previa) => previa || { total: segundos, restan: segundos, motivo: evento.detail?.motivo === 'global' ? 'global' : 'ip' })
    }
    window.addEventListener('saturacion', alSaturar)
    return () => window.removeEventListener('saturacion', alSaturar)
  }, [])

  const activa = espera !== null
  const listo = activa && espera.restan <= 0

  useEffect(() => {
    if (!activa || listo) return undefined
    const reloj = setInterval(() => {
      setEspera((previa) => (previa ? { ...previa, restan: previa.restan - 1 } : previa))
    }, 1000)
    return () => clearInterval(reloj)
  }, [activa, listo])

  useEffect(() => {
    if (!activa) return undefined
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = anterior }
  }, [activa])

  if (!activa) return null

  const textos = TEXTOS[espera.motivo]
  const avance = Math.max(espera.restan, 0) / espera.total

  return (
    <div className="sat" role="alertdialog" aria-modal="true" aria-labelledby="sat-titulo">
      <div className="sat-tarjeta">
        <div className="sat-escena" aria-hidden="true">
          <div className="sat-fila">
            <Persona demora="0s" />
            <Persona demora="0.25s" />
            <Persona demora="0.5s" />
          </div>
          <PixelArt nombre="tienda" tamano={150} className="sat-tienda" />
          <div className="escena-suelo" />
        </div>

        <div className="sat-reloj" role="timer" aria-live="off">
          <svg viewBox="0 0 110 110" width="110" height="110">
            <circle cx="55" cy="55" r={RADIO} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
            <circle
              cx="55"
              cy="55"
              r={RADIO}
              fill="none"
              stroke="#ffd95a"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - avance)}
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span>{Math.max(espera.restan, 0)}</span>
        </div>

        <h1 id="sat-titulo">{textos.titulo}</h1>
        <p>{textos.texto}</p>
        <p className="sat-nota">No necesitas recargar: cuando termine la cuenta regresiva podrás continuar.</p>
        <button type="button" className="boton amarillo boton-mas" disabled={!listo} onClick={() => window.location.reload()}>
          {listo ? 'Entrar a la tienda' : 'Espera un momento...'}
        </button>
      </div>
    </div>
  )
}

export default Saturacion
