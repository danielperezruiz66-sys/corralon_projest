import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconCash, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { useSucursal } from '../../context/sucursal-context'
import MensajeError from '../common/MensajeError.jsx'
import { validarNumero } from '../../utils/validaciones'

const ESTADOS = [
  { id: 'AC', etiqueta: 'Activa' },
  { id: 'IN', etiqueta: 'Inactiva' },
  { id: 'MT', etiqueta: 'En mantenimiento' },
]

const MAXIMO_NUMERO_CAJA = 999999

function errorNumeroCaja(valor, cajas, cajaActual, sucursalId) {
  const error = validarNumero(valor, {
    etiqueta: 'El número de caja',
    mayorQueCero: true,
    decimales: 0,
    maximo: MAXIMO_NUMERO_CAJA,
  })
  if (error) {
    return error
  }
  const numero = Number(valor)
  const repetida = (cajas || []).some(
    (otra) =>
      Number(otra.numero_caja) === numero &&
      (!sucursalId || Number(otra.sucursal) === Number(sucursalId)) &&
      (!cajaActual?.id || Number(otra.id) !== Number(cajaActual.id)),
  )
  return repetida ? 'Ya existe una caja con ese número.' : ''
}

function esErrorDeDuplicado(error) {
  const texto = `${error?.message || ''}`.toLowerCase()
  const sinCampo = error?.datos?.non_field_errors
  const detalle = Array.isArray(sinCampo)
    ? sinCampo.join(' ').toLowerCase()
    : String(sinCampo || '').toLowerCase()
  return (
    texto.includes('unique set') ||
    detalle.includes('unique set') ||
    texto.includes('ya existe una caja')
  )
}

export default function FormularioCaja({
  caja = null,
  cajas = [],
  onCerrar,
  onGuardado,
}) {
  const esEdicion = Boolean(caja?.id)
  const { sucursalActiva } = useSucursal()
  const [numeroCaja, setNumeroCaja] = useState(
    caja?.numero_caja !== undefined && caja?.numero_caja !== null
      ? String(caja.numero_caja)
      : '',
  )
  const [estado, setEstado] = useState(caja?.estado || 'AC')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  const errorActual = errorNumeroCaja(
    numeroCaja,
    cajas,
    caja,
    sucursalActiva,
  )
  const formularioInvalido = Boolean(errorActual)

  function cambiarNumero(evento) {
    const valor = evento.target.value
    setNumeroCaja(valor)
    const mensaje = errorNumeroCaja(valor, cajas, caja, sucursalActiva)
    setErrores((previos) => {
      const siguientes = { ...previos }
      if (mensaje) {
        siguientes.numero_caja = mensaje
      } else {
        delete siguientes.numero_caja
      }
      return siguientes
    })
  }

  async function guardar(evento) {
    evento.preventDefault()
    const error = errorNumeroCaja(
      numeroCaja,
      cajas,
      caja,
      sucursalActiva,
    )
    if (error) {
      setErrores({ numero_caja: error })
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    if (!sucursalActiva) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar la caja',
        text: 'Faltan datos de configuración de tu usuario. Contactá al administrador.',
        confirmButtonColor: '#4a9da8',
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
            sucursal: Number(sucursalActiva),
            numero_caja: Number(numeroCaja),
            estado,
          }),
        },
      )
      onGuardado?.(guardada, esEdicion)
    } catch (e) {
      const campos = { ...(e.campos || {}) }
      if (esErrorDeDuplicado(e)) {
        campos.numero_caja = 'Ya existe una caja con ese número.'
      }
      if (Object.keys(campos).length > 0) {
        setErrores(campos)
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
            El número de caja no se puede repetir dentro de la sucursal.
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Número de caja *</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={MAXIMO_NUMERO_CAJA}
              step="1"
              className={errores.numero_caja ? 'input-error' : ''}
              value={numeroCaja}
              onChange={cambiarNumero}
              placeholder="1"
              aria-invalid={Boolean(errores.numero_caja)}
            />
            <MensajeError>{errores.numero_caja}</MensajeError>
            {!errores.numero_caja && (
              <small className="caja-nota-total">
                Ingresá un número entero del 1 al {MAXIMO_NUMERO_CAJA}.
              </small>
            )}
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
              disabled={guardando || formularioInvalido}
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
