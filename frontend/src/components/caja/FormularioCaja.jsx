import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconCash, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'
import { validarTexto } from '../../utils/validaciones'

const ESTADOS = [
  { id: 'AC', etiqueta: 'Activa' },
  { id: 'IN', etiqueta: 'Inactiva' },
  { id: 'MT', etiqueta: 'En mantenimiento' },
]

export default function FormularioCaja({ caja = null, onCerrar, onGuardado }) {
  const esEdicion = Boolean(caja?.id)
  const [nombre, setNombre] = useState(caja?.nombre || '')
  const [estado, setEstado] = useState(caja?.estado || 'AC')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}

    const errorNombre = validarTexto(nombre, 'El nombre', { min: 1, max: 50 })
    if (errorNombre) {
      nuevos.nombre = errorNombre
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
            nombre: nombre.trim(),
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
            {esEdicion ? 'Editar caja física' : 'Nueva caja física'}
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
            Una caja física puede habilitarse en varias sucursales. El conteo
            de dinero vive en cada seccion de caja.
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Nombre de la caja *</span>
            <input
              type="text"
              className={errores.nombre ? 'input-error' : ''}
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Caja 1"
              maxLength="50"
            />
            <MensajeError>{errores.nombre}</MensajeError>
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
