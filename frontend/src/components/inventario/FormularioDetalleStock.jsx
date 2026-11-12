import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconDeviceFloppy, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'

function notaAutomatica(texto) {
  const valor = String(texto || '')
  if (!valor.startsWith('Transferido de ')) {
    return ''
  }
  return valor.split('\n', 1)[0].trim()
}

export default function FormularioDetalleStock({
  detalle,
  onCerrar,
  onGuardado,
}) {
  const automatica = notaAutomatica(detalle?.observaciones)
  const [fechaVenc, setFechaVenc] = useState(detalle?.fecha_venc || '')
  const [observaciones, setObservaciones] = useState(
    detalle?.observaciones || '',
  )
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (automatica && !String(observaciones || '').trim().startsWith(automatica)) {
      nuevos.observaciones =
        'La nota automática de origen no se puede modificar ni eliminar.'
    }
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      return
    }
    setErrores({})
    setGuardando(true)
    try {
      await pedir(`/detalles-stock/${detalle.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          fecha_venc: fechaVenc || null,
          observaciones: observaciones,
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Lote actualizado',
        timer: 1400,
        showConfirmButton: false,
      })
      onGuardado?.()
    } catch (e) {
      if (e.campos) {
        setErrores(e.campos)
      } else {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo actualizar el lote',
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
          <h2>Editar lote {detalle?.lote}</h2>
          <button
            type="button"
            className="comercial-modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <p className="comercial-nota ancho-completo">
            Solo podés editar la fecha de vencimiento y observaciones. Si el
            lote tiene nota automática de origen, no se puede eliminar.
          </p>

          <label className="campo-comercial">
            <span>Fecha de vencimiento</span>
            <input
              type="date"
              value={fechaVenc || ''}
              onChange={(evento) => setFechaVenc(evento.target.value)}
            />
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Observaciones</span>
            <textarea
              rows={4}
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              placeholder={
                automatica
                  ? 'Podés agregar observaciones debajo de la nota automática.'
                  : 'Observaciones del lote'
              }
            />
            <MensajeError>{errores.observaciones}</MensajeError>
            {automatica && (
              <small className="ayuda-campo">
                Nota automática (inborrable): {automatica}
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
                  Guardando…
                </>
              ) : (
                <>
                  <IconDeviceFloppy size={18} />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
