import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { mensajeError } from '../api'
import ProductCard from '../components/ProductCard'

function HomePage() {
  const [parametros] = useSearchParams()
  const q = parametros.get('q') || ''
  const categoria = parametros.get('categoria') || ''
  const [estado, setEstado] = useState({ cargando: true, productos: [], error: null })

  useEffect(() => {
    let vigente = true
    api.get('productos/listar', { params: { q: q || undefined, categoria: categoria || undefined } })
      .then(({ data }) => {
        if (vigente) setEstado({ cargando: false, productos: data.productos, error: null })
      })
      .catch((error) => {
        if (vigente) setEstado({ cargando: false, productos: [], error: mensajeError(error) })
      })
    return () => { vigente = false }
  }, [q, categoria])

  const { cargando, productos, error } = estado

  return (
    <div className="contenedor">
      <h2>{q ? `Resultados para "${q}"` : 'Catálogo'}</h2>
      {cargando && <p className="vacio">Cargando productos...</p>}
      {error && <div className="aviso error">{error}</div>}
      {!cargando && !error && productos.length === 0 && (
        <p className="vacio">No encontramos productos con ese filtro.</p>
      )}
      <div className="cuadricula">
        {productos.map((producto) => (
          <ProductCard key={producto.id} producto={producto} />
        ))}
      </div>
    </div>
  )
}

export default HomePage
