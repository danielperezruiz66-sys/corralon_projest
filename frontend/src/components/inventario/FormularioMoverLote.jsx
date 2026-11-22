import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconArrowsExchange, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { formatearNumero } from '../../utils/formato'
import MensajeError from '../common/MensajeError.jsx'

export default function FormularioMoverLote({
  detalle,
  sucursal,
  depositos = [],
  onCerrar,
  onGuardado,
}) {
  // El lote se mueve completo dentro de la misma sucursal: se ofrecen los
  // depósitos de la sucursal del stock, sin el depósito donde ya está.
  const destinos = depositos.filter(
    (item) =>
      Number(item.sucursal) === Number(sucursal) &&
      Number(item.id) !== Number(detalle?.deposito),
  )
  const [destino, setDestino] = useState(
    destinos.length > 0 ? String(destinos[0].id) : '',
  )
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (!destino) {
      nuevos.deposito = 'Elegí un depósito destino distinto del actual.'
    }
    if (motivo.trim().length < 3) {
      nuevos.motivo = 'Indicá el motivo del movimiento (mínimo 3 caracteres).'
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
      await pedir(`/detalles-stock/${detalle.id}/mover/`, {
        method: 'POST',
        body: JSON.stringify({
          deposito: Number(destino),
          motivo: motivo.trim(),
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Lote movido',
        text: 'El lote completo ya está en el depósito destino.',
        timer: 1500,
        showConfirmButton: false,
      })
      onGuardado?.()
    } catch (e) {
      if (e.campos) {
        setErrores(e.campos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo mover el lote',
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
            <IconArrowsExchange size={24} />
            Mover lote {detalle?.lote}
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

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <p className="comercial-nota ancho-completo">
            Se traslada el <strong>lote completo</strong> a otro depósito de la
            misma sucursal (no se puede mover una parte). El movimiento queda
            auditado con el motivo indicado.
          </p>

          <p className="comercial-nota ancho-completo">
            Lote <strong>{detalle?.lote || '—'}</strong> ·{' '}
            {formatearNumero(detalle?.cantidad)} unidades en{' '}
            <strong>{detalle?.deposito_detalle || '—'}</strong>
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Depósito destino *</span>
            <select
              className={errores.deposito ? 'input-error' : ''}
              value={destino}
              onChange={(evento) => setDestino(evento.target.value)}
              disabled={destinos.length === 0}
            >
              {destinos.length === 0 && (
                <option value="">
                  No hay otro depósito en esta sucursal
                </option>
              )}
              {destinos.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nombre}
                  {item.es_predeterminado ? ' (predeterminado)' : ''}
                </option>
              ))}
            </select>
            <MensajeError>{errores.deposito}</MensajeError>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Motivo *</span>
            <textarea
              rows={3}
              className={errores.motivo ? 'input-error' : ''}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Por qué se mueve el lote (mínimo 3 caracteres)"
            />
            <MensajeError>{errores.motivo}</MensajeError>
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
              disabled={guardando || destinos.length === 0}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Moviendo…
                </>
              ) : (
                <>
                  <IconArrowsExchange size={18} />
                  Mover lote
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
