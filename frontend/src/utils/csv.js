function escapar(valor) {
  const texto = String(valor ?? '')
  if (/[;"\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

/**
 * Descarga una matriz de filas como CSV compatible con Excel en español.
 * La primera fila es el encabezado.
 */
export function descargarCsv(nombre, encabezados, filas) {
  const lineas = [encabezados, ...filas].map((fila) =>
    fila.map(escapar).join(';'),
  )
  const contenido = `\uFEFF${lineas.join('\r\n')}`
  const blob = new Blob([contenido], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

export function numeroCsv(valor) {
  return Number(valor || 0).toFixed(2).replace('.', ',')
}

export function cantidadCsv(valor) {
  return Number(valor || 0).toFixed(3).replace('.', ',')
}
