import { useCallback, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconFileText,
  IconLoader2,
  IconShoppingCart,
  IconTrash,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import FormularioCliente from '../clientes/FormularioCliente.jsx'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import { formatearMoneda } from '../../utils/formato'
import {
  unidadPermiteDecimales,
  validarCantidadPorUnidad,
  validarNombreConsumidor,
} from '../../utils/validaciones'
import MensajeError from '../common/MensajeError.jsx'
import SelectorProductos from './SelectorProductos'

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

export default function FormularioVenta({ modo = 'venta', clienteInicial = '', sucursalActiva = '', onCerrar, onGuardado }) {
  const [secciones, setSecciones] = useState([])
  const [seccion, setSeccion] = useState('')
  const [cliente, setCliente] = useState(
    clienteInicial ? String(clienteInicial) : '',
  )
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [clienteVenta, setClienteVenta] = useState('')
  const [modalCliente, setModalCliente] = useState(false)
  const [items, setItems] = useState([])
  const [stocks, setStocks] = useState({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errores, setErrores] = useState({})

  const buscarClientes = useCallback(async (texto) => {
    const respuesta = await pedir(
      `/clientes/?search=${encodeURIComponent(texto)}&estado=true&page=1`,
    )
    return respuesta.results || []
  }, [])

  useEffect(() => {
    let vigente = true

    pedirTodas('/secciones-caja/?estado=AB')
      .then((seccionesData) => {
        if (!vigente) {
          return
        }
        const disponibles = sucursalActiva
          ? seccionesData.filter(
              (item) => String(item.sucursal) === String(sucursalActiva),
            )
          : seccionesData
        setSecciones(disponibles)
        if (disponibles.length > 0) {
          setSeccion(String(disponibles[0].id))
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
  }, [sucursalActiva])

  useEffect(() => {
    if (!clienteInicial) {
      return undefined
    }
    let vigente = true
    pedir(`/clientes/${clienteInicial}/`)
      .then((clienteData) => {
        if (vigente) {
          setClienteSeleccionado((actual) => actual || clienteData)
        }
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [clienteInicial])

  const seccionActual = secciones.find(
    (item) => String(item.id) === seccion,
  )
  const sucursalActual = seccionActual?.sucursal
  const total = items.reduce(
    (acumulado, item) => acumulado + Number(item.cantidad || 0) * Number(item.precio || 0),
    0,
  )

  const buscarProductos = useCallback(
    async (texto) => {
      const parametros = new URLSearchParams({
        search: texto,
        page: '1',
      })
      if (sucursalActual) {
        parametros.set('sucursal', sucursalActual)
      }
      const respuesta = await pedir(
        `/productos/?${parametros.toString()}`,
      )
      return respuesta.results || []
    },
    [sucursalActual],
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
          setProductos([])
        }
      })

    return () => {
      vigente = false
    }
  }, [sucursalActual])

  function clienteCreado(nuevo) {
    setCliente(String(nuevo.id))
    setClienteSeleccionado(nuevo)
    setClienteVenta('')
    setModalCliente(false)
    Swal.fire({
      icon: 'success',
      title: 'Cliente registrado',
      text: 'Quedó seleccionado en la venta.',
      timer: 1600,
      showConfirmButton: false,
    })
  }

  function agregarProducto(producto) {    setItems((previos) => {
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
    if (campo === 'cantidad') {
      setItems((previos) =>
        previos.map((item, posicion) =>
          posicion === indice ? { ...item, cantidad: valor } : item,
        ),
      )
      setErrores((previos) => {
        if (!previos.items || typeof previos.items !== 'object') {
          return previos
        }
        const itemsErrores = { ...previos.items }
        delete itemsErrores[`cantidad-${indice}`]
        return { ...previos, items: itemsErrores }
      })
      return
    }
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
      setErrores((previos) => ({
        ...previos,
        items: 'Agregá al menos un producto.',
      }))
      return false
    }
    const nuevos = {}
    items.forEach((item, indice) => {
      const errorCantidad = validarCantidadPorUnidad(
        item.cantidad,
        item.producto?.unidad_detalle,
      )
      if (errorCantidad) {
        nuevos[`cantidad-${indice}`] = errorCantidad
      }
      if (!(Number(item.precio) > 0)) {
        nuevos[`precio-${indice}`] = 'Ingresá un precio mayor a cero.'
      }
    })
    setErrores((previos) => ({ ...previos, items: nuevos }))
    return Object.keys(nuevos).length === 0
  }

  async function registrarVenta() {
    const nuevosErrores = {}
    if (!seccion) {
      nuevosErrores.seccion = 'No hay una sección de caja abierta.'
    }
    if (!cliente) {
      const errorConsumidor = validarNombreConsumidor(clienteVenta)
      if (errorConsumidor) {
        nuevosErrores.cliente_venta = errorConsumidor
      }
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores((previos) => ({ ...previos, ...nuevosErrores }))
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }
    if (!validarItems()) {
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
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
          cliente_venta: cliente ? null : clienteVenta.trim() || null,
          items: items.map((item) => ({
            producto: item.producto.id,
            cantidad: item.cantidad,
            precio: item.precio,
          })),
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Venta creada',
        text: 'Quedó pendiente hasta registrar el pago y confirmarla.',
        timer: 1800,
        showConfirmButton: false,
      })
      onGuardado?.()
      onCerrar()
    } catch (e) {
      if (e.campos) {
        const mapa = { seccion_caja: 'seccion' }
        const nuevos = {}
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          nuevos[mapa[campo] || campo] = mensaje
        })
        setErrores(nuevos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
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
    if (!cliente) {
      const errorConsumidor = validarNombreConsumidor(clienteVenta)
      if (errorConsumidor) {
        setErrores((previos) => ({
          ...previos,
          cliente_venta: errorConsumidor,
        }))
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
    }
    if (!validarItems()) {
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    const clienteElegido =
      clienteSeleccionado &&
      String(clienteSeleccionado.id) === String(cliente)
        ? clienteSeleccionado
        : null
    const nombreCliente = clienteElegido
      ? clienteElegido.razon_social ||
        [clienteElegido.apellido, clienteElegido.nombre]
          .filter(Boolean)
          .join(', ')
      : clienteVenta.trim() || 'Consumidor final'

    const filas = items
      .map(
        (item) => `
          <tr>
            <td>${escaparHtml(item.producto.codigo)}</td>
            <td>${escaparHtml(item.producto.nombre)}</td>
            <td class="numero">${escaparHtml(item.cantidad)}</td>
            <td class="numero">${formatearMoneda(item.precio)}</td>
            <td class="numero">${formatearMoneda(Number(item.cantidad) * Number(item.precio))}</td>
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
    <>
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
                : 'La venta nace pendiente, descuenta stock y vence a los 30 minutos si no se registra el pago y se confirma.'}
            </p>

            <div className="comercial-grid">
              {modo === 'venta' && (
                <CampoSelectorBuscable
                  etiqueta="Sección de caja"
                  valor={seccion}
                  onCambiar={(valor) => {
                    setSeccion(valor)
                    setItems([])
                    setStocks({})
                  }}
                  opciones={secciones}
                  textoOpcion={(item) =>
                    `Sección #${item.id} · ${item.caja_detalle} · ${item.empleado_detalle}`
                  }
                  placeholder={
                    secciones.length === 0
                      ? 'No hay cajas abiertas'
                      : 'Buscar sección'
                  }
                  error={Boolean(errores.seccion)}
                  mensajeError={errores.seccion}
                />
              )}

              <CampoSelectorBuscable
                etiqueta="Cliente"
                valor={cliente}
                onCambiar={(valor, opcion) => {
                  setCliente(valor)
                  setClienteSeleccionado(opcion || null)
                  if (valor) {
                    setClienteVenta('')
                  }
                }}
                opciones={[]}
                opcionSeleccionada={clienteSeleccionado}
                onBuscar={buscarClientes}
                textoOpcion={(item) =>
                  item.razon_social ||
                  [item.apellido, item.nombre]
                    .filter(Boolean)
                    .join(', ') ||
                  `Cliente #${item.id}`
                }
                textoSecundario={(item) =>
                  item.dni ? `DNI/CUIT ${item.dni}` : ''
                }
                placeholder="Buscar por nombre, DNI o razón social"
                onCrear={() => setModalCliente(true)}
                tituloCrear="Registrar cliente"
                icono={IconUserPlus}
                textoBoton="Registrar"
              />

              {!cliente && (
                <label className="campo-comercial">
                  <span>Nombre del consumidor final (opcional)</span>
                  <input
                    type="text"
                    maxLength={120}
                    className={errores.cliente_venta ? 'input-error' : ''}
                    value={clienteVenta}
                    onChange={(evento) => {
                      setClienteVenta(evento.target.value)
                      if (errores.cliente_venta) {
                        setErrores((previos) => ({
                          ...previos,
                          cliente_venta: '',
                        }))
                      }
                    }}
                    placeholder="Ej. Juan Pérez"
                  />
                  <MensajeError>{errores.cliente_venta}</MensajeError>
                </label>
              )}
            </div>

            <SelectorProductos
              key={sucursalActual || 'todas'}
              productos={[]}
              onBuscar={buscarProductos}
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
                          className={`input-tabla ${
                            errores.items?.[`cantidad-${indice}`]
                              ? 'input-error'
                              : ''
                          }`}
                          min={unidadPermiteDecimales(item.producto?.unidad_detalle) ? '0.001' : '1'}
                          step={unidadPermiteDecimales(item.producto?.unidad_detalle) ? '0.001' : '1'}
                          value={item.cantidad}
                          onChange={(evento) =>
                            actualizarItem(
                              indice,
                              'cantidad',
                              evento.target.value,
                            )
                          }
                        />
                        <MensajeError>
                          {errores.items?.[`cantidad-${indice}`]}
                        </MensajeError>
                      </td>
                      <td className="numero">
                        <input
                          type="number"
                          className={`input-tabla ${
                            errores.items?.[`precio-${indice}`]
                              ? 'input-error'
                              : ''
                          }`}
                          min="0"
                          step="0.01"
                          value={item.precio}
                          onChange={(evento) =>
                            actualizarItem(indice, 'precio', evento.target.value)
                          }
                        />
                        <MensajeError>
                          {errores.items?.[`precio-${indice}`]}
                        </MensajeError>
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
            {typeof errores.items === 'string' && (
              <MensajeError>{errores.items}</MensajeError>
            )}

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
              {modo === 'presupuesto' && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={generarPresupuesto}
                >
                  <IconFileText size={18} />
                  Generar presupuesto
                </button>
              )}
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
                    'Crear venta'
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      </div>

      {modalCliente && (
        <FormularioCliente
          onCerrar={() => setModalCliente(false)}
          onCreado={clienteCreado}
        />
      )}
    </>
  )
}
