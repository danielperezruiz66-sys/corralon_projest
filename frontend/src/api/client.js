const URL_API = import.meta.env.VITE_API_URL || '/api'
const CLAVE_ACCESO = 'corralon.acceso'
const CLAVE_REFRESCO = 'corralon.refresco'

export function guardarTokens({ access, refresh }) {
  localStorage.setItem(CLAVE_ACCESO, access)
  if (refresh) {
    localStorage.setItem(CLAVE_REFRESCO, refresh)
  }
}

export function limpiarTokens() {
  localStorage.removeItem(CLAVE_ACCESO)
  localStorage.removeItem(CLAVE_REFRESCO)
}

export function tieneSesion() {
  return Boolean(localStorage.getItem(CLAVE_ACCESO))
}

function leerRefresco() {
  return localStorage.getItem(CLAVE_REFRESCO)
}

async function renovarAcceso() {
  const refresh = leerRefresco()
  if (!refresh) {
    return null
  }

  const respuesta = await fetch(`${URL_API}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })

  if (!respuesta.ok) {
    limpiarTokens()
    return null
  }

  const datos = await respuesta.json()
  guardarTokens({ access: datos.access, refresh: datos.refresh || refresh })
  return datos.access
}

function mensajeDeError(datos, estado) {
  if (!datos) {
    return `No se pudo completar la operación (${estado}).`
  }
  if (typeof datos.detail === 'string') {
    return datos.detail
  }
  if (Array.isArray(datos.detail)) {
    return datos.detail.join(' ')
  }

  const primero = Object.entries(datos)[0]
  if (primero) {
    const [campo, valor] = primero
    const texto = Array.isArray(valor) ? valor.join(' ') : String(valor)
    return `${campo}: ${texto}`
  }

  return `No se pudo completar la operación (${estado}).`
}

export async function pedir(ruta, opciones = {}, reintentar = true) {
  const cabeceras = new Headers(opciones.headers)
  if (opciones.body) {
    cabeceras.set('Content-Type', 'application/json')
  }
  const acceso = localStorage.getItem(CLAVE_ACCESO)
  if (acceso) {
    cabeceras.set('Authorization', `Bearer ${acceso}`)
  }

  const respuesta = await fetch(`${URL_API}${ruta}`, {
    ...opciones,
    headers: cabeceras,
  })

  if (respuesta.status === 401 && reintentar) {
    const nuevo = await renovarAcceso()
    if (nuevo) {
      return pedir(ruta, opciones, false)
    }
  }

  if (!respuesta.ok) {
    let datos = null
    try {
      datos = await respuesta.json()
    } catch {
      datos = null
    }
    const error = new Error(mensajeDeError(datos, respuesta.status))
    const campos = {}
    if (datos && typeof datos === 'object') {
      Object.entries(datos).forEach(([campo, valor]) => {
        if (
          campo === 'detail' ||
          campo === 'codigo' ||
          campo === 'non_field_errors'
        ) {
          return
        }
        if (
          Array.isArray(valor) &&
          valor.some((item) => item && typeof item === 'object')
        ) {
          return
        }
        campos[campo] = Array.isArray(valor)
          ? valor.join(' ')
          : String(valor)
      })
    }
    error.datos = datos
    error.campos = Object.keys(campos).length > 0 ? campos : null
    throw error
  }

  if (respuesta.status === 204) {
    return null
  }

  return respuesta.json()
}

export { URL_API }
