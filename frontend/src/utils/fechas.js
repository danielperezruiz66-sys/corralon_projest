/**
 * Fechas locales en formato ISO corto (`AAAA-MM-DD`), sin pasar por UTC para
 * no correr un día en husos negativos.
 */

export function fechaIso(fecha = new Date()) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function sumarDias(fecha, dias) {
  const copia = new Date(fecha)
  copia.setDate(copia.getDate() + dias)
  return copia
}

export function isoHoy() {
  return fechaIso(new Date())
}

export function isoAyer() {
  return fechaIso(sumarDias(new Date(), -1))
}
