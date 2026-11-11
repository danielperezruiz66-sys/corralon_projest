export default function MensajeError({ children }) {
  if (!children) {
    return null
  }
  return (
    <small className="mensaje-error-campo" role="alert">
      {children}
    </small>
  )
}
