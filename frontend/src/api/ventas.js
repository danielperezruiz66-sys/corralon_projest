import { pedir } from './client'
import { sembrarCache } from '../hooks/useCacheModulo'

/** Orden por defecto del listado de ventas (más nuevas primero). */
export const ORDEN_VENTAS = '-fecha_venta'

// Roles que ven el módulo de ventas (ver AGENTS.md §3).
const ROLES_VENTAS = ['AD', 'GE', 'CA', 'VE']

/**
 * Clave de cache del listado. La comparten el módulo y la precarga para que
 * la primera visita encuentre la respuesta ya guardada.
 */
export function prefijoCacheVentas(usuarioId) {
  return `ventas|${usuarioId ?? ''}|`
}

export function claveListadoVentas(usuarioId, consulta) {
  return `${prefijoCacheVentas(usuarioId)}${consulta}`
}

/** Consulta de la vista inicial: página 1, sin filtros ni sucursal. */
export function consultaListadoVentas({ orden = ORDEN_VENTAS } = {}) {
  const parametros = new URLSearchParams({ page: '1' })
  if (orden) {
    parametros.set('ordering', orden)
  }
  return parametros.toString()
}

// Pedidos de precarga en curso: evita repetir el mismo pedido mientras se
// resuelve (por ejemplo si el perfil se carga dos veces en desarrollo).
const precargas = new Set()

/**
 * Deja la primera página de ventas en la cache apenas se conoce el perfil:
 * al entrar al módulo la tabla aparece de inmediato mientras se revalida.
 */
export function precargarListadoVentas(perfil) {
  const codigos = perfil?.codigos ?? []
  const puedeVer =
    perfil?.is_superuser ||
    codigos.some((codigo) => ROLES_VENTAS.includes(codigo))
  if (!perfil?.id || !puedeVer) {
    return
  }

  const consulta = consultaListadoVentas()
  const clave = claveListadoVentas(perfil.id, consulta)
  if (precargas.has(clave)) {
    return
  }

  precargas.add(clave)
  pedir(`/ventas/?${consulta}`)
    .then((datos) => sembrarCache(clave, datos))
    .catch(() => {})
    .finally(() => precargas.delete(clave))
}
