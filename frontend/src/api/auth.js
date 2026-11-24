import { URL_API, guardarTokens, limpiarTokens, pedir } from './client'

export async function iniciarSesion(usuario, password) {
  let respuesta
  try {
    respuesta = await fetch(`${URL_API}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usuario, password }),
    })
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Verificá que el backend esté iniciado.',
    )
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error('Usuario, legajo o contraseña incorrectos.')
    }
    if (respuesta.status === 429) {
      throw new Error(
        'Demasiados intentos. Esperá un minuto e intentá de nuevo.',
      )
    }
    if (respuesta.status >= 500) {
      throw new Error(
        `El servidor no está disponible (${respuesta.status}). ` +
          'Verificá que el backend esté iniciado.',
      )
    }
    throw new Error(`No se pudo procesar el ingreso (${respuesta.status}).`)
  }

  const tokens = await respuesta.json()
  guardarTokens(tokens)
  return obtenerPerfil()
}

export function obtenerPerfil() {
  return pedir('/perfil/')
}

export function cerrarSesion() {
  limpiarTokens()
}
