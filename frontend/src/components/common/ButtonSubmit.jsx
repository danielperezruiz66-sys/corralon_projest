export default function ButtonSubmit({ text, disabled }) {
  return (
    <button type="submit" disabled={disabled} className="boton-enviar">
      {text}
    </button>
  )
}
