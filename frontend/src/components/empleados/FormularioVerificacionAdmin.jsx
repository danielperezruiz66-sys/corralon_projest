import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconKey, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'
import '../../styles/Empleados.css'

export default function FormularioVerificacionAdmin({
  empleado,
  password,
  confirmacion,
  onCerrar,
  onVolver,
}) {
  const [passwordAdmin, setPasswordAdmin] = useState('')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  async function verificar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (passwordAdmin === '') {
      nuevos.password_admin = 'Ingresá tu contraseña de administrador.'
    }
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setGuardando(true)
    setErrores({})
    try {
      await pedir(`/empleados/${empleado.id}/cambiar-password/`, {
        method: 'POST',
        body: JSON.stringify({
          password,
          password_confirmacion: confirmacion,
          password_admin: passwordAdmin,
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: 'Se cerraron las sesiones activas del empleado.',
        timer: 1800,
        showConfirmButton: false,
      })
      onCerrar?.()
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
        title: 'No se pudo cambiar la contraseña',
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
            <IconKey size={22} />
            Verificá tu identidad
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

        <form onSubmit={verificar} className="comercial-grid" noValidate>
          <p className="empleados-nota ancho-completo">
            Para cambiar la contraseña de{' '}
            <strong>
              {empleado.apellido}, {empleado.nombre}
            </strong>
            , ingresá tu contraseña de administrador. Se cerrarán todas las
            sesiones activas del empleado.
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Tu contraseña de administrador *</span>
            <input
              className={errores.password_admin ? 'input-error' : ''}
              type="password"
              autoComplete="current-password"
              autoFocus
              maxLength={128}
              value={passwordAdmin}
              onChange={(e) => {
                setPasswordAdmin(e.target.value)
                if (errores.password_admin) {
                  setErrores((previos) => ({ ...previos, password_admin: '' }))
                }
              }}
            />
            <MensajeError>{errores.password_admin}</MensajeError>
          </label>

          <div className="comercial-modal-acciones ancho-completo">
            <button
              type="button"
              className="boton-comercial-secundario"
              onClick={onVolver}
            >
              Volver
            </button>
            <button
              type="submit"
              className="boton-comercial-primario"
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Verificando…
                </>
              ) : (
                'Cambiar contraseña'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

