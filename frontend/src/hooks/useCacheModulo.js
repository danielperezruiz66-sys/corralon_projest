import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Cache en memoria + actualización en segundo plano para los módulos.
 *
 * Guarda la última respuesta de cada combinación `clave` (usuario, sucursal y
 * filtros) para mostrarla al instante al volver al módulo o cambiar de
 * pestaña, mientras la actualización sigue sin bloquear la pantalla.
 *
 * `consultar` debe ser memoizado con `useCallback`, recibir `{ signal }` y
 * devolver una promesa con la respuesta ya normalizada.
 */

const TOPE_ENTRADAS = 30
const cache = new Map()

function leerCache(clave) {
  if (!clave) {
    return null
  }
  return cache.get(clave) ?? null
}

function guardarCache(clave, datos) {
  const entrada = { datos, actualizado: new Date() }
  cache.delete(clave)
  cache.set(clave, entrada)

  while (cache.size > TOPE_ENTRADAS) {
    cache.delete(cache.keys().next().value)
  }

  return entrada
}

/**
 * Estado al entrar a una clave: si hay cache se muestra al instante y si no,
 * se mantiene lo que ya estaba en pantalla para no perder la tabla anterior.
 */
function estadoParaClave(clave, inicial, anterior) {
  const entrada = leerCache(clave)
  const hayPrevio = Boolean(anterior?.tieneDatos)

  return {
    clave,
    datos: entrada?.datos ?? anterior?.datos ?? inicial,
    cargando: !entrada && !hayPrevio,
    actualizando: Boolean(entrada) || hayPrevio,
    tieneDatos: Boolean(entrada) || hayPrevio,
    error: '',
    ultimaActualizacion: entrada?.actualizado ?? null,
  }
}

/**
 * Deja una respuesta ya obtenida en la cache del hook, para precargar un
 * módulo antes de que se monte. La clave tiene que ser la misma del módulo.
 */
export function sembrarCache(clave, datos) {
  return guardarCache(clave, datos)
}

export default function useCacheModulo({
  clave,
  consultar,
  inicial = null,
  activo = true,
  intervalo = 0,
}) {
  const [estado, setEstado] = useState(() =>
    estadoParaClave(clave, inicial, null),
  )
  const turnoRef = useRef(0)
  const abortRef = useRef(null)
  const enCursoRef = useRef(null)

  if (estado.clave !== clave) {
    setEstado((previo) => estadoParaClave(clave, inicial, previo))
  }

  const solicitar = useCallback(
    (forzar = false) => {
      if (!activo || !clave) {
        return
      }
      if (!forzar && enCursoRef.current?.clave === clave) {
        return
      }

      abortRef.current?.abort()
      const controlador = new AbortController()
      abortRef.current = controlador
      enCursoRef.current = { clave, controlador }
      const turno = ++turnoRef.current

      const liberar = () => {
        if (enCursoRef.current?.controlador === controlador) {
          enCursoRef.current = null
        }
      }

      return consultar({ signal: controlador.signal }).then(
        (respuesta) => {
          liberar()
          if (turno !== turnoRef.current) {
            return
          }
          const entrada = guardarCache(clave, respuesta)
          setEstado({
            clave,
            datos: respuesta,
            cargando: false,
            actualizando: false,
            tieneDatos: true,
            error: '',
            ultimaActualizacion: entrada.actualizado,
          })
        },
        (error) => {
          liberar()
          if (turno !== turnoRef.current || error?.name === 'AbortError') {
            return
          }
          setEstado((previo) =>
            previo.clave === clave
              ? {
                  ...previo,
                  cargando: false,
                  actualizando: false,
                  error: error?.message || 'No se pudo cargar la información.',
                }
              : previo,
          )
        },
      )
    },
    [activo, clave, consultar],
  )

  useEffect(() => {
    solicitar()

    return () => {
      abortRef.current?.abort()
    }
  }, [solicitar])

  const refrescar = useCallback(
    (forzar = false) => {
      setEstado((previo) =>
        previo.clave === clave
          ? {
              ...previo,
              actualizando: true,
              cargando: previo.tieneDatos ? previo.cargando : true,
              error: '',
            }
          : previo,
      )
      solicitar(forzar === true)
    },
    [clave, solicitar],
  )

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        refrescar()
      }
    }

    window.addEventListener('focus', alVolver)
    document.addEventListener('visibilitychange', alVolver)

    const temporizador =
      intervalo > 0 ? setInterval(alVolver, intervalo) : null

    return () => {
      window.removeEventListener('focus', alVolver)
      document.removeEventListener('visibilitychange', alVolver)
      if (temporizador) {
        clearInterval(temporizador)
      }
    }
  }, [refrescar, intervalo])

  const limpiarError = useCallback(() => {
    setEstado((previo) => (previo.error ? { ...previo, error: '' } : previo))
  }, [])

  /** Borra las entradas cuya clave empiece con `prefijo` (ej. `ventas|12|`). */
  const invalidar = useCallback((prefijo) => {
    if (!prefijo) {
      cache.clear()
      return
    }
    Array.from(cache.keys()).forEach((entrada) => {
      if (entrada.startsWith(prefijo)) {
        cache.delete(entrada)
      }
    })
  }, [])

  return {
    datos: estado.datos ?? inicial,
    cargando: estado.cargando,
    actualizando: estado.actualizando,
    tieneDatos: estado.tieneDatos,
    error: estado.error,
    ultimaActualizacion: estado.ultimaActualizacion,
    refrescar,
    invalidar,
    limpiarError,
  }
}
