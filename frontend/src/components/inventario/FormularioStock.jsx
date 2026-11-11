import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconAdjustments, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { formatearNumero } from '../../utils/formato'
import MensajeError from '../common/MensajeError.jsx'

export default function FormularioStock({
  stock,
  onCerrar,
  onGuardado,
}) {
  const [cantMin, setCantMin] = useState(stock.cant_min || '0.000')
  const [cantNegativa, setCantNegativa] = useState(
    stock.cant_negativa_max || '0.000',
  )
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (!Number.isFinite(Number(cantMin))) {
      nuevos.cantMin = 'Ingresá un número válido.'
    } else if (Number(cantMin) < 0) {
      nuevos.cantMin = 'El stock mínimo no puede ser negativo.'
    }
    if (!Number.isFinite(Number(cantNegativa))) {
      nuevos.cantNegativa = 'Ingresá un número válido.'
    } else if (Number(cantNegativa) > 0) {
      nuevos.cantNegativa =
        'El límite negativo no puede ser mayor a cero.'
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
      const actualizado = await pedir(`/stocks/${stock.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          cant_min: Number(cantMin).toFixed(3),
          cant_negativa_max: Number(cantNegativa).toFixed(3),
        }),
      })
      onGuardado?.(actualizado)
    } catch (e) {
      if (e.campos) {
        const mapa = {
          cant_min: 'cantMin',
          cant_negativa_max: 'cantNegativa',
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
        title: 'No se pudo actualizar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-chico">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconAdjustments size={24} />
            Configurar stock
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
          {stock.producto_detalle} · {stock.sucursal_detalle}
          <br />
          Stock actual: {formatearNumero(stock.cantidad)}
        </p>

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <label className="campo-comercial">
            <span>Stock mínimo</span>
            <input
              type="number"
              className={errores.cantMin ? 'input-error' : ''}
              min="0"
              step="0.001"
              value={cantMin}
              onChange={(evento) => setCantMin(evento.target.value)}
            />
            <MensajeError>{errores.cantMin}</MensajeError>
          </label>

          <label className="campo-comercial">
            <span>Límite negativo</span>
            <input
              type="number"
              className={errores.cantNegativa ? 'input-error' : ''}
              max="0"
              step="0.001"
              value={cantNegativa}
              onChange={(evento) => setCantNegativa(evento.target.value)}
            />
            <MensajeError>{errores.cantNegativa}</MensajeError>
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
                'Guardar configuración'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
