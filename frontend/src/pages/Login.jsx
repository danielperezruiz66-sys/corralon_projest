import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { IconLock, IconSettings, IconUser } from '@tabler/icons-react'
import { useAuth } from '../context/auth-context'
import ButtonSubmit from '../components/common/ButtonSubmit'
import InputField from '../components/common/InputField'
import InputPassword from '../components/common/InputPassword'
import '../styles/Login.css'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  if (user) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async ({ usuario, password }) => {
    try {
      await login(usuario.trim(), password)
      Swal.fire({
        icon: 'success',
        title: '¡Bienvenido!',
        text: 'Ingreso exitoso.',
        timer: 1500,
        showConfirmButton: false,
      })
      navigate('/', { replace: true })
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No pudimos ingresar',
        text: error.message,
        confirmButtonColor: '#326f7a',
      })
    }
  }

  return (
    <main className="contenedor-login">
      <div className="circulo circulo-1" />
      <div className="circulo circulo-2" />
      <div className="circulo circulo-3" />
      <div className="circulo circulo-4" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="formulario-tarjeta-login"
      >
        <div className="encabezado-logo">
          <span className="caja-icono-logo">
            <IconSettings size={34} stroke={1.75} />
          </span>
          <span>
            Fer-Cons
            <small className="subtitulo-logo">Corralón de materiales</small>
          </span>
        </div>

        <InputField
          type="text"
          placeholder="Usuario o legajo"
          autoComplete="username"
          autoFocus
          registro={register('usuario', {
            required: 'Ingresá tu usuario o legajo',
          })}
          error={errors.usuario}
          icon={IconUser}
        />

        <InputPassword
          placeholder="Contraseña"
          autoComplete="current-password"
          registro={register('password', {
            required: 'Ingresá tu contraseña',
            minLength: { value: 4, message: 'Mínimo 4 caracteres' },
          })}
          error={errors.password}
          icon={IconLock}
        />

        <div className="contenedor-boton">
          <ButtonSubmit
            text={isSubmitting ? 'Ingresando…' : 'Ingresar'}
            disabled={isSubmitting}
          />
        </div>

        <button
          type="button"
          className="enlace-olvido boton-enlace"
          onClick={() =>
            Swal.fire({
              icon: 'info',
              title: 'Restablecer acceso',
              text: 'Contactá al administrador del sistema para que restablezca tu contraseña.',
              confirmButtonColor: '#326f7a',
            })
          }
        >
          ¿Olvidaste tu contraseña?
        </button>

        <p className="texto-demo">Sistema interno · Corralón Fer-Cons</p>
      </form>
    </main>
  )
}
