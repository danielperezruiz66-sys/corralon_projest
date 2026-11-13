import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconCash, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'

export default function FormularioAperturaSeccion({
  sucursalActiva,
  sucursalNombre,
  cajasDisponibles,
  onCerrar,
  onGuardado,
}) {
  const [caja, setCaja] = useState(() =>
    cajasDisponibles.length > 0 ? String(cajasDisponibles[0].caja) : '',
  )
  const [montoInicial, setMontoInicial] = useState('0')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const valorActual =
    caja ||
    (cajasDisponibles.length > 0 ? String(cajasDisponibles[0].caja) : '')

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}

    if (!valorActual) {
      nuevos.caja = 'Elegí una caja física.'
    }

    const monto = Number(montoInicial)
    if (montoInicial === '' || Number.isNaN(monto) || monto < 0) {
      nuevos.monto_inicial = 'El monto inicial debe ser mayor o igual a cero.'
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
      const guardada = await pedir('/secciones-caja/', {
        method: 'POST',
        body: JSON.stringify({
          caja: Number(valorActual),
          sucursal: Number(sucursalActiva),
          monto_inicial: montoInicial,
        }),
      })
      onGuardado?.(guardada, false)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo abrir la seccion',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  const sinDisponibles = cajasDisponibles.length === 0

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-angosto">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconCash size={24} />
            Abrir seccion de caja
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
          <p className="caja-nota-total ancho-completo">
            Se abrirá en <strong>{sucursalNombre}</strong>. La misma caja física
            puede estar abierta a la vez en otra sucursal.
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Caja fisica *</span>
            <select
              className={errores.caja ? 'input-error' : ''}
              value={valorActual}
              onChange={(evento) => setCaja(evento.target.value)}
              disabled={sinDisponibles}
            >
              {sinDisponibles ? (
                <option value="">No hay cajas disponibles</option>
              ) : (
                cajasDisponibles.map((disponible) => (
                  <option key={disponible.id} value={disponible.caja}>
                    {disponible.caja_detalle}
                  </option>
                ))
              )}
            </select>
            <MensajeError>{errores.caja}</MensajeError>
            {sinDisponibles && (
              <p className="caja-nota-total">
                Todas las cajas físicas habilitadas en esta sucursal ya tienen
                una seccion abierta. Cerrá una para poder abrir otra.
              </p>
            )}
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Monto inicial</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={errores.monto_inicial ? 'input-error' : ''}
              value={montoInicial}
              onChange={(evento) => setMontoInicial(evento.target.value)}
            />
            <MensajeError>{errores.monto_inicial}</MensajeError>
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
              disabled={guardando || sinDisponibles}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Abriendo…
                </>
              ) : (
                'Abrir seccion'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
