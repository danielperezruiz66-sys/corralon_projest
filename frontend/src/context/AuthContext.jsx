import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cerrarSesion as borrarSesion,
  iniciarSesion,
  obtenerPerfil,
} from '../api/auth'
import { tieneSesion } from '../api/client'
import { AuthContext } from './auth-context'

function normalizarPerfil(perfil) {
  if (!perfil) {
    return null
  }

  const empleado = perfil.empleado
  const roles = perfil.roles ?? []
  const codigos = perfil.codigos ?? roles.map((rol) => rol.codigo).filter(Boolean)
  const esAdmin = Boolean(perfil.is_superuser || codigos.includes('AD'))
  const nombre = empleado
    ? `${empleado.nombre} ${empleado.apellido}`.trim()
    : perfil.username

  return {
    ...perfil,
    nombre,
    legajo: empleado?.legajo ?? (perfil.is_superuser ? 'Superuser' : '—'),
    roles,
    codigos,
    esAdmin,
    rol:
      roles[0]?.ocupacion ??
      (esAdmin ? 'Administrador' : 'Sin rol asignado'),
  }
}

export function AuthProvider({ children }) {
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(() => tieneSesion())

  useEffect(() => {
    if (!tieneSesion()) {
      return undefined
    }

    let vigente = true
    obtenerPerfil()
      .then((datos) => {
        if (vigente) {
          setPerfil(datos)
        }
      })
      .catch(() => {
        borrarSesion()
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [])

  const login = useCallback(async (usuario, password) => {
    const datos = await iniciarSesion(usuario, password)
    setPerfil(datos)
    return datos
  }, [])

  const logout = useCallback(() => {
    borrarSesion()
    setPerfil(null)
  }, [])

  const user = useMemo(() => normalizarPerfil(perfil), [perfil])

  const puedeVer = useCallback(
    (modulo) => {
      if (!user) {
        return false
      }
      if (user.is_superuser || user.codigos.includes('AD')) {
        return true
      }
      if (!modulo?.roles?.length) {
        return true
      }
      return modulo.roles.some((codigo) => user.codigos.includes(codigo))
    },
    [user],
  )

  const puedeEscribir = useCallback(
    (roles = []) => {
      if (!user) {
        return false
      }
      if (user.is_superuser || user.codigos.includes('AD')) {
        return true
      }
      return roles.some((codigo) => user.codigos.includes(codigo))
    },
    [user],
  )

  const valor = useMemo(
    () => ({
      user,
      perfil,
      cargando,
      codigos: user?.codigos ?? [],
      login,
      logout,
      puedeVer,
      puedeEscribir,
    }),
    [user, perfil, cargando, login, logout, puedeVer, puedeEscribir],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
