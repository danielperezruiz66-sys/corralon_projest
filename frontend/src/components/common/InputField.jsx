export default function InputField({
  type = 'text',
  placeholder,
  registro,
  error,
  icon: Icon,
  ...props
}) {
  return (
    <div className="grupo-input">
      <div className="contenedor-input-interno">
        {Icon && <Icon size={22} className="icono-campo" />}
        <input
          type={type}
          placeholder={placeholder}
          className="input-personalizado"
          {...registro}
          {...props}
        />
      </div>
      {error && (
        <p role="alert" className="mensaje-error-input">
          {error.message}
        </p>
      )}
    </div>
  )
}
