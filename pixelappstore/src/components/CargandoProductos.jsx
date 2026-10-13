const COLORES = ['var(--morado)', 'var(--cian)', 'var(--amarillo)', 'var(--rosa)']

function CargandoProductos({ tarjetas = 8, clase = 'cuadricula-catalogo' }) {
  return (
    <div className="cargando" role="status" aria-live="polite">
      <div className="cargando-cabecera">
        <div className="pixeles-carga" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ background: COLORES[i % COLORES.length], animationDelay: `${(i % 3 + Math.floor(i / 3)) * 0.12}s` }} />
          ))}
        </div>
        <div>
          <strong>Cargando productos</strong>
          <small>Buscando la mejor tecnología para tu setup</small>
        </div>
      </div>
      <div className={`cuadricula ${clase}`} aria-hidden="true">
        {Array.from({ length: tarjetas }, (_, i) => (
          <div key={i} className="esqueleto-card" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="esqueleto-imagen" />
            <div className="esqueleto-linea corta" />
            <div className="esqueleto-linea" />
            <div className="esqueleto-linea precio" />
            <div className="esqueleto-boton" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default CargandoProductos
