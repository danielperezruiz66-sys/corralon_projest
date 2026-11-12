import { useCallback, useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconLoader2,
  IconPackage,
  IconTrash,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import { formatearMoneda } from '../../utils/formato'
import {
  unidadPermiteDecimales,
  validarCantidadPorUnidad,
  validarFecha,
} from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'
import FormularioProductosProveedor from '../proveedores/FormularioProductosProveedor.jsx'
import FormularioProveedor from '../proveedores/FormularioProveedor.jsx'
import SelectorProductos from './SelectorProductos'

function fechaHoyLocal() {
  const hoy = new Date()
  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function FormularioCompra({
  sucursalActiva = '',
  proveedorInicialId = '',
  proveedorInicialDetalle = null,
  productoInicialId = '',
  puedeGestionar = true,
  onCerrar,
  onGuardado,
}) {
  const [secciones, setSecciones] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [productosProveedorData, setProductosProveedorData] = useState([])
  const [seccion, setSeccion] = useState('')
  const [proveedor, setProveedor] = useState(
    proveedorInicialId ? String(proveedorInicialId) : '',
  )
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(
    proveedorInicialDetalle,
  )
  const [estadoEntrega, setEstadoEntrega] = useState('PE')
  const [fechaLlegada, setFechaLlegada] = useState('')
  const [items, setItems] = useState([])
  const [stocks, setStocks] = useState({})
  const [costos, setCostos] = useState({})
  const [productosProveedor, setProductosProveedor] = useState([])
  const [cargandoProveedor, setCargandoProveedor] = useState(false)
  const [proveedorRapido, setProveedorRapido] = useState(false)
  const [productosProveedorAbierto, setProductosProveedorAbierto] =
    useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errores, setErrores] = useState({})
  const solicitudProveedor = useRef(0)
  const productoInicialAplicado = useRef(false)

  const buscarProveedores = useCallback(async (texto) => {
    const respuesta = await pedir(
      `/proveedores/?search=${encodeURIComponent(
        texto,
      )}&estado_prov=true&page=1`,
    )
    return respuesta.results || []
  }, [])

  useEffect(() => {
    let vigente = true

    Promise.all([
      pedirTodas('/secciones-caja/?estado=AB'),
      pedirTodas('/sucursales/'),
    ])
      .then(([seccionesData, sucursalesData]) => {
        if (!vigente) {
          return
        }
        const disponibles = sucursalActiva
          ? seccionesData.filter(
              (item) => String(item.sucursal) === String(sucursalActiva),
            )
          : seccionesData
        setSecciones(disponibles)
        setSucursales(sucursalesData)
        if (disponibles.length > 0) {
          setSeccion(String(disponibles[0].id))
        }
        if (proveedorInicialId) {
          cargarProductosProveedor(proveedorInicialId, { mostrarError: true })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalActiva, proveedorInicialId])

  useEffect(() => {
    if (
      productoInicialAplicado.current ||
      !productoInicialId ||
      !proveedor ||
      String(proveedor) !== String(proveedorInicialId) ||
      cargandoProveedor ||
      productosProveedorData.length === 0
    ) {
      return
    }
    const producto = productosProveedorData.find(
      (item) => String(item.id) === String(productoInicialId),
    )
    if (producto) {
      agregarProducto(producto)
      productoInicialAplicado.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    productoInicialId,
    proveedor,
    proveedorInicialId,
    cargandoProveedor,
    productosProveedorData,
  ])

  const seccionActual = secciones.find(
    (item) => String(item.id) === seccion,
  )
  const sucursalActual = seccionActual?.sucursal
  const fechaMinima = fechaHoyLocal()
  const productosDelProveedor = productosProveedorData
  const proveedorActual = proveedorSeleccionado
  const total = items.reduce(
    (acumulado, item) => acumulado + Number(item.cantidad || 0) * Number(item.precio || 0),
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

  async function cargarProductosProveedor(id, opciones = {}) {
    const proveedorId = String(id || '')
    const { mostrarError = true } = opciones
    if (!proveedorId) {
      setCostos({})
      setProductosProveedor([])
      setProductosProveedorData([])
      return false
    }

    const solicitud = solicitudProveedor.current + 1
    solicitudProveedor.current = solicitud
    setCargandoProveedor(true)
    try {
      const datos = await pedirTodas(
        `/productos-proveedores/?proveedor=${proveedorId}&estado=true`,
      )
      if (solicitud !== solicitudProveedor.current) {
        return true
      }
      const mapa = {}
      const lista = []
      datos.forEach((item) => {
        mapa[item.producto] = Number(item.precio_lista)
        lista.push({
          id: item.producto,
          codigo: item.producto_codigo,
          nombre: item.producto_nombre,
          categoria: item.producto_categoria,
          categoria_detalle: item.producto_categoria_detalle,
          marca_detalle: item.producto_marca_detalle,
          unidad_detalle: item.producto_unidad_detalle,
          precio_unidad: item.producto_precio_unidad,
        })
      })
      setCostos(mapa)
      setProductosProveedor(lista.map((producto) => producto.id))
      setProductosProveedorData(lista)
      return true
    } catch (e) {
      if (solicitud === solicitudProveedor.current && mostrarError) {
        Swal.fire({
          icon: 'error',
          title: 'No se pudieron cargar los productos',
          text: e.message,
          confirmButtonColor: '#4a9da8',
        })
      }
      return false
    } finally {
      if (solicitud === solicitudProveedor.current) {
        setCargandoProveedor(false)
      }
    }
  }

  async function cambiarProveedor(nuevoProveedor, opcion = null) {
    const siguiente = String(nuevoProveedor || '')
    if (siguiente === String(proveedor)) {
      return true
    }

    if (items.length > 0) {
      const resultado = await Swal.fire({
        icon: 'warning',
        title: 'Cambiar de proveedor',
        text: 'El carrito tiene productos. Para mantener una única orden por proveedor, se vaciará al cambiar.',
        showCancelButton: true,
        confirmButtonText: 'Vaciar y cambiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4a9da8',
        cancelButtonColor: '#6c757d',
      })
      if (!resultado.isConfirmed) {
        return false
      }
    }

    const solicitud = solicitudProveedor.current + 1
    solicitudProveedor.current = solicitud

    setProveedor(siguiente)
    setProveedorSeleccionado(siguiente ? opcion : null)
    setItems([])
    setCostos({})
    setProductosProveedor([])
    setProductosProveedorData([])
    setError('')
    setCargandoProveedor(Boolean(siguiente))

    if (!siguiente) {
      return true
    }

    return cargarProductosProveedor(siguiente)
  }

  function proveedorCreado(nuevo) {
    setProveedorRapido(false)
    cambiarProveedor(String(nuevo.id), nuevo)
  }

  function agregarProducto(producto) {
    if (!proveedor) {
      setErrores((previos) => ({
        ...previos,
        proveedor: 'Elegí un proveedor antes de agregar productos.',
      }))
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }
    if (!productosProveedor.includes(Number(producto.id))) {
      Swal.fire({
        icon: 'warning',
        title: 'Producto de otro proveedor',
        text: 'Ese producto no está asociado al proveedor seleccionado. Una compra debe tener un único proveedor.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
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
          precio: costos[producto.id] ?? 0,
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
        nuevos[`precio-${indice}`] = 'Ingresá un costo mayor a cero.'
      }
    })
    setErrores((previos) => ({ ...previos, items: nuevos }))
    return Object.keys(nuevos).length === 0
  }

  async function registrarCompra() {
    const nuevos = {}
    if (!seccion) {
      nuevos.seccion = 'No hay una sección de caja abierta.'
    }
    if (!proveedor) {
      nuevos.proveedor = 'Seleccioná un proveedor activo.'
    }
    const entregaFinal = puedeGestionar ? estadoEntrega : 'PE'
    const fechaLlegadaFinal = puedeGestionar ? fechaLlegada : ''
    if (entregaFinal === 'EC') {
      if (!fechaLlegadaFinal) {
        nuevos.fechaLlegada = 'Indicá la fecha estimada de llegada.'
      } else {
        const errorFecha = validarFecha(
          fechaLlegadaFinal,
          'La fecha estimada',
        )
        if (errorFecha) {
          nuevos.fechaLlegada = errorFecha
        } else if (fechaLlegadaFinal < fechaMinima) {
          nuevos.fechaLlegada =
            'La fecha estimada no puede ser anterior a la compra.'
        }
      }
    }
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0 || !validarItems()) {
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
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
          estado_entrega: entregaFinal,
          fecha_estimada_llegada: fechaLlegadaFinal || null,
          items: items.map((item) => ({
            producto: item.producto.id,
            cantidad: item.cantidad,
            precio: item.precio,
          })),
        }),
      })
      Swal.fire({
        icon: 'success',
        title: puedeGestionar ? 'Compra registrada' : 'Compra solicitada',
        text: !puedeGestionar
          ? 'Quedó pendiente para que la gestione un encargado o administrador. Todavía no repuso stock.'
          : entregaFinal === 'EC'
            ? 'Quedó en camino. El stock se repone cuando la recibas.'
            : 'Quedó pendiente de recepción y todavía no repuso stock.',
        timer: 2200,
        showConfirmButton: false,
      })
      onGuardado?.()
      onCerrar()
    } catch (e) {
      if (e.campos) {
        const mapa = {
          seccion_caja: 'seccion',
          fecha_estimada_llegada: 'fechaLlegada',
        }
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

  return (
    <>
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
              {puedeGestionar
                ? 'La compra se registra sin reponer stock. El stock entra cuando la recibís desde el listado.'
                : 'La compra se solicita sin reponer stock. Queda pendiente para que la gestione un encargado o administrador.'}
            </p>

            <div className="comercial-grid">
              <CampoSelectorBuscable
                etiqueta="Sección de caja"
                valor={seccion}
                onCambiar={setSeccion}
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

              <CampoSelectorBuscable
                etiqueta="Proveedor"
                valor={proveedor}
                onCambiar={(valor, opcion) =>
                  cambiarProveedor(valor, opcion)
                }
                opciones={[]}
                opcionSeleccionada={proveedorSeleccionado}
                onBuscar={buscarProveedores}
                textoOpcion={(item) => item.razon_social || item.nombre}
                textoSecundario={(item) =>
                  item.cuit ? `CUIT ${item.cuit}` : ''
                }
                placeholder="Buscar por nombre o CUIT"
                onCrear={() => setProveedorRapido(true)}
                tituloCrear="Nuevo proveedor"
                error={Boolean(errores.proveedor)}
                mensajeError={errores.proveedor}
              />

              {puedeGestionar ? (
                <>
                  <label className="campo-comercial">
                    <span>Entrega</span>
                    <select
                      value={estadoEntrega}
                      onChange={(evento) => {
                        setEstadoEntrega(evento.target.value)
                        if (evento.target.value !== 'EC') {
                          setFechaLlegada('')
                        }
                      }}
                    >
                      <option value="PE">Pendiente de recepción</option>
                      <option value="EC">En camino</option>
                    </select>
                  </label>

                  {estadoEntrega === 'EC' && (
                    <label className="campo-comercial">
                      <span>Llegada estimada *</span>
                      <input
                        type="date"
                        className={errores.fechaLlegada ? 'input-error' : ''}
                        value={fechaLlegada}
                        min={fechaMinima}
                        onChange={(evento) =>
                          setFechaLlegada(evento.target.value)
                        }
                      />
                      <MensajeError>{errores.fechaLlegada}</MensajeError>
                    </label>
                  )}
                </>
              ) : (
                <p className="comercial-nota">
                  La compra quedará solicitada como pendiente. El encargado o
                  administrador definirá la entrega y la fecha estimada.
                </p>
              )}
            </div>

            {!proveedor && (
              <p className="comercial-nota">
                Elegí un proveedor para cargar sus productos.
              </p>
            )}

            {proveedor && cargandoProveedor && (
              <p className="comercial-nota">
                Cargando productos del proveedor…
              </p>
            )}

            {proveedor &&
              !cargandoProveedor &&
              productosDelProveedor.length > 0 && (
                <div className="productos-proveedor-acciones">
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    onClick={() => setProductosProveedorAbierto(true)}
                  >
                    <IconPackage size={17} />
                    Administrar productos del proveedor
                  </button>
                </div>
              )}

            {proveedor &&
              !cargandoProveedor &&
              productosDelProveedor.length > 0 && (
                <SelectorProductos
                  key={proveedor}
                  productos={productosDelProveedor}
                  stocks={stocks}
                  mostrarStock={Boolean(sucursalActual)}
                  precios={costos}
                  tituloPrecio="Costo"
                  onAgregar={agregarProducto}
                />
              )}

            {proveedor &&
              !cargandoProveedor &&
              productosDelProveedor.length === 0 && (
                <div className="comercial-nota comercial-nota-acciones">
                  <p>
                    Este proveedor no tiene productos asociados. Asociá al
                    menos uno para poder cargar la compra.
                  </p>
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    onClick={() => setProductosProveedorAbierto(true)}
                  >
                    <IconPackage size={17} />
                    Asociar productos
                  </button>
                </div>
              )}

            <div className="comercial-tabla-scroll">
              <table className="tabla-comercial tabla-lineas">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="numero">Cantidad</th>
                    <th className="numero">Precio costo</th>
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
                        {formatearMoneda(Number(item.cantidad) * Number(item.precio))}
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
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={registrarCompra}
                disabled={guardando}
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    {puedeGestionar ? 'Registrando…' : 'Solicitando…'}
                  </>
                ) : puedeGestionar ? (
                  'Registrar compra'
                ) : (
                  'Solicitar compra'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>

      {proveedorRapido && (
        <FormularioProveedor
          sucursales={sucursales}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setProveedorRapido(false)}
          onGuardado={proveedorCreado}
        />
      )}

      {productosProveedorAbierto && proveedorActual && (
        <FormularioProductosProveedor
          proveedor={proveedorActual}
          onCerrar={() => setProductosProveedorAbierto(false)}
          onGuardado={async () => {
            setProductosProveedorAbierto(false)
            const recargado = await cargarProductosProveedor(proveedor)
            if (recargado) {
              Swal.fire({
                icon: 'success',
                title: 'Productos asociados',
                text: 'Ya están disponibles para cargar en la compra.',
                timer: 1800,
                showConfirmButton: false,
              })
            } else {
              Swal.fire({
                icon: 'warning',
                title: 'Productos guardados',
                text: 'La asociación se guardó, pero no se pudo actualizar la lista. Volvé a seleccionar el proveedor para recargar.',
                confirmButtonColor: '#4a9da8',
              })
            }
          }}
        />
      )}
    </>
  )
}
