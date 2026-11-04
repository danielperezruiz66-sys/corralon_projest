import { useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { formatearMoneda, formatearNumero } from '../../utils/formato'

export default function SelectorProductos({
  productos,
  stocks = {},
  mostrarStock = false,
  onAgregar,
}) {
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')

  const categorias = useMemo(() => {
    const mapa = new Map()
    productos.forEach((producto) => {
      mapa.set(producto.categoria, producto.categoria_detalle)
    })
    return [...mapa.entries()]
      .map(([id, nombre]) => ({ id: String(id), nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [productos])

  const filtrados = useMemo(() => {
    const termino = texto.trim().toLowerCase()
    return productos.filter((producto) => {
      const coincideCategoria =
        !categoria || String(producto.categoria) === categoria
      if (!coincideCategoria) {
        return false
      }
      if (!termino) {
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
  }, [productos, categoria, texto])

  return (
    <div className="selector-productos">
      <div className="selector-filtros">
        <label className="campo-comercial">
          <span>Buscar producto</span>
          <input
            type="search"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Código, nombre, categoría, marca o unidad"
          />
        </label>

        <label className="campo-comercial">
          <span>Categoría</span>
          <select
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="selector-lista">
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th className="numero">Precio</th>
              {mostrarStock && <th className="numero">Stock</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
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
                    {formatearMoneda(producto.precio_unidad)}
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
