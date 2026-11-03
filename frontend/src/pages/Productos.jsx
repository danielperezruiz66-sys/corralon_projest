import { useEffect, useState } from 'react'
import { pedir } from '../api/client'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const formatearPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

export default function Productos() {
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true

    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }

    pedir(`/productos/?${parametros}`)
      .then((respuesta) => {
        if (vigente) {
          setDatos(respuesta)
        }
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [busqueda, pagina])

  function buscar(evento) {
    evento.preventDefault()
    setCargando(true)
    setError('')
    setPagina(1)
    setBusqueda(texto.trim())
  }

  function limpiar() {
    setCargando(true)
    setError('')
    setTexto('')
    setBusqueda('')
    setPagina(1)
  }

  function irAPagina(nueva) {
    setCargando(true)
    setError('')
    setPagina(nueva)
  }

  return (
    <div className="productos">
      <form className="barra-busqueda" onSubmit={buscar}>
        <input
          type="search"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Buscar por código, nombre o descripción"
          aria-label="Buscar productos"
        />
        <button className="boton-primario" type="submit">
          Buscar
        </button>
        {(texto || busqueda) && (
          <button className="boton-secundario" type="button" onClick={limpiar}>
            Limpiar
          </button>
        )}
      </form>

      {error && <p className="mensaje-error">{error}</p>}

      <div className="tarjeta tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Marca</th>
              <th>Unidad</th>
              <th className="alinear-derecha">Precio</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan="6" className="tabla-vacia">
                  Cargando productos…
                </td>
              </tr>
            )}

            {!cargando && !error && datos.results.length === 0 && (
              <tr>
                <td colSpan="6" className="tabla-vacia">
                  No se encontraron productos.
                </td>
              </tr>
            )}

            {!cargando &&
              datos.results.map((producto) => (
                <tr key={producto.id}>
                  <td className="mono">{producto.codigo}</td>
                  <td>
                    <strong>{producto.nombre}</strong>
                    {producto.descripcion && (
                      <small className="detalle">{producto.descripcion}</small>
                    )}
                  </td>
                  <td>{producto.categoria_detalle}</td>
                  <td>{producto.marca_detalle}</td>
                  <td>{producto.unidad_detalle}</td>
                  <td className="alinear-derecha mono">
                    {formatearPrecio.format(Number(producto.precio_unidad))}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="paginacion">
        <span className="texto-suave">
          {datos.count} producto{datos.count === 1 ? '' : 's'}
        </span>
        <div className="paginacion-botones">
          <button
            className="boton-secundario"
            type="button"
            disabled={!datos.previous || cargando}
            onClick={() => irAPagina(pagina - 1)}
          >
            Anterior
          </button>
          <span className="pagina-actual">Página {pagina}</span>
          <button
            className="boton-secundario"
            type="button"
            disabled={!datos.next || cargando}
            onClick={() => irAPagina(pagina + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
