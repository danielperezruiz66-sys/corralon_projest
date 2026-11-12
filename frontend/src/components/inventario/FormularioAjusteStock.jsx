import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconAdjustments, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { formatearNumero } from '../../utils/formato'
import {
  unidadPermiteDecimales,
  validarCantidadPorUnidad,
  validarTexto,
} from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'

export default function FormularioAjusteStock({
  stock,
  depositos = [],
  onCerrar,
  onGuardado,
}) {
  const [cantidad, setCantidad] = useState(stock.cantidad || '0.000')
  const [deposito, setDeposito] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  const unidad = stock.producto_unidad_detalle || ''
  const permiteDecimales = unidadPermiteDecimales(unidad)
  const actual = Number(stock.cantidad)
  const nueva = Number(cantidad)
  const diferencia = Number.isFinite(nueva) ? nueva - actual : 0

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    const errorCantidad = validarCantidadPorUnidad(
      cantidad,
      unidad,
      'La cantidad',
    )
    if (errorCantidad && !(cantidad !== '' && Number(cantidad) === 0 && permiteDecimales === permiteDecimales)) {
      // permitir 0 solo si pasa regla? cantidad 0 puede ser válido para ajuste (dejar en 0) si entero permitido
    }
    if (!errorCantidad && !permiteDecimales && !Number.isInteger(Number(cantidad))) {
      nuevos.cantidad = 'La cantidad debe ser un número entero para esta unidad.'
    } else if (errorCantidad) {
      // validarCantidadPorUnidad exige mayor que cero; pero ajuste permite 0 o valores según negocio, revalidar manualmente
      const num = Number(String(cantidad).replace(',', '.'))
      if (String(cantidad).trim() === '' || !Number.isFinite(num)) {
        nuevos.cantidad = 'Ingresá la cantidad.'
      } else if (num < 0) {
        nuevos.cantidad = 'La cantidad no puede ser negativa.'
      } else if (!permiteDecimales && !Number.isInteger(num)) {
        nuevos.cantidad = 'La cantidad debe ser un número entero para esta unidad.'
      } else if (permiteDecimales) {
        const partes = String(cantidad).replace(',', '.').split('.')
        if (partes[1] && partes[1].length > 3) {
          nuevos.cantidad = 'La cantidad admite hasta 3 decimales.'
        }
      }
    }
    const errorMotivo = validarTexto(motivo, 'El motivo', {
      min: 3,
      max: 90,
    })
    if (errorMotivo) {
      nuevos.motivo = errorMotivo
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
      const actualizado = await pedir(`/stocks/${stock.id}/ajustar/`, {
        method: 'POST',
        body: JSON.stringify({
          cantidad: Number(cantidad).toFixed(3),
          deposito: deposito ? Number(deposito) : null,
          motivo: motivo.trim(),
        }),
      })
      onGuardado?.(actualizado)
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
        title: 'No se pudo ajustar',
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
            <IconAdjustments size={24} />
            Ajustar stock
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

        <div className="cobro-resumen">
          <div>
            <span>Producto</span>
            <strong>{stock.producto_detalle}</strong>
          </div>
          <div>
            <span>Sucursal</span>
            <strong>{stock.sucursal_detalle}</strong>
          </div>
          <div>
            <span>Stock actual</span>
            <strong>{formatearNumero(stock.cantidad)}</strong>
          </div>
        </div>

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <label className="campo-comercial">
            <span>Nueva cantidad *</span>
            <input
              type="number"
              className={errores.cantidad ? 'input-error' : ''}
              min={permiteDecimales ? '0' : '0'}
              step={permiteDecimales ? '0.001' : '1'}
              value={cantidad}
              onChange={(evento) => setCantidad(evento.target.value)}
            />
            <MensajeError>{errores.cantidad}</MensajeError>
          </label>

          <CampoSelectorBuscable
            etiqueta="Depósito para el ingreso"
            valor={deposito}
            onCambiar={setDeposito}
            opciones={depositos}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) => item.sucursal_detalle || ''}
            placeholder="Depósito predeterminado"
          />

          <label className="campo-comercial ancho-completo">
            <span>Motivo *</span>
            <input
              type="text"
              className={errores.motivo ? 'input-error' : ''}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ej. Conteo físico, merma, rotura"
              maxLength={90}
            />
            <MensajeError>{errores.motivo}</MensajeError>
          </label>

          <p className="comercial-nota ancho-completo">
            Diferencia: {diferencia > 0 ? '+' : ''}
            {formatearNumero(diferencia)}. El ajuste queda registrado como
            movimiento <strong>AJ</strong>.
          </p>

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
              disabled={guardando || diferencia === 0}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Ajustando…
                </>
              ) : (
                'Confirmar ajuste'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
