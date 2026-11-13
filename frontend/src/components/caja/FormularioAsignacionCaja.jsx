import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconBuildingWarehouse, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'

export default function FormularioAsignacionCaja({
  asignacion = null,
  cajas,
  sucursales,
  onCerrar,
  onGuardado,
}) {
  const esEdicion = Boolean(asignacion?.id)
  const [caja, setCaja] = useState(
    asignacion?.caja ? String(asignacion.caja) : String(cajas[0]?.id ?? ''),
  )
  const [sucursal, setSucursal] = useState(
    asignacion?.sucursal
      ? String(asignacion.sucursal)
      : String(sucursales[0]?.id ?? ''),
  )
  const [habilitada, setHabilitada] = useState(asignacion?.habilitada ?? true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}

    if (!caja) {
      nuevos.caja = 'Elegí una caja física.'
    }
    if (!sucursal) {
      nuevos.sucursal = 'Elegí una sucursal.'
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
        esEdicion
          ? `/sucursales-cajas/${asignacion.id}/`
          : '/sucursales-cajas/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({
            caja: Number(caja),
            sucursal: Number(sucursal),
            habilitada,
          }),
        },
      )
      onGuardado?.(guardada, esEdicion)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar la asignación',
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
            <IconBuildingWarehouse size={24} />
            {esEdicion ? 'Editar asignación' : 'Asignar caja a sucursal'}
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
            Habilita la caja física para operar en la sucursal seleccionada.
            Una misma caja puede estar asignada a varias sucursales.
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Caja fisica *</span>
            <select
              className={errores.caja ? 'input-error' : ''}
              value={caja}
              onChange={(evento) => setCaja(evento.target.value)}
            >
              {cajas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
            <MensajeError>{errores.caja}</MensajeError>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Sucursal *</span>
            <select
              className={errores.sucursal ? 'input-error' : ''}
              value={sucursal}
              onChange={(evento) => setSucursal(evento.target.value)}
            >
              {sucursales.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
            <MensajeError>{errores.sucursal}</MensajeError>
          </label>

          <label className="campo-checkbox ancho-completo">
            <input
              type="checkbox"
              checked={habilitada}
              onChange={(evento) => setHabilitada(evento.target.checked)}
            />
            <span>Habilitada para abrir secciones</span>
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
                'Guardar asignación'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
