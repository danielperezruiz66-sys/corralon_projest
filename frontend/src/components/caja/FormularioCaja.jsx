import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconCash, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'
import { validarNumero } from '../../utils/validaciones'

const ESTADOS = [
  { id: 'AC', etiqueta: 'Activa' },
  { id: 'IN', etiqueta: 'Inactiva' },
  { id: 'MT', etiqueta: 'En mantenimiento' },
]

export default function FormularioCaja({
  caja = null,
  sucursales = [],
  sucursalPorDefecto = '',
  onCerrar,
  onGuardado,
}) {
  const esEdicion = Boolean(caja?.id)
  const [sucursal, setSucursal] = useState(
    caja?.sucursal
      ? String(caja.sucursal)
      : String(sucursalPorDefecto || sucursales[0]?.id || ''),
  )
  const [numeroCaja, setNumeroCaja] = useState(
    caja?.numero_caja !== undefined && caja?.numero_caja !== null
      ? String(caja.numero_caja)
      : '',
  )
  const [estado, setEstado] = useState(caja?.estado || 'AC')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}

    if (!sucursal) {
      nuevos.sucursal = 'Elegí la sucursal de la caja.'
    }

    const errorNumero = validarNumero(numeroCaja, {
      etiqueta: 'El número de caja',
      mayorQueCero: true,
      decimales: 0,
      maximo: 999999,
    })
    if (errorNumero) {
      nuevos.numero_caja = errorNumero
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
      const guardada = await pedir(
        esEdicion ? `/cajas/${caja.id}/` : '/cajas/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({
            sucursal: Number(sucursal),
            numero_caja: Number(numeroCaja),
            estado,
          }),
        },
      )
      onGuardado?.(guardada, esEdicion)
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
        title: 'No se pudo guardar la caja',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-angosto">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconCash size={24} />
            {esEdicion ? 'Editar caja' : 'Nueva caja'}
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
            Cada caja pertenece a una sucursal y se numera dentro de ella. El
            número no se puede repetir en la misma sucursal.
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Sucursal *</span>
            <select
              className={errores.sucursal ? 'input-error' : ''}
              value={sucursal}
              onChange={(evento) => setSucursal(evento.target.value)}
              disabled={sucursales.length === 0}
            >
              {sucursales.length === 0 ? (
                <option value="">No hay sucursales</option>
              ) : (
                sucursales.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))
              )}
            </select>
            <MensajeError>{errores.sucursal}</MensajeError>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Número de caja *</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              className={errores.numero_caja ? 'input-error' : ''}
              value={numeroCaja}
              onChange={(evento) => setNumeroCaja(evento.target.value)}
              placeholder="1"
            />
            <MensajeError>{errores.numero_caja}</MensajeError>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Estado</span>
            <select
              value={estado}
              onChange={(evento) => setEstado(evento.target.value)}
            >
              {ESTADOS.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
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
                'Guardar caja'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
