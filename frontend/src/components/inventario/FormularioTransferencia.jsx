import { useCallback, useState } from 'react'
import Swal from 'sweetalert2'
import { IconArrowsExchange, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { validarNumero } from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'

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
  const [origen, setOrigen] = useState(
    depositoOrigenInicial ? String(depositoOrigenInicial) : '',
  )
  const [destino, setDestino] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [lote, setLote] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  const buscarProductos = useCallback(async (texto) => {
    const respuesta = await pedir(
      `/productos/?search=${encodeURIComponent(texto)}&page=1`,
    )
    return respuesta.results || []
  }, [])

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
    const errorCantidad = validarNumero(cantidad, {
      etiqueta: 'La cantidad',
      mayorQueCero: true,
      decimales: 3,
    })
    if (errorCantidad) {
      nuevos.cantidad = errorCantidad
    }
    if (origen && destino && origen === destino) {
      nuevos.destino = 'El depósito de destino debe ser distinto al origen.'
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
          producto: Number(producto),
          deposito_origen: Number(origen),
          deposito_destino: Number(destino),
          cantidad: Number(cantidad).toFixed(3),
          lote: lote.trim() || null,
          motivo: motivo.trim(),
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
          El stock sale del depósito de origen y queda en tránsito hasta que se
          confirme la recepción. El destino puede ser de otra sucursal.
        </p>

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <CampoSelectorBuscable
            etiqueta="Producto *"
            valor={producto}
            onCambiar={setProducto}
            opciones={[]}
            opcionSeleccionada={productoInicialDetalle}
            onBuscar={buscarProductos}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) =>
              `${item.codigo} · ${item.unidad_detalle}`
            }
            placeholder="Buscar por código o nombre"
            error={Boolean(errores.producto)}
            mensajeError={errores.producto}
          />

          <CampoSelectorBuscable
            etiqueta="Depósito origen *"
            valor={origen}
            onCambiar={setOrigen}
            opciones={depositos}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) => item.sucursal_detalle || ''}
            placeholder="Buscar depósito"
            error={Boolean(errores.origen)}
            mensajeError={errores.origen}
          />

          <CampoSelectorBuscable
            etiqueta="Depósito destino *"
            valor={destino}
            onCambiar={setDestino}
            opciones={depositos}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) => item.sucursal_detalle || ''}
            placeholder="Buscar depósito"
            error={Boolean(errores.destino)}
            mensajeError={errores.destino}
          />

          <label className="campo-comercial">
            <span>Cantidad *</span>
            <input
              type="number"
              className={errores.cantidad ? 'input-error' : ''}
              min="0.001"
              step="0.001"
              value={cantidad}
              onChange={(evento) => setCantidad(evento.target.value)}
            />
            <MensajeError>{errores.cantidad}</MensajeError>
          </label>

          <label className="campo-comercial">
            <span>Lote</span>
            <input
              type="text"
              value={lote}
              onChange={(evento) => setLote(evento.target.value)}
              placeholder="Opcional"
            />
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Motivo</span>
            <input
              type="text"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ej. Reposición de sucursal"
            />
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
