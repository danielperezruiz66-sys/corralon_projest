const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
})

const numero = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 3,
})

export function formatearMoneda(valor) {
  return moneda.format(Number(valor) || 0)
}

export function formatearNumero(valor) {
  return numero.format(Number(valor) || 0)
}

export function formatearFecha(valor) {
  if (!valor) {
    return '—'
  }
  return new Date(valor).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatearFechaHora(valor) {
  if (!valor) {
    return '—'
  }
  return new Date(valor).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatearHora(valor) {
  if (!valor) {
    return '—'
  }
  return new Date(valor).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function etiquetaDia(fecha) {
  const dia = new Date(`${fecha}T00:00:00`)
  return dia.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
}

export function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}
