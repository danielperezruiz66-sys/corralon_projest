import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconFileText,
  IconLoader2,
  IconPlus,
  IconShoppingCart,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import { formatearMoneda } from '../../utils/formato'

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => {
    const mapa = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return mapa[caracter]
  })
}

function fechaActual() {
  return new Date().toLocaleDateString('es-AR')
}

export default function FormularioVenta({ modo = 'venta', onCerrar, onGuardado }) {
  const [secciones, setSecciones] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [seccion, setSeccion] = useState('')
  const [cliente, setCliente] = useState('')
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
      pedirTodas('/clientes/'),
      pedirTodas('/productos/'),
    ])
      .then(([seccionesData, clientesData, productosData]) => {
        if (!vigente) {
          return
        }
        setSecciones(seccionesData)
        setClientes(clientesData)
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

  async function registrarVenta() {
    if (!seccion) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta la caja',
        text: 'No hay una sección de caja abierta para registrar la venta.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (items.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Venta vacía',
        text: 'Agregá al menos un producto.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    setGuardando(true)
    try {
      await pedir('/ventas/', {
        method: 'POST',
        body: JSON.stringify({
          seccion_caja: Number(seccion),
          cliente: cliente ? Number(cliente) : null,
          items: items.map((item) => ({
            producto: item.producto.id,
            cantidad: item.cantidad,
            precio: item.precio,
          })),
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Venta registrada',
        text: 'Quedó pendiente y descontó stock.',
        timer: 1800,
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

  function generarPresupuesto() {
    if (items.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Presupuesto vacío',
        text: 'Agregá al menos un producto.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    const clienteElegido = clientes.find(
      (item) => String(item.id) === cliente,
    )
    const nombreCliente = clienteElegido
      ? clienteElegido.razon_social ||
        [clienteElegido.apellido, clienteElegido.nombre]
          .filter(Boolean)
          .join(', ')
      : 'Consumidor final'

    const filas = items
      .map(
        (item) => `
          <tr>
            <td>${escaparHtml(item.producto.codigo)}</td>
            <td>${escaparHtml(item.producto.nombre)}</td>
            <td class="numero">${escaparHtml(item.cantidad)}</td>
            <td class="numero">${formatearMoneda(item.precio)}</td>
            <td class="numero">${formatearMoneda(item.cantidad * item.precio)}</td>
          </tr>`,
      )
      .join('')

    const ventana = window.open('', '_blank', 'width=900,height=700')
    if (!ventana) {
      Swal.fire({
        icon: 'error',
        title: 'Ventana bloqueada',
        text: 'Permití las ventanas emergentes para generar el presupuesto.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    ventana.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Presupuesto - Corralón Fer-Cons</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f2a30; margin: 2.5rem; }
    header { display: flex; justify-content: space-between; border-bottom: 3px solid #4a9da8; padding-bottom: 1rem; }
    h1 { margin: 0; font-size: 1.6rem; }
    .marca { color: #4a9da8; font-size: 1.1rem; font-weight: bold; }
    .datos { margin: 1.5rem 0; font-size: 0.95rem; }
    .datos p { margin: 0.2rem 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border-bottom: 1px solid #d7e5e7; padding: 0.55rem; text-align: left; }
    th { background: #dff0f3; font-size: 0.8rem; text-transform: uppercase; }
    .numero { text-align: right; }
    .total { margin-top: 1.2rem; text-align: right; font-size: 1.3rem; font-weight: bold; }
    footer { margin-top: 2rem; border-top: 1px solid #d7e5e7; padding-top: 0.8rem; font-size: 0.8rem; color: #557; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="marca">CORRALÓN FER-CONS</div>
      <p>Gestión de materiales de construcción</p>
    </div>
    <div>
      <h1>PRESUPUESTO</h1>
      <p>${escaparHtml(fechaActual())}</p>
    </div>
  </header>
  <div class="datos">
    <p><strong>Cliente:</strong> ${escaparHtml(nombreCliente)}</p>
    <p><strong>Condición:</strong> Presupuesto informativo</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Producto</th>
        <th class="numero">Cantidad</th>
        <th class="numero">Precio unitario</th>
        <th class="numero">Subtotal</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <p class="total">Total: ${formatearMoneda(total)}</p>
  <footer>
    Presupuesto válido por 15 días. No es una factura ni reserva stock.
    Los precios pueden variar sin previo aviso.
  </footer>
</body>
</html>`)
    ventana.document.close()
    ventana.focus()
    ventana.setTimeout(() => ventana.print(), 400)
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconShoppingCart size={24} />
            {modo === 'presupuesto' ? 'Nuevo presupuesto' : 'Nueva venta'}
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
              {modo === 'presupuesto'
                ? 'El presupuesto no se guarda. Se genera un PDF para imprimir o guardar.'
                : 'La venta queda pendiente, descuenta stock y vence a los 30 minutos si no se confirma.'}
            </p>

            <div className="comercial-grid">
              {modo === 'venta' && (
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
              )}

              <label className="campo-comercial">
                <span>Cliente</span>
                <select
                  value={cliente}
                  onChange={(evento) => setCliente(evento.target.value)}
                >
                  <option value="">Consumidor final</option>
                  {clientes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.razon_social ||
                        [item.apellido, item.nombre].filter(Boolean).join(', ') ||
                        `Cliente #${item.id}`}
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
                className={
                  modo === 'presupuesto'
                    ? 'boton-comercial-primario'
                    : 'boton-comercial-secundario'
                }
                onClick={generarPresupuesto}
              >
                <IconFileText size={18} />
                Generar presupuesto
              </button>
              {modo === 'venta' && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={registrarVenta}
                  disabled={guardando}
                >
                  {guardando ? (
                    <>
                      <IconLoader2 className="icono-girando" size={18} />
                      Registrando…
                    </>
                  ) : (
                    'Registrar venta pendiente'
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
