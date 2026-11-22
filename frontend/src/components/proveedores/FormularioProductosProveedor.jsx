import { useCallback, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconLoader2,
  IconPackage,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import {
  esAsociacionDuplicada,
  ofrecerActualizarDuplicado,
} from '../../utils/asociaciones'
import { formatearMoneda } from '../../utils/formato'
import { validarNumero } from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'
import '../../styles/components/proveedores/FormularioProductosProveedor.css'

let siguienteFila = 0

function nuevaFila() {
  siguienteFila += 1
  return {
    id: siguienteFila,
    producto: '',
    productoObjeto: null,
    precio: '',
    codigo: '',
    existente: false,
    asociacionId: null,
    precioOriginal: '',
    codigoOriginal: '',
  }
}

function calcularErroresFilas(filas) {
  const errores = {}
  const usados = new Set()
  filas.forEach((fila) => {
    if (!fila.producto && !fila.precio) {
      return
    }
    const deFila = {}
    if (!fila.producto) {
      deFila.producto = 'Seleccioná un producto de la lista.'
    } else if (usados.has(fila.producto)) {
      deFila.producto = 'No repitas el mismo producto.'
    } else {
      usados.add(fila.producto)
    }
    const errorPrecio = validarNumero(fila.precio, {
      etiqueta: 'El precio de costo',
      mayorQueCero: true,
      decimales: 2,
    })
    if (errorPrecio) {
      deFila.precio = errorPrecio
    } else if (
      fila.productoObjeto &&
      Number(fila.precio) >= Number(fila.productoObjeto.precio_unidad)
    ) {
      deFila.precio = `El costo debe ser menor al precio de venta (${formatearMoneda(
        fila.productoObjeto.precio_unidad,
      )}).`
    }
    if (Object.keys(deFila).length > 0) {
      errores[fila.id] = deFila
    }
  })
  return errores
}

export default function FormularioProductosProveedor({
  proveedor,
  onCerrar,
  onGuardado,
}) {
  const [filas, setFilas] = useState([nuevaFila()])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorLista, setErrorLista] = useState('')
  const [erroresServidor, setErroresServidor] = useState({})

  const erroresCalculados = calcularErroresFilas(filas)
  const hayFilas = filas.some((fila) => fila.producto || fila.precio)
  const formularioValido =
    hayFilas && Object.keys(erroresCalculados).length === 0

  const buscarProductos = useCallback(async (texto) => {
    const respuesta = await pedir(
      `/productos/?search=${encodeURIComponent(texto)}&page=1`,
    )
    return respuesta.results || []
  }, [])

  useEffect(() => {
    let vigente = true
    pedirTodas(
      `/productos-proveedores/?proveedor=${proveedor.id}&estado=true`,
    )
      .then((datos) => {
        if (!vigente) {
          return
        }
        if (datos.length === 0) {
          setFilas([nuevaFila()])
          return
        }
        setFilas(
          datos.map((item) => {
            siguienteFila += 1
            return {
              id: siguienteFila,
              producto: String(item.producto),
              productoObjeto: {
                id: item.producto,
                codigo: item.producto_codigo,
                nombre: item.producto_nombre,
                categoria_detalle: item.producto_categoria_detalle,
                unidad_detalle: item.producto_unidad_detalle,
                precio_unidad: item.producto_precio_unidad,
              },
              precio: String(item.precio_lista),
              codigo: item.codigo_producto_proveedor || '',
              existente: true,
              asociacionId: item.id,
              precioOriginal: String(item.precio_lista),
              codigoOriginal: item.codigo_producto_proveedor || '',
            }
          }),
        )
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
  }, [proveedor.id])

  function actualizarFila(id, campo, valor, objeto = null) {
    setErroresServidor((previos) => {
      if (!previos[id]) {
        return previos
      }
      const copia = { ...previos }
      delete copia[id]
      return copia
    })
    setFilas((previas) =>
      previas.map((fila) => {
        if (fila.id !== id) {
          return fila
        }
        const cambios = { [campo]: valor }
        if (campo === 'producto') {
          cambios.productoObjeto = objeto
        }
        return { ...fila, ...cambios }
      }),
    )
  }

  function agregarFila() {
    setErrorLista('')
    setFilas((previas) => [...previas, nuevaFila()])
  }

  function quitarFila(id) {
    setFilas((previas) => previas.filter((fila) => fila.id !== id))
  }

  function payloadItem(fila) {
    return {
      producto: Number(fila.producto),
      precio_lista: Number(fila.precio).toFixed(2),
      codigo_producto_proveedor: fila.codigo.trim() || null,
    }
  }

  /**
   * Envia las filas nuevas de a tandas. Si la API detecta que un producto ya
   * estaba asociado (carrera o dato viejo), ofrece actualizar esa asociacion
   * y reintenta con el resto de las filas.
   */
  async function guardarNuevas(nuevas) {
    let pendientes = [...nuevas]
    const guardadas = []
    while (pendientes.length > 0) {
      try {
        const respuesta = await pedir(
          `/proveedores/${proveedor.id}/productos/`,
          {
            method: 'POST',
            body: JSON.stringify({
              items: pendientes.map(payloadItem),
            }),
          },
        )
        guardadas.push(...respuesta)
        return guardadas
      } catch (e) {
        if (!esAsociacionDuplicada(e)) {
          e.filasEnviadas = pendientes
          throw e
        }
        const fila = pendientes.find(
          (item) =>
            Number(item.producto) === Number(e.datos?.producto_id),
        )
        const existente = await ofrecerActualizarDuplicado(e, {
          producto: fila?.productoObjeto?.nombre,
          proveedor:
            proveedor.razon_social || proveedor.nombre || 'proveedor',
        })
        if (!existente || !fila) {
          return null
        }
        const actualizada = await pedir(
          `/productos-proveedores/${existente.asociacionId}/`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              precio_lista: Number(fila.precio).toFixed(2),
              codigo_producto_proveedor: fila.codigo.trim() || null,
              estado: true,
            }),
          },
        )
        guardadas.push(actualizada)
        pendientes = pendientes.filter((item) => item.id !== fila.id)
      }
    }
    return guardadas
  }

  async function guardar(evento) {
    evento.preventDefault()
    const utilizables = filas.filter(
      (fila) => fila.producto || fila.precio,
    )
    if (utilizables.length === 0) {
      setErrorLista('Agregá al menos un producto con su costo.')
      return
    }
    if (!formularioValido) {
      setErrorLista('')
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErrorLista('')
    setErroresServidor({})
    setGuardando(true)
    try {
      const nuevas = utilizables.filter((fila) => !fila.existente)
      const cambiadas = utilizables.filter(
        (fila) =>
          fila.existente &&
          (Number(fila.precio).toFixed(2) !==
            Number(fila.precioOriginal).toFixed(2) ||
            (fila.codigo.trim() || '') !== fila.codigoOriginal),
      )

      const guardadas = nuevas.length > 0 ? await guardarNuevas(nuevas) : []
      if (guardadas === null) {
        return
      }
      for (const fila of cambiadas) {
        const actualizada = await pedir(
          `/productos-proveedores/${fila.asociacionId}/`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              precio_lista: Number(fila.precio).toFixed(2),
              codigo_producto_proveedor: fila.codigo.trim() || null,
            }),
          },
        )
        guardadas.push(actualizada)
      }
      onGuardado?.(guardadas)
    } catch (e) {
      const datos = e.datos || {}
      const enviadas = e.filasEnviadas || utilizables
      const erroresItems = {}
      const mapaCampos = {
        precio_lista: 'precio',
        codigo_producto_proveedor: 'codigo',
      }
      if (Array.isArray(datos.items)) {
        datos.items.forEach((detalle, indice) => {
          const fila = enviadas[indice]
          if (!fila || !detalle || typeof detalle !== 'object') {
            return
          }
          const deFila = {}
          Object.entries(detalle).forEach(([campo, mensaje]) => {
            deFila[mapaCampos[campo] || campo] = Array.isArray(mensaje)
              ? mensaje.join(' ')
              : String(mensaje)
          })
          if (Object.keys(deFila).length > 0) {
            erroresItems[fila.id] = deFila
          }
        })
      }
      const otros = {}
      if (e.campos) {
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          if (campo === 'items' && Array.isArray(datos.items)) {
            return
          }
          otros[campo] = mensaje
        })
      }
      if (Object.keys(erroresItems).length > 0) {
        setErroresServidor(erroresItems)
      }
      if (Object.keys(otros).length > 0) {
        setErrorLista(Object.values(otros)[0])
      }
      if (
        Object.keys(erroresItems).length > 0 ||
        Object.keys(otros).length > 0
      ) {
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      if (!esAsociacionDuplicada(e)) {
        Swal.fire({
          icon: 'error',
          title: 'No se pudieron guardar los productos',
          text: e.message,
          confirmButtonColor: '#4a9da8',
        })
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconPackage size={24} />
            Productos de{' '}
            {proveedor.razon_social || proveedor.nombre || 'proveedor'}
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
            Cargando productos del proveedor…
          </div>
        ) : error ? (
          <p className="comercial-error">{error}</p>
        ) : (
          <form onSubmit={guardar} noValidate>
            <p className="comercial-nota">
              Asociá los productos que este proveedor puede entregar y su
              precio de costo. Los productos asociados aparecerán en la
              compra.
            </p>

            <div className="productos-proveedor-lista">
              {filas.map((fila) => {
                const producto = fila.productoObjeto
                const erroresFila = {
                  ...(erroresCalculados[fila.id] || {}),
                  ...(erroresServidor[fila.id] || {}),
                }
                return (
                  <div className="productos-proveedor-fila" key={fila.id}>
                    <CampoSelectorBuscable
                      etiqueta="Producto *"
                      valor={fila.producto}
                      onCambiar={(valor, opcion) =>
                        actualizarFila(
                          fila.id,
                          'producto',
                          valor,
                          opcion,
                        )
                      }
                      opciones={[]}
                      opcionSeleccionada={fila.productoObjeto}
                      onBuscar={buscarProductos}
                      textoOpcion={(item) => item.nombre}
                      textoSecundario={(item) =>
                        `${item.codigo} · ${item.categoria_detalle}`
                      }
                      placeholder="Buscar producto por código o nombre"
                      deshabilitado={fila.existente}
                      error={Boolean(erroresFila.producto)}
                      mensajeError={erroresFila.producto}
                    />
                    <label className="campo-comercial">
                      <span>Precio de costo *</span>
                      <input
                        type="number"
                        className={`input-tabla ${
                          erroresFila.precio ? 'input-error' : ''
                        }`}
                        min="0.01"
                        step="0.01"
                        value={fila.precio}
                        onChange={(evento) =>
                          actualizarFila(
                            fila.id,
                            'precio',
                            evento.target.value,
                          )
                        }
                      />
                      <MensajeError>{erroresFila.precio}</MensajeError>
                      {producto && (
                        <small className="campo-ayuda">
                          Venta: {formatearMoneda(producto.precio_unidad)}
                        </small>
                      )}
                    </label>
                    <label className="campo-comercial">
                      <span>Código del proveedor</span>
                      <input
                        type="text"
                        className={`input-tabla ${
                          erroresFila.codigo ? 'input-error' : ''
                        }`}
                        value={fila.codigo}
                        onChange={(evento) =>
                          actualizarFila(
                            fila.id,
                            'codigo',
                            evento.target.value,
                          )
                        }
                      />
                      <MensajeError>{erroresFila.codigo}</MensajeError>
                    </label>
                    <div className="productos-proveedor-accion">
                      {!fila.existente && filas.length > 1 && (
                        <button
                          type="button"
                          className="boton-icono boton-icono-peligro"
                          onClick={() => quitarFila(fila.id)}
                          title="Quitar producto"
                        >
                          <IconTrash size={17} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <MensajeError>{errorLista}</MensajeError>

            <button
              type="button"
              className="boton-comercial-secundario productos-proveedor-agregar"
              onClick={agregarFila}
            >
              <IconPlus size={17} />
              Agregar otro producto
            </button>

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={onCerrar}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="boton-comercial-primario"
                disabled={guardando || !formularioValido}
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    Guardando…
                  </>
                ) : (
                  'Guardar productos'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
