export default function EstadoVenta({ estado, etiqueta }) {
  return (
    <span className={`badge badge-${estado.toLowerCase()}`}>{etiqueta}</span>
  )
}
