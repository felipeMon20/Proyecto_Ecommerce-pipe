import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icono from '../components/Icono'
import { PanelContext } from './contexto'
import Auditoria from './Auditoria'
import Cupones from './Cupones'
import Finanzas from './Finanzas'
import Mostrador from './Mostrador'
import Productos from './Productos'
import Resumen from './Resumen'
import Usuarios from './Usuarios'
import Ventas from './Ventas'
import './admin.css'

const SECCIONES = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'panel', vista: Resumen },
  { id: 'productos', etiqueta: 'Productos', icono: 'caja', vista: Productos },
  { id: 'ventas', etiqueta: 'Ventas', icono: 'recibo', vista: Ventas },
  { id: 'mostrador', etiqueta: 'Venta en mostrador', icono: 'registradora', vista: Mostrador },
  { id: 'finanzas', etiqueta: 'Finanzas', icono: 'billetera', vista: Finanzas },
  { id: 'cupones', etiqueta: 'Cupones', icono: 'etiqueta', vista: Cupones, soloJefe: true },
  { id: 'usuarios', etiqueta: 'Usuarios', icono: 'equipo', vista: Usuarios, soloJefe: true },
  { id: 'auditoria', etiqueta: 'Actividad', icono: 'escudo', vista: Auditoria, soloJefe: true },
]

// Panel de administración: se carga solo cuando el servidor confirma que la dirección y la sesión son de staff
function AdminApp({ acceso }) {
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [aviso, setAviso] = useState(null)

  const base = `/${acceso.ruta}`
  const id = pathname.slice(base.length).split('/').filter(Boolean)[0] || 'resumen'
  const seccion = SECCIONES.find((s) => s.id === id)
  const visibles = SECCIONES.filter((s) => !s.soloJefe || acceso.superusuario)
  const permitida = seccion && (!seccion.soloJefe || acceso.superusuario)
  const Vista = permitida ? seccion.vista : null

  const avisar = useCallback((tipo, texto) => setAviso({ tipo, texto, clave: Date.now() }), [])

  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), 4500)
    return () => clearTimeout(t)
  }, [aviso])

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = anterior }
  }, [])

  return (
    <PanelContext.Provider value={{ ruta: acceso.ruta, superusuario: acceso.superusuario, usuario: acceso.usuario, avisar }}>
      <div className="adm">
        <aside className={menuAbierto ? 'adm-lateral abierto' : 'adm-lateral'}>
          <div className="adm-marca">
            <img src="/logo.png" alt="Pixel App Store" />
            <span>Panel de administración</span>
          </div>
          <nav>
            {visibles.map((s) => (
              <Link key={s.id} to={`${base}/${s.id}`} className={s.id === id ? 'activa' : ''} onClick={() => setMenuAbierto(false)}>
                <Icono nombre={s.icono} tamano={19} /> {s.etiqueta}
              </Link>
            ))}
          </nav>
          <div className="adm-lateral-pie">
            <span className="adm-yo"><Icono nombre="usuario" tamano={16} /> {acceso.usuario}<small>{acceso.superusuario ? 'Administrador' : 'Empleado'}</small></span>
            <Link to="/" className="adm-volver"><Icono nombre="volver" tamano={16} /> Volver a la tienda</Link>
          </div>
        </aside>

        <div className="adm-contenido">
          <header className="adm-top">
            <button type="button" className="adm-icono-boton menu" onClick={() => setMenuAbierto(!menuAbierto)} aria-label="Menú"><Icono nombre="menu" tamano={20} /></button>
            <h1>{seccion ? seccion.etiqueta : 'Sección no encontrada'}</h1>
          </header>
          <main>
            {Vista ? <Vista key={id} /> : (
              <div className="adm-error">{seccion ? 'Esta sección es solo para el administrador principal.' : 'Esta sección no existe.'}</div>
            )}
          </main>
        </div>

        {aviso && <div key={aviso.clave} className={`adm-toast ${aviso.tipo}`} role="status">{aviso.texto}</div>}
      </div>
    </PanelContext.Provider>
  )
}

export default AdminApp
