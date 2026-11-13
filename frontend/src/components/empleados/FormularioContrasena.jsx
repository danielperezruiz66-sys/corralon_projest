import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconKey, IconX } from '@tabler/icons-react'
import { validarFuerzaPassword } from '../../utils/validaciones'
import FormularioVerificacionAdmin from './FormularioVerificacionAdmin.jsx'
import MensajeError from '../common/MensajeError.jsx'
import '../../styles/Empleados.css'

export default function FormularioContrasena({ empleado, onCerrar }) {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [errores, setErrores] = useState({})
  const [verificando, setVerificando] = useState(false)

  function validar() {
    const nuevos = {}
    const passwordError = validarFuerzaPassword(password)
    if (passwordError) {
      nuevos.password = passwordError
    }
    if (password !== confirmacion) {
      nuevos.password_confirmacion = 'Las contraseñas no coinciden.'
    }
    return nuevos
  }

  async function continuar(evento) {
    evento.preventDefault()
    const nuevos = validar()
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    const resultado = await Swal.fire({
      icon: 'question',
      title: `¿Cambiar la contraseña de ${empleado.apellido}, ${empleado.nombre}?`,
      text: 'Se cerrarán todas sus sesiones activas y deberá volver a iniciar sesión.',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Volver',
    })
    if (!resultado.isConfirmed) {
      return
    }

    setErrores({})
    setVerificando(true)
  }

  if (verificando) {
    return (
      <FormularioVerificacionAdmin
        empleado={empleado}
        password={password}
        confirmacion={confirmacion}
        onCerrar={onCerrar}
        onVolver={() => setVerificando(false)}
      />
    )
  }

  const inputsConError = Object.values(errores).some((valor) => valor)

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-angosto">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconKey size={22} />
            Contraseña de {empleado.apellido}, {empleado.nombre}
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

        <form onSubmit={continuar} className="comercial-grid" noValidate>
          <p className="empleados-nota ancho-completo">
            Ingresá la contraseña nueva. Después, te vamos a pedir tu
            contraseña de administrador para confirmar el cambio.
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Contraseña nueva *</span>
            <input
              className={errores.password ? 'input-error' : ''}
              type="password"
              autoComplete="new-password"
              autoFocus
              maxLength={128}
              value={password}
              onChange={(e) => {
                const valor = e.target.value
                setPassword(valor)
                setErrores((previos) => ({
                  ...previos,
                  password: validarFuerzaPassword(valor),
                }))
              }}
              placeholder="Letras, números y un símbolo"
            />
            <MensajeError>{errores.password}</MensajeError>
          </label>
          <label className="campo-comercial ancho-completo">
            <span>Repetir contraseña *</span>
            <input
              className={errores.password_confirmacion ? 'input-error' : ''}
              type="password"
              autoComplete="new-password"
              maxLength={128}
              value={confirmacion}
              onChange={(e) => {
                const valor = e.target.value
                setConfirmacion(valor)
                setErrores((previos) => ({
                  ...previos,
                  password_confirmacion:
                    valor === password ? '' : valor
                      ? 'Las contraseñas no coinciden.'
                      : '',
                }))
              }}
            />
            <MensajeError>{errores.password_confirmacion}</MensajeError>
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
              disabled={inputsConError || !password}
            >
              Continuar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
