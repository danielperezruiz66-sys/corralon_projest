import { useEffect, useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import useDebounce from '../../hooks/useDebounce'
import { formatearMoneda, formatearNumero } from '../../utils/formato'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'

export default function SelectorProductos({
  productos = [],
  onBuscar = null,
  stocks = {},
  mostrarStock = false,
  precios = null,
  tituloPrecio = 'Precio',
  onAgregar,
}) {
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(Boolean(onBuscar))
  const busqueda = useDebounce(texto.trim(), 300)
  const productosBase = onBuscar ? resultados : productos

  useEffect(() => {
    if (!onBuscar) {
      return undefined
    }
    let vigente = true
    onBuscar(busqueda)
      .then((datos) => {
        if (vigente) {
          setResultados(datos)
        }
      })
      .catch(() => {
        if (vigente) {
          setResultados([])
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
  }, [busqueda, onBuscar])

  const categorias = useMemo(() => {
    const mapa = new Map()
    productosBase.forEach((producto) => {
      mapa.set(producto.categoria, producto.categoria_detalle)
    })
    return [...mapa.entries()]
      .map(([id, nombre]) => ({ id: String(id), nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [productosBase])

  const filtrados = useMemo(() => {
    const termino = texto.trim().toLowerCase()
    return productosBase.filter((producto) => {
      const coincideCategoria =
        !categoria || String(producto.categoria) === categoria
      if (!coincideCategoria) {
        return false
      }
      if (onBuscar || !termino) {
        return true
      }
      return [
        producto.codigo,
        producto.nombre,
        producto.categoria_detalle,
        producto.marca_detalle,
        producto.unidad_detalle,
      ].some((valor) => String(valor ?? '').toLowerCase().includes(termino))
    })
  }, [productosBase, onBuscar, categoria, texto])

  return (
    <div className="selector-productos">
      <div className="selector-filtros">
        <label className="campo-comercial">
          <span>Buscar producto</span>
          <input
            type="search"
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value)
              if (onBuscar) {
                setCargando(true)
              }
            }}
            placeholder="Código o nombre del producto"
          />
        </label>

        <CampoSelectorBuscable
          etiqueta="Categoría"
          valor={categoria}
          onCambiar={setCategoria}
          opciones={categorias}
          textoOpcion={(item) => item.nombre}
          placeholder="Todas las categorías"
        />
      </div>

      <div className="selector-lista">
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th className="numero">{tituloPrecio}</th>
              {mostrarStock && <th className="numero">Stock</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {cargando && filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={mostrarStock ? 7 : 6}
                  className="comercial-vacio"
                >
                  Buscando productos…
                </td>
              </tr>
            )}
            {!cargando && filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={mostrarStock ? 7 : 6}
                  className="comercial-vacio"
                >
                  No se encontraron productos con ese filtro.
                </td>
              </tr>
            )}
            {filtrados.map((producto) => {
              const stock = stocks[producto.id]
              const cantidad = stock ? Number(stock.cantidad) : null
              return (
                <tr key={producto.id}>
                  <td className="mono">{producto.codigo}</td>
                  <td>
                    <strong>{producto.nombre}</strong>
                    <small>{producto.marca_detalle}</small>
                  </td>
                  <td>{producto.categoria_detalle}</td>
                  <td>{producto.unidad_detalle}</td>
                  <td className="numero">
                    {precios
                      ? precios[producto.id] !== undefined
                        ? formatearMoneda(precios[producto.id])
                        : '—'
                      : formatearMoneda(producto.precio_unidad)}
                  </td>
                  {mostrarStock && (
                    <td
                      className={`numero ${
                        cantidad !== null && cantidad < 0 ? 'stock-negativo' : ''
                      }`}
                    >
                      {cantidad === null ? '—' : formatearNumero(cantidad)}
                    </td>
                  )}
                  <td className="numero">
                    <button
                      type="button"
                      className="boton-agregar-producto"
                      onClick={() => onAgregar(producto)}
                      title={`Agregar ${producto.nombre}`}
                    >
                      <IconPlus size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
