import { ETIQUETAS_FORTALEZA, fortalezaClave } from '../reglasClave'
import Icono from './Icono'

// Lista de indicaciones que se van marcando a medida que la contraseña cumple cada una
function ReglasClave({ reglas, clave }) {
  const cumplidas = reglas.filter((r) => r.ok).length
  const nivel = fortalezaClave(clave, reglas)

  return (
    <div className="reglas" aria-live="polite">
      <div className="reglas-cabecera">
        <strong>Debe cumplir</strong>
        <span>{cumplidas} de {reglas.length}</span>
      </div>
      <ul>
        {reglas.map((r) => (
          <li key={r.id} className={r.ok ? 'ok' : ''}>
            <span className="reglas-marca">{r.ok && <Icono nombre="check" tamano={12} />}</span>
            {r.texto}
          </li>
        ))}
      </ul>
      <div className={`reglas-fuerza nivel-${nivel}`}>
        <span className="reglas-barra">
          {[1, 2, 3, 4].map((n) => <i key={n} className={n <= nivel ? 'on' : ''} />)}
        </span>
        <small>{nivel ? `Seguridad: ${ETIQUETAS_FORTALEZA[nivel]}` : 'Escribe una contraseña para ver su seguridad'}</small>
      </div>
    </div>
  )
}

export default ReglasClave
