import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconLoader2,
  IconPlus,
  IconTrash,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import { formatearMoneda } from '../../utils/formato'

export default function FormularioCompra({ onCerrar, onGuardado }) {
  const [secciones, setSecciones] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [productos, setProductos] = useState([])
  const [seccion, setSeccion] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [productoSel, setProductoSel] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true

    Promise.all([
      pedirTodas('/secciones-caja/?estado=AB'),
      pedirTodas('/proveedores/?estado_prov=true'),
      pedirTodas('/productos/'),
    ])
      .then(([seccionesData, proveedoresData, productosData]) => {
        if (!vigente) {
          return
        }
        setSecciones(seccionesData)
        setProveedores(proveedoresData)
        setProductos(productosData)
        if (seccionesData.length > 0) {
          setSeccion(String(seccionesData[0].id))
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
  }, [])

  const productoActual = productos.find(
    (producto) => String(producto.id) === productoSel,
  )
  const total = items.reduce(
    (acumulado, item) => acumulado + item.cantidad * item.precio,
    0,
  )

  function elegirProducto(evento) {
    const id = evento.target.value
    setProductoSel(id)
    const producto = productos.find((item) => String(item.id) === id)
    setPrecio(producto?.precio_unidad ?? '')
  }

  function agregarItem() {
    const producto = productos.find(
      (item) => String(item.id) === productoSel,
    )
    const cantidadNumero = Number(cantidad)
    const precioNumero = Number(precio)

    if (!producto) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta el producto',
        text: 'Seleccioná un producto para agregarlo al detalle.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (!Number.isFinite(cantidadNumero) || cantidadNumero <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cantidad inválida',
        text: 'La cantidad debe ser mayor que cero.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Precio inválido',
        text: 'El precio no puede ser negativo.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    setItems((previos) => {
      const indice = previos.findIndex(
        (item) =>
          item.producto.id === producto.id && item.precio === precioNumero,
      )
      if (indice >= 0) {
        const copia = [...previos]
        copia[indice] = {
          ...copia[indice],
          cantidad: copia[indice].cantidad + cantidadNumero,
        }
        return copia
      }
      return [
        ...previos,
        { producto, cantidad: cantidadNumero, precio: precioNumero },
      ]
    })

    setProductoSel('')
    setCantidad('1')
    setPrecio('')
  }

  function quitarItem(indice) {
    setItems((previos) => previos.filter((_, posicion) => posicion !== indice))
  }

  async function registrarCompra() {
    if (!seccion) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta la caja',
        text: 'No hay una sección de caja abierta para registrar la compra.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (!proveedor) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta el proveedor',
        text: 'Seleccioná un proveedor activo.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (items.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Compra vacía',
        text: 'Agregá al menos un producto.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    setGuardando(true)
    try {
      await pedir('/compras/', {
        method: 'POST',
        body: JSON.stringify({
          seccion_caja: Number(seccion),
          proveedor: Number(proveedor),
          items: items.map((item) => ({
            producto: item.producto.id,
            cantidad: item.cantidad,
            precio: item.precio,
          })),
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Compra registrada',
        text: 'Quedó pendiente de recepción y todavía no repuso stock.',
        timer: 2000,
        showConfirmButton: false,
      })
      onGuardado?.()
      onCerrar()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconTruckDelivery size={24} />
            Nueva compra
          </h2>
          <button
            type="button"
            className="comercial-modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <IconX size={20} />
          </button>
        </div>

        {cargando ? (
          <div className="comercial-cargando">
            <IconLoader2 className="icono-girando" size={28} />
            Cargando catálogos…
          </div>
        ) : error ? (
          <p className="comercial-error">{error}</p>
        ) : (
          <>
            <p className="comercial-nota">
              La compra se registra sin reponer stock. El stock entra cuando la
              recibís desde el listado.
            </p>

            <div className="comercial-grid">
              <label className="campo-comercial">
                <span>Sección de caja</span>
                <select
                  value={seccion}
                  onChange={(evento) => setSeccion(evento.target.value)}
                >
                  {secciones.length === 0 && (
                    <option value="">No hay cajas abiertas</option>
                  )}
                  {secciones.map((item) => (
                    <option key={item.id} value={item.id}>
                      Sección #{item.id} · {item.caja_detalle} ·{' '}
                      {item.empleado_detalle}
                    </option>
                  ))}
                </select>
              </label>

              <label className="campo-comercial">
                <span>Proveedor</span>
                <select
                  value={proveedor}
                  onChange={(evento) => setProveedor(evento.target.value)}
                >
                  <option value="">Seleccioná un proveedor</option>
                  {proveedores.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.razon_social || item.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="comercial-linea-alta">
              <label className="campo-comercial campo-producto">
                <span>Producto</span>
                <select value={productoSel} onChange={elegirProducto}>
                  <option value="">Seleccioná un producto</option>
                  {productos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.codigo} · {item.nombre} ({item.unidad_detalle})
                    </option>
                  ))}
                </select>
              </label>

              <label className="campo-comercial campo-cantidad">
                <span>Cantidad</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={cantidad}
                  onChange={(evento) => setCantidad(evento.target.value)}
                />
              </label>

              <label className="campo-comercial campo-precio">
                <span>Precio unitario</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precio}
                  onChange={(evento) => setPrecio(evento.target.value)}
                  placeholder={
                    productoActual ? productoActual.precio_unidad : '0.00'
                  }
                />
              </label>

              <button
                type="button"
                className="boton-comercial-secundario boton-agregar-linea"
                onClick={agregarItem}
              >
                <IconPlus size={18} />
                Agregar
              </button>
            </div>

            <div className="comercial-tabla-scroll">
              <table className="tabla-comercial tabla-lineas">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="numero">Cantidad</th>
                    <th className="numero">Precio</th>
                    <th className="numero">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan="5" className="comercial-vacio">
                        Todavía no agregaste productos.
                      </td>
                    </tr>
                  )}
                  {items.map((item, indice) => (
                    <tr key={`${item.producto.id}-${indice}`}>
                      <td>
                        <strong>{item.producto.nombre}</strong>
                        <small>{item.producto.codigo}</small>
                      </td>
                      <td className="numero">{item.cantidad}</td>
                      <td className="numero">{formatearMoneda(item.precio)}</td>
                      <td className="numero">
                        {formatearMoneda(item.cantidad * item.precio)}
                      </td>
                      <td className="numero">
                        <button
                          type="button"
                          className="boton-quitar-linea"
                          onClick={() => quitarItem(indice)}
                          aria-label={`Quitar ${item.producto.nombre}`}
                        >
                          <IconTrash size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="comercial-total">
              <span>Total</span>
              <strong>{formatearMoneda(total)}</strong>
            </div>

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={onCerrar}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={registrarCompra}
                disabled={guardando}
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    Registrando…
                  </>
                ) : (
                  'Registrar compra'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
