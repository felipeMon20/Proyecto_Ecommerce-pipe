import { Link } from 'react-router-dom'
import PixelArt from '../components/PixelArt'

// La tienda sin señal: el personaje intenta enchufarla y el rótulo solo parpadea al hacer contacto
function NoEncontradaPage() {
  return (
    <div className="contenedor">
      <div className="nf">
        <div className="nf-escena" aria-hidden="true">
          <div className="nf-local">
            <img src="/logo.png" alt="" className="nf-rotulo" />
            <PixelArt nombre="tienda" tamano={224} />
            <span className="nf-toma"><i /><i /></span>
          </div>
          <div className="escena-suelo" />
          <div className="nf-actor">
            <span className="nf-persona">
              <PixelArt nombre="persona_emp1" tamano={100} className="nf-paso nf-paso-1" />
              <PixelArt nombre="persona_emp2" tamano={100} className="nf-paso nf-paso-2" />
            </span>
            <svg className="nf-cable" viewBox="0 0 90 40" width="90" height="40">
              <path d="M0 8 C 20 36, 40 -6, 72 18" fill="none" stroke="#19d3e6" strokeWidth="4" strokeLinecap="round" />
              <rect x="70" y="11" width="14" height="14" rx="2" fill="#ffd95a" />
              <rect x="84" y="14" width="6" height="3" fill="#e8e0f0" />
              <rect x="84" y="19" width="6" height="3" fill="#e8e0f0" />
            </svg>
          </div>
          <span className="nf-chispa nf-chispa-1" />
          <span className="nf-chispa nf-chispa-2" />
          <span className="nf-chispa nf-chispa-3" />
        </div>

        <h1 className="nf-codigo">404</h1>
        <h2>Se cortó la conexión</h2>
        <p>
          La página que buscas no existe o cambió de lugar. Mientras tanto estamos intentando reconectar
          <span className="nf-puntos" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
        </p>
        <div className="nf-acciones">
          <Link to="/" className="boton amarillo boton-mas">Ir al inicio</Link>
          <Link to="/catalogo" className="pago-secundario">Ver el catálogo</Link>
        </div>
      </div>
    </div>
  )
}

export default NoEncontradaPage
