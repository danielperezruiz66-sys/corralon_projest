const URL_API = import.meta.env.VITE_API_URL || '/api'
const CLAVE_ACCESO = 'corralon.acceso'
const CLAVE_REFRESCO = 'corralon.refresco'

/** Evento que avisa que la sesión expiró o fue invalidada. */
export const EVENTO_SESION_EXPIRADA = 'corralon:sesion-expirada'

/**
 * Los tokens viven en `sessionStorage`: la sesión se mantiene mientras la
 * pestaña siga abierta y se descarta al cerrar la pestaña o el navegador.
 * Es lo que corresponde a una computadora compartida en el mostrador.
 */
export function guardarTokens({ access, refresh }) {
  sessionStorage.setItem(CLAVE_ACCESO, access)
  if (refresh) {
    sessionStorage.setItem(CLAVE_REFRESCO, refresh)
  }
}

export function limpiarTokens() {
  sessionStorage.removeItem(CLAVE_ACCESO)
  sessionStorage.removeItem(CLAVE_REFRESCO)
}

export function tieneSesion() {
  return Boolean(sessionStorage.getItem(CLAVE_ACCESO))
}

function leerRefresco() {
  return sessionStorage.getItem(CLAVE_REFRESCO)
}

/**
 * Avisa que la sesión dejó de ser válida. El `AuthProvider` escucha este
 * evento y limpia el perfil, lo que hace que las rutas protegidas redirijan
 * al login en vez de quedar mostrando el error crudo de la API.
 */
function avisarSesionExpirada() {
  limpiarTokens()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA))
  }
}

const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró. Ingresá nuevamente.'

// Pedido de renovación en curso: todos los 401 concurrentes comparten la
// misma llamada. Sin esto, dos pedidos disparan dos refresh en paralelo, el
// segundo usa un token ya rotado (blacklisted) y limpia la sesión recién
// renovada.
let renovacionEnCurso = null

async function renovarAcceso() {
  if (renovacionEnCurso) {
    return renovacionEnCurso
  }

  renovacionEnCurso = (async () => {
    const refresh = leerRefresco()
    if (!refresh) {
      avisarSesionExpirada()
      return null
    }

    const respuesta = await fetch(`${URL_API}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })

    if (!respuesta.ok) {
      // Una pestaña duplicada pudo renovar primero: si el refresh guardado ya
      // cambió, se reutiliza el acceso nuevo en vez de cerrar la sesión.
      if (leerRefresco() !== refresh) {
        return sessionStorage.getItem(CLAVE_ACCESO)
      }
      avisarSesionExpirada()
      return null
    }

    const datos = await respuesta.json()
    guardarTokens({ access: datos.access, refresh: datos.refresh || refresh })
    return datos.access
  })()

  try {
    return await renovacionEnCurso
  } finally {
    renovacionEnCurso = null
  }
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
  const acceso = sessionStorage.getItem(CLAVE_ACCESO)
  if (acceso) {
    cabeceras.set('Authorization', `Bearer ${acceso}`)
  }

  const respuesta = await fetch(`${URL_API}${ruta}`, {
    ...opciones,
    headers: cabeceras,
  })

  if (respuesta.status === 401) {
    if (reintentar) {
      const nuevo = await renovarAcceso()
      if (nuevo) {
        return pedir(ruta, opciones, false)
      }
      throw new Error(MENSAJE_SESION_EXPIRADA)
    }
    // El token recién renovado tampoco sirve: la sesión ya no es válida.
    avisarSesionExpirada()
    throw new Error(MENSAJE_SESION_EXPIRADA)
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
