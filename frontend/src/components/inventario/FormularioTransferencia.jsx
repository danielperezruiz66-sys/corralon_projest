import { useCallback, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { IconArrowsExchange, IconLoader2, IconX } from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import {
  unidadPermiteDecimales,
  validarCantidadPorUnidad,
} from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'
import { formatearFecha, formatearNumero } from '../../utils/formato'

export default function FormularioTransferencia({
  depositos = [],
  productoInicial = '',
  productoInicialDetalle = null,
  depositoOrigenInicial = '',
  onCerrar,
  onGuardado,
}) {
  const [producto, setProducto] = useState(
    productoInicial ? String(productoInicial) : '',
  )
  const [productoSeleccionado, setProductoSeleccionado] = useState(
    productoInicialDetalle || null,
  )
  const [origen, setOrigen] = useState(
    depositoOrigenInicial ? String(depositoOrigenInicial) : '',
  )
  const [destino, setDestino] = useState('')
  const [detalleOrigen, setDetalleOrigen] = useState('')
  const [detalles, setDetalles] = useState([])
  const [cargandoDetalles, setCargandoDetalles] = useState(false)
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  const unidad = productoSeleccionado?.unidad_detalle || ''
  const permiteDecimales = unidadPermiteDecimales(unidad)
  const detalleSeleccionado = detalles.find(
    (item) => String(item.id) === String(detalleOrigen),
  )

  const buscarProductos = useCallback(async (texto) => {
    const respuesta = await pedir(
      `/productos/?search=${encodeURIComponent(texto)}&page=1`,
    )
    return respuesta.results || []
  }, [])

  useEffect(() => {
    let vigente = true
    async function cargarDetalles() {
      if (!producto || !origen) {
        setDetalles([])
        setDetalleOrigen('')
        return
      }
      const deposito = depositos.find(
        (item) => String(item.id) === String(origen),
      )
      if (!deposito?.sucursal) {
        setDetalles([])
        setDetalleOrigen('')
        return
      }
      setCargandoDetalles(true)
      try {
        const stocks = await pedirTodas(
          `/stocks/?producto=${producto}&sucursal=${deposito.sucursal}`,
        )
        const stock = stocks[0]
        if (!stock) {
          if (vigente) {
            setDetalles([])
            setDetalleOrigen('')
          }
          return
        }
        const lotes = await pedirTodas(
          `/detalles-stock/?stock=${stock.id}&deposito=${origen}`,
        )
        const disponibles = lotes.filter(
          (item) => Number(item.cantidad) > 0,
        )
        if (vigente) {
          setDetalles(disponibles)
          setDetalleOrigen((actual) =>
            disponibles.some((item) => String(item.id) === String(actual))
              ? actual
              : '',
          )
        }
      } catch {
        if (vigente) {
          setDetalles([])
          setDetalleOrigen('')
        }
      } finally {
        if (vigente) {
          setCargandoDetalles(false)
        }
      }
    }
    cargarDetalles()
    return () => {
      vigente = false
    }
  }, [producto, origen, depositos])

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (!producto) {
      nuevos.producto = 'Seleccioná un producto.'
    }
    if (!origen) {
      nuevos.origen = 'Seleccioná el depósito de origen.'
    }
    if (!destino) {
      nuevos.destino = 'Seleccioná el depósito de destino.'
    }
    if (!detalleOrigen) {
      nuevos.detalle_origen = 'Seleccioná el lote de origen.'
    }
    const errorCantidad = validarCantidadPorUnidad(
      cantidad,
      unidad,
      'La cantidad',
    )
    if (errorCantidad) {
      nuevos.cantidad = errorCantidad
    } else if (
      detalleSeleccionado &&
      Number(cantidad) > Number(detalleSeleccionado.cantidad)
    ) {
      nuevos.cantidad = `La cantidad supera el disponible del lote (${formatearNumero(detalleSeleccionado.cantidad)}).`
    }
    if (origen && destino && origen === destino) {
      nuevos.destino = 'El depósito de destino debe ser distinto al origen.'
    }
    const motivoTexto = motivo.trim()
    if (!motivoTexto) {
      nuevos.motivo = 'Indicá el motivo de la transferencia.'
    }
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErrores({})
    setGuardando(true)
    try {
      const creada = await pedir('/transferencias-stock/', {
        method: 'POST',
        body: JSON.stringify({
          detalle_origen: Number(detalleOrigen),
          deposito_destino: Number(destino),
          cantidad: Number(cantidad).toFixed(3),
          motivo: motivoTexto,
        }),
      })
      onGuardado?.(creada)
    } catch (e) {
      if (e.campos) {
        setErrores(e.campos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo crear la transferencia',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconArrowsExchange size={24} />
            Nueva transferencia
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

        <p className="comercial-nota">
          El stock sale del lote de origen y queda en tránsito hasta que se
          confirme la recepción. En destino se genera un nuevo lote con nota
          automática del origen (el lote lo define el sistema).
        </p>

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <CampoSelectorBuscable
            etiqueta="Producto *"
            valor={producto}
            onCambiar={(valor, opcion) => {
              setProducto(valor)
              setProductoSeleccionado(opcion || null)
              setDetalleOrigen('')
            }}
            opciones={[]}
            opcionSeleccionada={productoSeleccionado}
            onBuscar={buscarProductos}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) =>
              `${item.codigo} · ${item.unidad_detalle || ''}`
            }
            placeholder="Buscar por código o nombre"
            error={Boolean(errores.producto)}
            mensajeError={errores.producto}
          />

          <CampoSelectorBuscable
            etiqueta="Depósito origen *"
            valor={origen}
            onCambiar={(valor) => {
              setOrigen(valor)
              setDetalleOrigen('')
            }}
            opciones={depositos}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) => item.sucursal_detalle || ''}
            placeholder="Buscar depósito"
            error={Boolean(errores.origen || errores.deposito_origen)}
            mensajeError={errores.origen || errores.deposito_origen}
          />

          <CampoSelectorBuscable
            etiqueta="Lote de origen *"
            valor={detalleOrigen}
            onCambiar={setDetalleOrigen}
            opciones={detalles}
            textoOpcion={(item) => `${item.lote} · disp. ${formatearNumero(item.cantidad)}`}
            textoSecundario={(item) =>
              item.fecha_venc ? `Vence ${formatearFecha(item.fecha_venc)}` : 'Sin vencimiento'
            }
            placeholder={
              cargandoDetalles
                ? 'Cargando lotes…'
                : producto && origen
                  ? 'Seleccioná un lote disponible'
                  : 'Elegí producto y depósito de origen'
            }
            error={Boolean(errores.detalle_origen)}
            mensajeError={errores.detalle_origen}
          />

          <CampoSelectorBuscable
            etiqueta="Depósito destino *"
            valor={destino}
            onCambiar={setDestino}
            opciones={depositos.filter(
              (item) => String(item.id) !== String(origen),
            )}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) => item.sucursal_detalle || ''}
            placeholder="Buscar depósito"
            error={Boolean(errores.destino || errores.deposito_destino)}
            mensajeError={errores.destino || errores.deposito_destino}
          />

          <label className="campo-comercial">
            <span>Cantidad *</span>
            <input
              type="number"
              className={errores.cantidad ? 'input-error' : ''}
              min={permiteDecimales ? '0.001' : '1'}
              step={permiteDecimales ? '0.001' : '1'}
              max={detalleSeleccionado ? detalleSeleccionado.cantidad : undefined}
              value={cantidad}
              onChange={(evento) => setCantidad(evento.target.value)}
            />
            <MensajeError>{errores.cantidad}</MensajeError>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Motivo *</span>
            <input
              type="text"
              className={errores.motivo ? 'input-error' : ''}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ej. Reposición de sucursal"
              maxLength={300}
            />
            <MensajeError>{errores.motivo}</MensajeError>
            {detalleSeleccionado && (
              <small className="ayuda-campo">
                Se agregará automáticamente la nota de origen: lote{' '}
                {detalleSeleccionado.lote}.
              </small>
            )}
          </label>

          <div className="comercial-modal-acciones ancho-completo">
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
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Creando…
                </>
              ) : (
                'Crear transferencia'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
