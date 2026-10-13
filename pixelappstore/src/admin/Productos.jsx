import { useState } from 'react'
import api, { formatoCLP, mensajeError } from '../api'
import Icono from '../components/Icono'
import { useDatos, usePanel } from './contexto'
import { Campo, Cargando, Chip, ErrorCaja, Modal, Tarjeta, Vacio } from './ui'
import { normalizar } from './utils'

const POR_PAGINA = 20
const VACIO = { nombre: '', codigo: '', marca: '', precio: '', stock: '', categoria_id: '', descripcion: '' }

function FormularioProducto({ producto, categorias, alTerminar, alCerrar }) {
  const { avisar } = usePanel()
  const edicion = Boolean(producto)
  const [form, setForm] = useState(edicion ? {
    nombre: producto.nombre, codigo: producto.codigo, marca: producto.marca, precio: String(producto.precio),
    stock: String(producto.stock), categoria_id: String(producto.categoria_id || ''), descripcion: producto.descripcion,
  } : VACIO)
  const [archivos, setArchivos] = useState([])
  const [imagenes, setImagenes] = useState(edicion ? producto.imagenes : [])
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const quitarImagen = async (imagen) => {
    try {
      await api.delete(`panel/imagenes/${imagen.id}`)
      setImagenes((lista) => lista.filter((i) => i.id !== imagen.id))
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const subirImagenes = async (id) => {
    if (archivos.length === 0) return
    const datos = new FormData()
    archivos.forEach((a) => datos.append('imagenes', a))
    const { data } = await api.post(`panel/productos/${id}/imagenes`, datos)
    if (data.alertas?.length) avisar('error', data.alertas.join(' · '))
  }

  const guardar = async (evento) => {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      if (edicion) {
        await api.put(`productos/editar/${producto.id}`, {
          nombre: form.nombre, codigo: form.codigo, marca: form.marca, precio: form.precio, stock: form.stock,
          categoria_id: form.categoria_id, descripcion: form.descripcion,
        })
        await subirImagenes(producto.id)
      } else {
        const datos = new FormData()
        Object.entries(form).forEach(([k, v]) => datos.append(k, v))
        archivos.forEach((a) => datos.append('imagenes', a))
        const { data } = await api.post('productos/crear', datos)
        if (data.alertas?.length) avisar('error', data.alertas.join(' · '))
      }
      avisar('ok', edicion ? 'Producto actualizado' : 'Producto creado')
      alTerminar()
    } catch (e) {
      setError(mensajeError(e))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={edicion ? `Editar ${producto.nombre}` : 'Nuevo producto'} alCerrar={alCerrar} ancho={640}>
      <form className="adm-formulario" onSubmit={guardar}>
        <div className="adm-grid-2">
          <Campo etiqueta="Nombre"><input value={form.nombre} onChange={cambiar('nombre')} maxLength={100} required /></Campo>
          <Campo etiqueta="Código" ayuda="Debe ser único"><input value={form.codigo} onChange={cambiar('codigo')} maxLength={50} required /></Campo>
          <Campo etiqueta="Marca"><input value={form.marca} onChange={cambiar('marca')} maxLength={50} /></Campo>
          <Campo etiqueta="Categoría">
            <select value={form.categoria_id} onChange={cambiar('categoria_id')} required>
              <option value="">Elige una categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Precio (CLP, con IVA)"><input type="number" min="0" step="1" value={form.precio} onChange={cambiar('precio')} required /></Campo>
          <Campo etiqueta="Stock"><input type="number" min="0" step="1" value={form.stock} onChange={cambiar('stock')} required /></Campo>
        </div>
        <Campo etiqueta="Descripción"><textarea rows={3} value={form.descripcion} onChange={cambiar('descripcion')} /></Campo>

        <Campo etiqueta="Imágenes" ayuda="PNG o JPG de hasta 5 MB">
          <input type="file" multiple accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => setArchivos([...e.target.files])} />
        </Campo>
        {imagenes.length > 0 && (
          <div className="adm-imagenes">
            {imagenes.map((i) => (
              <span key={i.id} className="adm-imagen">
                <img src={i.url} alt="" />
                <button type="button" onClick={() => quitarImagen(i)} aria-label="Quitar imagen"><Icono nombre="cerrar" tamano={12} /></button>
              </span>
            ))}
          </div>
        )}

        {error && <div className="adm-aviso error" role="alert">{error}</div>}
        <div className="adm-pie-modal">
          <button type="button" className="adm-boton secundario" onClick={alCerrar}>Cancelar</button>
          <button className="adm-boton" disabled={guardando}>{guardando ? 'Guardando...' : edicion ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      </form>
    </Modal>
  )
}

function GestorCategorias({ categorias, alCerrar, alCambiar }) {
  const { avisar, superusuario } = usePanel()
  const [nueva, setNueva] = useState('')
  const [edicion, setEdicion] = useState(null)

  const guardar = async (id, nombre) => {
    try {
      await api.post('panel/categorias/guardar', { id, nombre })
      avisar('ok', id ? 'Categoría actualizada' : 'Categoría creada')
      setNueva('')
      setEdicion(null)
      alCambiar()
    } catch (e) {
      avisar('error', mensajeError(e))
    }
  }

  const eliminar = async (categoria) => {
    try {
      await api.delete(`panel/categorias/${categoria.id}`)
      avisar('ok', 'Categoría eliminada')
      alCambiar()
    } catch (e) {
      avisar('error', mensajeError(e))
    }
  }

  return (
    <Modal titulo="Categorías" alCerrar={alCerrar} ancho={520}>
      <form className="adm-fila-form" onSubmit={(e) => { e.preventDefault(); guardar(null, nueva) }}>
        <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nombre de la nueva categoría" maxLength={50} required />
        <button className="adm-boton"><Icono nombre="mas" tamano={16} /> Crear</button>
      </form>
      <ul className="adm-lista-simple adm-categorias">
        {categorias.map((c) => (
          <li key={c.id}>
            {edicion?.id === c.id ? (
              <form className="adm-fila-form" onSubmit={(e) => { e.preventDefault(); guardar(c.id, edicion.nombre) }}>
                <input value={edicion.nombre} onChange={(e) => setEdicion({ id: c.id, nombre: e.target.value })} maxLength={50} autoFocus />
                <button className="adm-boton chico">Guardar</button>
                <button type="button" className="adm-boton secundario chico" onClick={() => setEdicion(null)}>Cancelar</button>
              </form>
            ) : (
              <>
                <span>{c.nombre}<small>{c.productos} {c.productos === 1 ? 'producto' : 'productos'}</small></span>
                <span className="adm-acciones">
                  <button type="button" className="adm-icono-boton" onClick={() => setEdicion({ id: c.id, nombre: c.nombre })} aria-label={`Renombrar ${c.nombre}`}><Icono nombre="lapiz" tamano={15} /></button>
                  {superusuario && c.productos === 0 && (
                    <button type="button" className="adm-icono-boton peligro" onClick={() => eliminar(c)} aria-label={`Eliminar ${c.nombre}`}><Icono nombre="basura" tamano={15} /></button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="adm-nota">Solo se pueden eliminar categorías sin productos (y solo el administrador principal).</p>
    </Modal>
  )
}

function Productos() {
  const { avisar } = usePanel()
  const productos = useDatos(() => api.get('panel/productos').then((r) => r.data.productos))
  const categorias = useDatos(() => api.get('panel/categorias').then((r) => r.data.categorias))
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [nivel, setNivel] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [formulario, setFormulario] = useState(null)
  const [aEliminar, setAEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [verCategorias, setVerCategorias] = useState(false)

  if (productos.cargando || categorias.cargando) return <Cargando />
  if (productos.error) return <ErrorCaja texto={productos.error} alReintentar={productos.recargar} />

  const texto = normalizar(busqueda)
  const filtrados = productos.datos.filter((p) => (
    (!texto || normalizar(`${p.nombre} ${p.codigo} ${p.marca}`).includes(texto))
    && (!categoria || String(p.categoria_id) === categoria)
    && (nivel === 'todos' || (nivel === 'agotado' && p.stock === 0) || (nivel === 'bajo' && p.stock > 0 && p.stock <= 5))
  ))
  const paginas = Math.max(Math.ceil(filtrados.length / POR_PAGINA), 1)
  const actual = Math.min(pagina, paginas)
  const visibles = filtrados.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA)

  const eliminar = async () => {
    setEliminando(true)
    try {
      await api.delete(`productos/eliminar/${aEliminar.id}`)
      avisar('ok', 'Producto eliminado')
      setAEliminar(null)
      productos.recargar()
    } catch (e) {
      avisar('error', mensajeError(e))
      setAEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="adm-pagina">
      <Tarjeta
        titulo={`Productos (${filtrados.length})`}
        acciones={(
          <>
            <button type="button" className="adm-boton secundario" onClick={() => setVerCategorias(true)}><Icono nombre="etiqueta" tamano={16} /> Categorías</button>
            <button type="button" className="adm-boton" onClick={() => setFormulario('nuevo')}><Icono nombre="mas" tamano={16} /> Nuevo producto</button>
          </>
        )}
      >
        <div className="adm-filtros">
          <label className="adm-buscador">
            <Icono nombre="lupa" tamano={16} />
            <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }} placeholder="Buscar por nombre, código o marca" />
          </label>
          <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setPagina(1) }} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {categorias.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={nivel} onChange={(e) => { setNivel(e.target.value); setPagina(1) }} aria-label="Stock">
            <option value="todos">Todo el stock</option>
            <option value="bajo">Stock bajo (5 o menos)</option>
            <option value="agotado">Agotados</option>
          </select>
        </div>

        {visibles.length === 0 ? <Vacio texto="No hay productos con esos filtros." /> : (
          <div className="adm-scroll">
            <table className="adm-tabla">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="der">Precio</th><th className="der">Stock</th><th className="der">Acciones</th></tr></thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="adm-producto">
                        <span className="adm-miniatura">{p.imagenes[0] ? <img src={p.imagenes[0].url} alt="" /> : <Icono nombre="caja" tamano={18} />}</span>
                        <span><strong>{p.nombre}</strong><small>{p.codigo}{p.marca ? ` · ${p.marca}` : ''}</small></span>
                      </span>
                    </td>
                    <td>{p.categoria}</td>
                    <td className="der">{formatoCLP(p.precio)}</td>
                    <td className="der"><Chip tono={p.stock === 0 ? 'malo' : p.stock <= 5 ? 'aviso' : 'bueno'}>{p.stock === 0 ? 'Agotado' : p.stock}</Chip></td>
                    <td className="der">
                      <span className="adm-acciones">
                        <button type="button" className="adm-icono-boton" onClick={() => setFormulario(p)} aria-label={`Editar ${p.nombre}`}><Icono nombre="lapiz" tamano={16} /></button>
                        <button type="button" className="adm-icono-boton peligro" onClick={() => setAEliminar(p)} aria-label={`Eliminar ${p.nombre}`}><Icono nombre="basura" tamano={16} /></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <nav className="adm-paginas" aria-label="Páginas">
            <button type="button" disabled={actual === 1} onClick={() => setPagina(actual - 1)}>Anterior</button>
            <span>Página {actual} de {paginas}</span>
            <button type="button" disabled={actual === paginas} onClick={() => setPagina(actual + 1)}>Siguiente</button>
          </nav>
        )}
      </Tarjeta>

      {formulario && (
        <FormularioProducto
          producto={formulario === 'nuevo' ? null : formulario}
          categorias={categorias.datos}
          alCerrar={() => setFormulario(null)}
          alTerminar={() => { setFormulario(null); productos.recargar() }}
        />
      )}

      {verCategorias && <GestorCategorias categorias={categorias.datos} alCerrar={() => setVerCategorias(false)} alCambiar={categorias.recargar} />}

      {aEliminar && (
        <Modal titulo="Eliminar producto" alCerrar={() => setAEliminar(null)} ancho={440}>
          <p>¿Seguro que quieres eliminar <strong>{aEliminar.nombre}</strong>? Esta acción no se puede deshacer.</p>
          <p className="adm-nota">Si el producto ya tiene ventas no se podrá eliminar; en ese caso déjalo con stock 0.</p>
          <div className="adm-pie-modal">
            <button type="button" className="adm-boton secundario" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button type="button" className="adm-boton peligro" onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando...' : 'Sí, eliminar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Productos
