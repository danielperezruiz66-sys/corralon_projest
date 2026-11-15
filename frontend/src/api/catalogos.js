import { pedir } from './client'

const TAMANO_PAGINA = 200
const VIGENCIA_CATALOGO = 60_000

const cacheCatalogos = new Map()

function claveCatalogo(ruta) {
  return ruta.split('?')[0].replace(/\/+$/, '')
}

function conTamanoPagina(ruta, tamano) {
  if (!tamano) {
    return ruta
  }
  const [base, consulta = ''] = ruta.split('?')
  const parametros = new URLSearchParams(consulta)
  if (!parametros.has('page_size')) {
    parametros.set('page_size', String(tamano))
  }
  const texto = parametros.toString()
  return texto ? `${base}?${texto}` : base
}

/**
 * Recorre una ruta paginada de DRF y devuelve todos los resultados.
 * `next` viene como URL absoluta; se convierte a la ruta relativa que
 * entiende `pedir()`. Pide páginas grandes para reducir viajes.
 */
export async function pedirTodas(ruta, { pageSize = TAMANO_PAGINA } = {}) {
  let siguiente = conTamanoPagina(ruta, pageSize)
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

/**
 * Catálogos que cambian poco (sucursales, categorías, marcas, unidades,
 * depósitos, roles, métodos de pago). Cachea en memoria y deduplica
 * solicitudes simultáneas.
 */
export function pedirCatalogo(ruta, { ttl = VIGENCIA_CATALOGO } = {}) {
  const clave = claveCatalogo(ruta)
  const registro = cacheCatalogos.get(clave)
  const ahora = Date.now()

  if (registro) {
    if (registro.datos !== undefined && registro.expira > ahora) {
      return Promise.resolve(registro.datos)
    }
    if (registro.promesa) {
      return registro.promesa
    }
  }

  const promesa = pedirTodas(ruta)
    .then((datos) => {
      cacheCatalogos.set(clave, { datos, expira: Date.now() + ttl })
      return datos
    })
    .catch((error) => {
      cacheCatalogos.delete(clave)
      throw error
    })

  cacheCatalogos.set(clave, { promesa, expira: 0 })
  return promesa
}

export function invalidarCatalogo(ruta) {
  const base = claveCatalogo(ruta)
  for (const clave of cacheCatalogos.keys()) {
    if (clave === base || clave.startsWith(`${base}?`)) {
      cacheCatalogos.delete(clave)
    }
  }
}
