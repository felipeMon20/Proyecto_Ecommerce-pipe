import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { mensajeError, PASIVO } from '../api'
import useRefrescoPeriodico from '../useRefrescoPeriodico'
import ProductCard from '../components/ProductCard'
import Icono from '../components/Icono'
import useCerrarAlExterior from '../useCerrarAlExterior'
import CargandoProductos from '../components/CargandoProductos'
import { GRUPOS_CATEGORIAS } from '../iconosCategoria'

const POR_PAGINA = 20

const ORDENES = [
  { id: 'relevancia', nombre: 'Más recientes' },
  { id: 'precio-asc', nombre: 'Menor precio' },
  { id: 'precio-desc', nombre: 'Mayor precio' },
  { id: 'nombre', nombre: 'Nombre A-Z' },
  { id: 'valorados', nombre: 'Mejor valorados' },
]

function leerFiltros(parametros) {
  const numero = (clave) => {
    const valor = parseInt(parametros.get(clave), 10)
    return Number.isNaN(valor) ? null : valor
  }
  return {
    q: parametros.get('q') || '',
    categoria: parametros.get('categoria') || '',
    grupo: parametros.get('grupo') || '',
    marcas: (parametros.get('marcas') || '').split('|').filter(Boolean),
    min: numero('min'),
    max: numero('max'),
    agotados: parametros.get('agotados') === null ? Boolean(parametros.get('q')) : parametros.get('agotados') === '1',
    orden: parametros.get('orden') || 'relevancia',
    pagina: Math.max(1, numero('pagina') || 1),
  }
}

// omitir permite calcular los contadores de un filtro sin aplicarlo a sí mismo
function filtrar(productos, filtros, omitir = '') {
  return productos.filter((p) => {
    if (omitir !== 'categoria' && filtros.seleccion.length > 0 && !filtros.seleccion.includes(String(p.categoria_id))) return false
    if (omitir !== 'marcas' && filtros.marcas.length > 0 && !filtros.marcas.includes(p.marca)) return false
    if (omitir !== 'precio') {
      if (filtros.min !== null && p.precio < filtros.min) return false
      if (filtros.max !== null && p.precio > filtros.max) return false
    }
    if (omitir !== 'agotados' && !filtros.agotados && p.stock <= 0) return false
    return true
  })
}

function contar(productos, clave) {
  const cuenta = new Map()
  productos.forEach((p) => {
    const valor = p[clave]
    if (valor === null || valor === undefined || valor === '') return
    cuenta.set(valor, (cuenta.get(valor) || 0) + 1)
  })
  return cuenta
}

function ordenar(productos, orden) {
  const copia = [...productos]
  if (orden === 'precio-asc') copia.sort((a, b) => a.precio - b.precio)
  else if (orden === 'precio-desc') copia.sort((a, b) => b.precio - a.precio)
  else if (orden === 'nombre') copia.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  else if (orden === 'valorados') copia.sort((a, b) => b.calificacion_promedio - a.calificacion_promedio || b.total_reviews - a.total_reviews)
  else copia.sort((a, b) => b.id - a.id)
  return copia
}

function SelectorOrden({ valor, alElegir }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCerrarAlExterior(abierto, () => setAbierto(false))
  const actual = ORDENES.find((o) => o.id === valor) || ORDENES[0]

  return (
    <div className="orden" ref={ref}>
      <button className="orden-boton" onClick={() => setAbierto(!abierto)} aria-haspopup="listbox" aria-expanded={abierto}>
        <span className="orden-etiqueta">Ordenar por</span>
        <strong>{actual.nombre}</strong>
        <span className={abierto ? 'chevron-giro abierto' : 'chevron-giro'}><Icono nombre="chevron" tamano={14} /></span>
      </button>
      {abierto && (
        <ul className="orden-lista" role="listbox">
          {ORDENES.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === actual.id}>
              <button
                className={o.id === actual.id ? 'activa' : ''}
                onClick={() => { setAbierto(false); alElegir(o.id) }}
              >
                <span>{o.nombre}</span>
                {o.id === actual.id && <Icono nombre="check" tamano={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FiltroPrecio({ min, max, alAplicar }) {
  const [desde, setDesde] = useState(min === null ? '' : String(min))
  const [hasta, setHasta] = useState(max === null ? '' : String(max))

  const aplicar = (evento) => {
    evento.preventDefault()
    alAplicar(desde === '' ? null : parseInt(desde, 10), hasta === '' ? null : parseInt(hasta, 10))
  }

  return (
    <form className="filtro-precio" onSubmit={aplicar}>
      <input type="number" min="0" placeholder="Mínimo" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Precio mínimo" />
      <span>a</span>
      <input type="number" min="0" placeholder="Máximo" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Precio máximo" />
      <button type="submit" aria-label="Aplicar precio"><Icono nombre="flecha" tamano={16} /></button>
    </form>
  )
}

function Paginacion({ pagina, total, alCambiar }) {
  if (total <= 1) return null

  const visibles = []
  for (let n = 1; n <= total; n += 1) {
    if (n === 1 || n === total || Math.abs(n - pagina) <= 1) visibles.push(n)
    else if (visibles[visibles.length - 1] !== '...') visibles.push('...')
  }

  return (
    <nav className="paginacion" aria-label="Páginas del catálogo">
      <button disabled={pagina === 1} onClick={() => alCambiar(pagina - 1)}>Anterior</button>
      {visibles.map((n, i) => (n === '...' ? (
        <span key={`p${i}`} className="paginacion-puntos">...</span>
      ) : (
        <button key={n} className={n === pagina ? 'activa' : ''} onClick={() => alCambiar(n)} aria-current={n === pagina ? 'page' : undefined}>
          {n}
        </button>
      )))}
      <button disabled={pagina === total} onClick={() => alCambiar(pagina + 1)}>Siguiente</button>
    </nav>
  )
}

function HomePage() {
  const [parametros, setParametros] = useSearchParams()
  const filtrosUrl = leerFiltros(parametros)
  const [estado, setEstado] = useState({ cargando: true, productos: [], error: null })
  const [panelAbierto, setPanelAbierto] = useState(false)

  const consulta = parametros.get('q') || ''

  const cargar = useCallback((silencioso) => api.get('productos/listar', { params: { q: consulta || undefined }, ...(silencioso ? PASIVO : {}) })
    .then(({ data }) => {
      setEstado({ cargando: false, productos: data.productos, error: null })
    })
    .catch((error) => {
      if (!silencioso) setEstado({ cargando: false, productos: [], error: mensajeError(error) })
    }), [consulta])

  useEffect(() => {
    cargar(false)
  }, [cargar])

  useRefrescoPeriodico(() => cargar(true))

  const { cargando, productos, error } = estado

  const grupoActivo = GRUPOS_CATEGORIAS.find((g) => g.id === filtrosUrl.grupo)
  const idsDelGrupo = grupoActivo
    ? [...new Set(productos.filter((p) => grupoActivo.nombres.includes(p.categoria)).map((p) => String(p.categoria_id)))]
    : []
  const filtros = { ...filtrosUrl, seleccion: filtrosUrl.categoria ? [filtrosUrl.categoria] : idsDelGrupo }

  const cambiar = (cambios, reiniciarPagina = true) => {
    const siguiente = new URLSearchParams(parametros)
    Object.entries(cambios).forEach(([clave, valor]) => {
      if (valor === null || valor === '' || valor === undefined) siguiente.delete(clave)
      else siguiente.set(clave, String(valor))
    })
    if (reiniciarPagina) siguiente.delete('pagina')
    setParametros(siguiente)
  }

  const cambiarPagina = (n) => {
    cambiar({ pagina: n > 1 ? n : null }, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const alternarMarca = (marca) => {
    const nuevas = filtros.marcas.includes(marca)
      ? filtros.marcas.filter((m) => m !== marca)
      : [...filtros.marcas, marca]
    cambiar({ marcas: nuevas.join('|') })
  }

  const limpiar = () => {
    const siguiente = new URLSearchParams()
    if (filtros.q) siguiente.set('q', filtros.q)
    setParametros(siguiente)
  }

  const categorias = (() => {
    const nombres = new Map()
    productos.forEach((p) => { if (p.categoria_id) nombres.set(p.categoria_id, p.categoria) })
    const cuenta = contar(filtrar(productos, filtros, 'categoria'), 'categoria_id')
    return [...nombres]
      .map(([id, nombre]) => ({ id: String(id), nombre, total: cuenta.get(id) || 0 }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  })()

  const marcas = (() => {
    const cuenta = contar(filtrar(productos, filtros, 'marcas'), 'marca')
    const todas = new Set(productos.map((p) => p.marca).filter(Boolean))
    return [...todas]
      .map((nombre) => ({ nombre, total: cuenta.get(nombre) || 0 }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
  })()

  const resultado = ordenar(filtrar(productos, filtros), filtros.orden)
  const totalPaginas = Math.max(1, Math.ceil(resultado.length / POR_PAGINA))
  const pagina = Math.min(filtros.pagina, totalPaginas)
  const visibles = resultado.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const hayFiltros = Boolean(filtros.categoria || filtros.grupo || filtros.marcas.length || filtros.min !== null || filtros.max !== null)
  const desde = resultado.length === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const hasta = Math.min(pagina * POR_PAGINA, resultado.length)

  return (
    <div className="contenedor">
      <h2 className="catalogo-titulo">{filtros.q ? `Resultados para "${filtros.q}"` : grupoActivo ? grupoActivo.titulo : 'Catálogo'}</h2>

      <div className="catalogo">
        <button className="filtros-abrir" onClick={() => setPanelAbierto(!panelAbierto)} aria-expanded={panelAbierto}>
          {panelAbierto ? 'Ocultar filtros' : 'Mostrar filtros'}
        </button>

        <aside className={panelAbierto ? 'filtros abierto' : 'filtros'}>
          <div className="filtros-cabecera">
            <strong>Filtros</strong>
            {hayFiltros && <button className="filtros-limpiar" onClick={limpiar}>Limpiar</button>}
          </div>

          <section className="filtro-grupo">
            <h3>Categoría</h3>
            <ul className="filtro-lista">
              <li>
                <button className={filtros.seleccion.length === 0 ? 'activa' : ''} onClick={() => cambiar({ categoria: null, grupo: null })}>
                  <span>Todas</span>
                </button>
              </li>
              {categorias.map((c) => (
                <li key={c.id}>
                  <button
                    className={filtros.seleccion.includes(c.id) ? 'activa' : ''}
                    onClick={() => cambiar({ categoria: c.id, grupo: null })}
                    disabled={c.total === 0 && !filtros.seleccion.includes(c.id)}
                  >
                    <span>{c.nombre}</span>
                    <small>{c.total}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="filtro-grupo">
            <h3>Precio</h3>
            <FiltroPrecio
              key={`${filtros.min}-${filtros.max}`}
              min={filtros.min}
              max={filtros.max}
              alAplicar={(min, max) => cambiar({ min, max })}
            />
          </section>

          <section className="filtro-grupo">
            <h3>Marca</h3>
            <ul className="filtro-lista con-scroll">
              {marcas.map((m) => (
                <li key={m.nombre}>
                  <label className={m.total === 0 && !filtros.marcas.includes(m.nombre) ? 'apagada' : ''}>
                    <input
                      type="checkbox"
                      checked={filtros.marcas.includes(m.nombre)}
                      onChange={() => alternarMarca(m.nombre)}
                    />
                    <span>{m.nombre}</span>
                    <small>{m.total}</small>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="filtro-grupo">
            <label className="filtro-interruptor">
              <input type="checkbox" checked={filtros.agotados} onChange={() => cambiar({ agotados: filtros.agotados ? '0' : '1' })} />
              <span>Mostrar agotados</span>
            </label>
          </section>
        </aside>

        <div className="catalogo-resultados">
          <div className="catalogo-barra">
            <span className="catalogo-conteo">
              {cargando ? 'Cargando...' : resultado.length === 0 ? '0 productos' : `${desde}-${hasta} de ${resultado.length} productos`}
            </span>
            <SelectorOrden valor={filtros.orden} alElegir={(id) => cambiar({ orden: id === 'relevancia' ? null : id })} />
          </div>

          {error && <div className="aviso error">{error}</div>}
          {!cargando && !error && resultado.length === 0 && (
            <div className="vacio">
              <p>No encontramos productos con esos filtros.</p>
              {hayFiltros && <button className="boton secundario" onClick={limpiar}>Limpiar filtros</button>}
            </div>
          )}

          {cargando && <CargandoProductos tarjetas={8} />}

          <div className="cuadricula cuadricula-catalogo">
            {visibles.map((producto) => (
              <ProductCard key={producto.id} producto={producto} />
            ))}
          </div>

          <Paginacion pagina={pagina} total={totalPaginas} alCambiar={cambiarPagina} />
        </div>
      </div>
    </div>
  )
}

export default HomePage
