import { useState } from 'react'
import { COMUNAS, comunaDeRegion, normalizarComuna } from '../comunas'

// Buscador de comunas de la región elegida: se escribe para filtrar y se elige de la lista
function CampoComuna({ region, valor, alCambiar, error = null, ancho = 2 }) {
  const [texto, setTexto] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(0)

  const lista = COMUNAS[region] || []
  const mostrado = texto ?? valor
  const filtro = normalizarComuna(texto ?? '')
  const coincidencias = filtro ? lista.filter((c) => normalizarComuna(c).includes(filtro)) : lista
  // Primero las que empiezan con lo escrito, luego las que lo contienen
  const opciones = filtro
    ? [...coincidencias.filter((c) => normalizarComuna(c).startsWith(filtro)), ...coincidencias.filter((c) => !normalizarComuna(c).startsWith(filtro))]
    : lista

  const elegir = (comuna) => {
    alCambiar('comuna', comuna)
    setTexto(null)
    setAbierto(false)
  }

  // Al salir se queda con la comuna escrita si existe (aunque falten tildes); si no, vuelve a la elegida antes
  const cerrar = () => {
    if (texto !== null) {
      const exacta = comunaDeRegion(region, texto)
      if (exacta) alCambiar('comuna', exacta)
      else if (texto.trim() === '') alCambiar('comuna', '')
    }
    setTexto(null)
    setAbierto(false)
  }

  const teclas = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAbierto(true)
      setActiva((i) => Math.min(i + 1, opciones.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiva((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && abierto && opciones[activa]) {
      e.preventDefault()
      elegir(opciones[activa])
    } else if (e.key === 'Escape') {
      setTexto(null)
      setAbierto(false)
    }
  }

  return (
    <label className={`dir-campo dir-${ancho} comuna-campo${error ? ' con-error' : ''}`}>
      <span>Comuna <small>({lista.length} en esta región)</small></span>
      <input
        value={mostrado}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActiva(0) }}
        onFocus={() => setAbierto(true)}
        onBlur={cerrar}
        onKeyDown={teclas}
        placeholder="Escribe para buscar tu comuna"
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        maxLength={80}
      />
      {abierto && (
        <ul className="comuna-lista" role="listbox">
          {opciones.length === 0 && <li className="comuna-vacia">No hay comunas que coincidan en esta región</li>}
          {opciones.map((comuna, i) => (
            <li
              key={comuna}
              role="option"
              aria-selected={comuna === valor}
              className={`${i === activa ? 'activa' : ''}${comuna === valor ? ' elegida' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); elegir(comuna) }}
              onMouseEnter={() => setActiva(i)}
            >
              {comuna}
            </li>
          ))}
        </ul>
      )}
      {error && <em>{error}</em>}
    </label>
  )
}

export default CampoComuna
