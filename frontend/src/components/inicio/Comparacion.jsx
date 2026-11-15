export default function Comparacion({ valor, etiqueta }) {
  if (valor === null || valor === undefined) {
    return (
      <span className="kpi-comparacion kpi-comparacion-neutra">
        Sin comparación <small>{etiqueta}</small>
      </span>
    )
  }

  const numero = Number(valor)
  const clase = numero > 0 ? 'positiva' : numero < 0 ? 'negativa' : 'neutra'
  const simbolo = numero > 0 ? '▲' : numero < 0 ? '▼' : '='

  return (
    <span className={`kpi-comparacion kpi-comparacion-${clase}`}>
      {simbolo} {Math.abs(numero).toFixed(1)}% <small>{etiqueta}</small>
    </span>
  )
}
