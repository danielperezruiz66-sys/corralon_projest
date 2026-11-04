import { pedir } from './client'

/**
 * Recorre una ruta paginada de DRF y devuelve todos los resultados.
 * `next` viene como URL absoluta; se convierte a la ruta relativa que
 * entiende `pedir()`.
 */
export async function pedirTodas(ruta) {
  let siguiente = ruta
  const resultados = []

  for (let pagina = 0; pagina < 50 && siguiente; pagina += 1) {
    const datos = await pedir(siguiente)

    if (Array.isArray(datos)) {
      return datos
    }

    resultados.push(...(datos.results ?? []))

    if (!datos.next) {
      break
    }

    const url = new URL(datos.next)
    siguiente = `${url.pathname.replace(/^\/api/, '')}${url.search}`
  }

  return resultados
}
