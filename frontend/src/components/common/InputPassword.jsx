import { useState } from 'react'
import { IconEye, IconEyeOff, IconLock } from '@tabler/icons-react'

export default function InputPassword({
  placeholder = 'Contraseña',
  registro,
  error,
  icon: Icon = IconLock,
  name,
  value,
  onChange,
  ...props
}) {
  const [verPassword, setVerPassword] = useState(false)

  return (
    <div className="grupo-input">
      <div className="contenedor-input-interno">
        {Icon && <Icon className="icono-campo" size={20} />}

        <input
          type={verPassword ? 'text' : 'password'}
          placeholder={placeholder}
          className="input-personalizado input-password-ojo"
          {...(registro || { name, value, onChange })}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVerPassword((prev) => !prev)}
          className="boton-toggle-password"
          aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          tabIndex={-1}
        >
          {verPassword ? <IconEye size={20} /> : <IconEyeOff size={20} />}
        </button>
      </div>

      {error && (
        <p role="alert" className="mensaje-error-input">
          {error.message}
        </p>
      )}
    </div>
  )
}
