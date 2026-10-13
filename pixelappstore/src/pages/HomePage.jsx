import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

function HomePage() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // 1. Pedimos los datos a Django
    axios.get('http://127.0.0.1:8000/productos/listar')
      .then(response => {
        setProductos(response.data.productos)
        setCargando(false)
      })
      .catch(error => {
        console.error("Error cargando productos:", error)
        setCargando(false)
      })
  }, [])

  if (cargando) return <div style={{textAlign: 'center', marginTop: '50px'}}>Cargando catálogo... ⏳</div>

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>🔥 Últimos Lanzamientos</h2>
      
      {/* GRILLA DE PRODUCTOS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
        gap: '25px',
        padding: '0 20px'
      }}>
        {productos.map(prod => (
          <div key={prod.id} style={{ 
            border: '1px solid #eee', 
            borderRadius: '10px', 
            padding: '15px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.05)',
            transition: 'transform 0.2s',
            background: 'white'
          }}>
            
            {/* Imagen del Producto */}
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
              {prod.imagenes.length > 0 ? (
                <img 
                  src={`http://127.0.0.1:8000${prod.imagenes[0]}`} 
                  alt={prod.nombre} 
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{color: '#ccc'}}>Sin imagen</span>
              )}
            </div>

            {/* Info del Producto */}
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 10px 0', color: '#333' }}>{prod.nombre}</h3>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#27ae60', margin: '0 0 10px 0' }}>
              ${prod.precio.toLocaleString('es-CL')}
            </p>

            {/* Botón Ver Detalle (Nos llevará a ProductPage) */}
            <Link to={`/producto/${prod.id}`} style={{
              display: 'block',
              width: '100%',
              padding: '10px 0',
              background: '#3498db',
              color: 'white',
              textAlign: 'center',
              textDecoration: 'none',
              borderRadius: '5px',
              fontWeight: 'bold'
            }}>
              Ver Detalle 👁️
            </Link>

          </div>
        ))}
      </div>
    </div>
  )
}

export default HomePage