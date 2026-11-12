export function limpiar(valor) {
  return String(valor ?? '').trim()
}

export function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

export function normalizarDocumento(valor) {
  return String(valor ?? '').replace(/[.\-\s]/g, '')
}

export function documentoNormalizado(tipo, valor) {
  if (tipo === 'DNI' || tipo === 'CUIT' || tipo === 'CUIL') {
    return normalizarDocumento(valor)
  }
  return limpiar(valor)
}

export function validarDocumento(tipo, valor) {
  const texto = limpiar(valor)
  if (!texto) {
    return 'Ingresá el número de documento.'
  }
  if (tipo === 'DNI') {
    const numero = normalizarDocumento(texto)
    if (!/^\d+$/.test(numero)) {
      return 'El DNI solo puede tener números (se permiten puntos o guiones).'
    }
    return /^\d{7,8}$/.test(numero)
      ? ''
      : 'El DNI debe tener 7 u 8 números.'
  }
  if (tipo === 'CUIT' || tipo === 'CUIL') {
    const numero = normalizarDocumento(texto)
    if (!/^\d+$/.test(numero)) {
      return 'El CUIT/CUIL solo puede tener números (se permiten guiones).'
    }
    return /^\d{11}$/.test(numero)
      ? ''
      : 'El CUIT/CUIL debe tener 11 números.'
  }
  if (tipo === 'PAS') {
    return /^[A-Za-z0-9]{5,20}$/.test(texto)
      ? ''
      : 'El pasaporte debe tener entre 5 y 20 letras o números.'
  }
  if (tipo === 'OTRO') {
    return /^[A-Za-z0-9-]{3,20}$/.test(texto)
      ? ''
      : 'Ingresá un documento válido de 3 a 20 caracteres.'
  }
  return ''
}

export function validarEmail(valor) {
  const texto = limpiar(valor)
  if (!texto) {
    return ''
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)
    ? ''
    : 'Ingresá un email válido.'
}

export function validarTelefono(valor) {
  const texto = limpiar(valor)
  if (!texto) {
    return ''
  }
  if (!/^[0-9+()\s-]+$/.test(texto)) {
    return 'El teléfono solo puede tener números, espacios, +, - y paréntesis.'
  }
  return soloDigitos(texto).length >= 6
    ? ''
    : 'El teléfono debe tener al menos 6 números.'
}

export function validarNombre(valor, etiqueta = 'El nombre') {
  const texto = limpiar(valor)
  if (!texto) {
    return ''
  }
  if (texto.length < 2) {
    return `${etiqueta} debe tener al menos 2 caracteres.`
  }
  if (/\d/.test(texto)) {
    return `${etiqueta} no puede contener números.`
  }
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' .-]+$/.test(texto)) {
    return `${etiqueta} contiene caracteres no válidos.`
  }
  return ''
}

export function validarRazonSocial(valor) {
  const texto = limpiar(valor)
  if (!texto) {
    return ''
  }
  return texto.length >= 2
    ? ''
    : 'La razón social debe tener al menos 2 caracteres.'
}

export function validarCodigo(valor) {
  const texto = limpiar(valor)
  if (!texto) {
    return 'Ingresá el código.'
  }
  return /^[A-Za-z0-9_-]{2,20}$/.test(texto)
    ? ''
    : 'El código solo admite letras, números, guion y guion bajo (2 a 20).'
}

export function validarNumero(valor, opciones = {}) {
  const {
    etiqueta = 'El valor',
    mayorQueCero = true,
    maximo = null,
    decimales = 3,
  } = opciones
  const texto = limpiar(valor)
  if (!texto) {
    return `Ingresá ${etiqueta.toLowerCase()}.`
  }
  const numero = Number(texto.replace(',', '.'))
  if (!Number.isFinite(numero)) {
    return `${etiqueta} debe ser un número.`
  }
  if (mayorQueCero && numero <= 0) {
    return `${etiqueta} debe ser mayor a cero.`
  }
  if (!mayorQueCero && numero < 0) {
    return `${etiqueta} no puede ser negativo.`
  }
  if (maximo !== null && numero > maximo) {
    return `${etiqueta} no puede superar ${maximo}.`
  }
  const partes = texto.replace(',', '.').split('.')
  if (partes[1] && partes[1].length > decimales) {
    return `${etiqueta} admite hasta ${decimales} decimales.`
  }
  return ''
}

export function validarFecha(valor, etiqueta = 'La fecha') {
  const texto = limpiar(valor)
  if (!texto) {
    return `Ingresá ${etiqueta.toLowerCase()}.`
  }
  const fecha = new Date(`${texto}T00:00:00`)
  return Number.isNaN(fecha.getTime())
    ? `${etiqueta} no es válida.`
    : ''
}

export function validarTexto(valor, etiqueta, { min = 2, max = 200 } = {}) {
  const texto = limpiar(valor)
  if (!texto && min > 0) {
    return `Ingresá ${etiqueta.toLowerCase()}.`
  }
  if (texto && texto.length < min) {
    return `${etiqueta} debe tener al menos ${min} caracteres.`
  }
  if (texto.length > max) {
    return `${etiqueta} no puede superar ${max} caracteres.`
  }
  return ''
}

export function validarIngresosBrutos(valor) {
  const texto = limpiar(valor)
  if (!texto) {
    return ''
  }
  if (texto.length > 30) {
    return 'Ingresos brutos no puede superar 30 caracteres.'
  }
  return /^[0-9./-]+$/.test(texto)
    ? ''
    : 'Ingresos brutos solo puede contener números y los separadores . / -'
}

export function validarNombreConsumidor(valor) {
  const texto = limpiar(valor)
  if (!texto) {
    return ''
  }
  return validarNombre(texto, 'El nombre del consumidor final')
}

export function unidadPermiteDecimales(nombreUnidad) {
  const texto = String(nombreUnidad ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!texto) {
    return false
  }
  const tokens = texto.split(/[^a-z0-9³²]+/).filter(Boolean)
  const decimales = new Set([
    'm',
    'mt',
    'mts',
    'metro',
    'metros',
    'm2',
    'm²',
    'm3',
    'm³',
    'cm',
    'mm',
    'km',
    'l',
    'lt',
    'lts',
    'litro',
    'litros',
    'ml',
    'kg',
    'kilo',
    'kilos',
    'kilogramo',
    'kilogramos',
    'g',
    'gr',
    'grs',
    'gramo',
    'gramos',
    'mg',
    'ton',
    'tn',
    'tonelada',
    'toneladas',
  ])
  return tokens.some((token) => decimales.has(token))
}

export function validarCantidadPorUnidad(valor, unidad, etiqueta = 'La cantidad') {
  const permiteDecimales = unidadPermiteDecimales(unidad)
  const decimales = permiteDecimales ? 3 : 0
  const error = validarNumero(valor, {
    etiqueta,
    mayorQueCero: true,
    decimales,
  })
  if (error) {
    return error
  }
  if (!permiteDecimales) {
    const numero = Number(String(valor).replace(',', '.'))
    if (!Number.isInteger(numero)) {
      return `${etiqueta} debe ser un número entero para esta unidad.`
    }
  }
  return ''
}
