import { URL_API, guardarTokens, limpiarTokens, pedir } from './client'

export async function iniciarSesion(usuario, password) {
  const respuesta = await fetch(`${URL_API}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usuario, password }),
  })

  if (!respuesta.ok) {
    throw new Error('Usuario, legajo o contraseña incorrectos.')
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
