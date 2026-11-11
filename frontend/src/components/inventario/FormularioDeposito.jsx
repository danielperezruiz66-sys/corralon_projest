import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconBuildingWarehouse, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { validarTexto } from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'

export default function FormularioDeposito({
  deposito = null,
  sucursales = [],
  sucursalActiva = '',
  onCerrar,
  onGuardado,
}) {
  const [sucursal, setSucursal] = useState(
    deposito?.sucursal
      ? String(deposito.sucursal)
      : sucursalActiva
        ? String(sucursalActiva)
        : '',
  )
  const [nombre, setNombre] = useState(deposito?.nombre || '')
  const [descripcion, setDescripcion] = useState(deposito?.descripcion || '')
  const [predeterminado, setPredeterminado] = useState(
    Boolean(deposito?.es_predeterminado),
  )
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const esEdicion = Boolean(deposito?.id)

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (!sucursal) {
      nuevos.sucursal = 'Seleccioná la sucursal.'
    }
    const errorNombre = validarTexto(nombre, 'El nombre', {
      min: 2,
      max: 80,
    })
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
      const guardado = await pedir(
        esEdicion ? `/depositos/${deposito.id}/` : '/depositos/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({
            sucursal: Number(sucursal),
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            es_predeterminado: predeterminado,
          }),
        },
      )
      onGuardado?.(guardado, esEdicion)
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
        title: 'No se pudo guardar',
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
            <IconBuildingWarehouse size={24} />
            {esEdicion ? 'Editar depósito' : 'Nuevo depósito'}
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
          <CampoSelectorBuscable
            etiqueta="Sucursal *"
            valor={sucursal}
            onCambiar={setSucursal}
            opciones={sucursales}
            textoOpcion={(item) => item.nombre}
            placeholder="Buscar sucursal"
            error={Boolean(errores.sucursal)}
            mensajeError={errores.sucursal}
          />

          <label className="campo-comercial">
            <span>Nombre *</span>
            <input
              type="text"
              className={errores.nombre ? 'input-error' : ''}
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
            />
            <MensajeError>{errores.nombre}</MensajeError>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Descripción</span>
            <input
              type="text"
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
          </label>

          <label className="campo-checkbox ancho-completo">
            <input
              type="checkbox"
              checked={predeterminado}
              onChange={(evento) => setPredeterminado(evento.target.checked)}
            />
            <span>Depósito predeterminado de la sucursal</span>
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
                'Guardar depósito'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
