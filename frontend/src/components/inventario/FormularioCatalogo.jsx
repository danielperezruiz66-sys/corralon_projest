import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconLoader2, IconTag, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { validarTexto } from '../../utils/validaciones'
import MensajeError from '../common/MensajeError.jsx'

const CONFIG = {
  categorias: { campo: 'categorias', singular: 'categoría', ruta: '/categorias/' },
  marcas: { campo: 'marcas', singular: 'marca', ruta: '/marcas/' },
  unidades: { campo: 'unidades', singular: 'unidad', ruta: '/unidades/' },
}

export default function FormularioCatalogo({
  tipo,
  item = null,
  onCerrar,
  onGuardado,
}) {
  const config = CONFIG[tipo]
  const [valor, setValor] = useState(item?.[config.campo] || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const esEdicion = Boolean(item?.id)

  async function guardar(evento) {
    evento.preventDefault()
    const mensaje = validarTexto(valor, `El nombre de la ${config.singular}`, {
      min: 2,
      max: 60,
    })
    if (mensaje) {
      setError(mensaje)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setError('')
    setGuardando(true)
    try {
      const guardado = await pedir(
        esEdicion ? `${config.ruta}${item.id}/` : config.ruta,
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({ [config.campo]: valor.trim() }),
        },
      )
      onGuardado?.(guardado, esEdicion)
    } catch (e) {
      if (e.campos) {
        setError(Object.values(e.campos)[0])
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
      <div className="comercial-modal comercial-modal-chico">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconTag size={24} />
            {esEdicion ? 'Editar' : 'Nueva'} {config.singular}
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

        <form onSubmit={guardar} noValidate>
          <label className="campo-comercial ancho-completo">
            <span>Nombre</span>
            <input
              type="text"
              className={error ? 'input-error' : ''}
              value={valor}
              onChange={(evento) => setValor(evento.target.value)}
              autoFocus
            />
            <MensajeError>{error}</MensajeError>
          </label>

          <div className="comercial-modal-acciones">
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
                'Guardar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
