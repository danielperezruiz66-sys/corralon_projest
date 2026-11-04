import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconLoader2,
  IconTrash,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import { formatearMoneda } from '../../utils/formato'
import SelectorProductos from './SelectorProductos'

export default function FormularioCompra({ onCerrar, onGuardado }) {
  const [secciones, setSecciones] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [productos, setProductos] = useState([])
  const [seccion, setSeccion] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [items, setItems] = useState([])
  const [stocks, setStocks] = useState({})
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

  const seccionActual = secciones.find(
    (item) => String(item.id) === seccion,
  )
  const sucursalActual = seccionActual?.sucursal
  const total = items.reduce(
    (acumulado, item) => acumulado + item.cantidad * item.precio,
    0,
  )

  useEffect(() => {
    if (!sucursalActual) {
      return undefined
    }

    let vigente = true
    pedirTodas(`/stocks/?sucursal=${sucursalActual}`)
      .then((datos) => {
        if (!vigente) {
          return
        }
        const mapa = {}
        datos.forEach((stock) => {
          mapa[stock.producto] = stock
        })
        setStocks(mapa)
      })
      .catch(() => {
        if (vigente) {
          setStocks({})
        }
      })

    return () => {
      vigente = false
    }
  }, [sucursalActual])

  function agregarProducto(producto) {
    setItems((previos) => {
      const indice = previos.findIndex(
        (item) => item.producto.id === producto.id,
      )
      if (indice >= 0) {
        const copia = [...previos]
        copia[indice] = {
          ...copia[indice],
          cantidad: copia[indice].cantidad + 1,
        }
        return copia
      }
      return [
        ...previos,
        {
          producto,
          cantidad: 1,
          precio: Number(producto.precio_unidad),
        },
      ]
    })
  }

  function actualizarItem(indice, campo, valor) {
    const numero = valor === '' ? 0 : Number(valor)
    setItems((previos) =>
      previos.map((item, posicion) =>
        posicion === indice
          ? { ...item, [campo]: Number.isFinite(numero) ? numero : 0 }
          : item,
      ),
    )
  }

  function quitarItem(indice) {
    setItems((previos) => previos.filter((_, posicion) => posicion !== indice))
  }

  function validarItems() {
    if (items.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Detalle vacío',
        text: 'Agregá al menos un producto.',
        confirmButtonColor: '#4a9da8',
      })
      return false
    }
    const invalido = items.some(
      (item) => !(item.cantidad > 0) || !(item.precio >= 0),
    )
    if (invalido) {
      Swal.fire({
        icon: 'warning',
        title: 'Valores inválidos',
        text: 'Revisá las cantidades y los precios del detalle.',
        confirmButtonColor: '#4a9da8',
      })
      return false
    }
    return true
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
    if (!validarItems()) {
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

            <SelectorProductos
              productos={productos}
              stocks={stocks}
              mostrarStock={Boolean(sucursalActual)}
              onAgregar={agregarProducto}
            />

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
                        <small>
                          {item.producto.codigo} · {item.producto.unidad_detalle}
                        </small>
                      </td>
                      <td className="numero">
                        <input
                          type="number"
                          className="input-tabla"
                          min="0.001"
                          step="0.001"
                          value={item.cantidad}
                          onChange={(evento) =>
                            actualizarItem(
                              indice,
                              'cantidad',
                              evento.target.value,
                            )
                          }
                        />
                      </td>
                      <td className="numero">
                        <input
                          type="number"
                          className="input-tabla"
                          min="0"
                          step="0.01"
                          value={item.precio}
                          onChange={(evento) =>
                            actualizarItem(indice, 'precio', evento.target.value)
                          }
                        />
                      </td>
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
