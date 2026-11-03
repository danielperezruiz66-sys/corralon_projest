import { useEffect, useMemo, useState } from 'react'
import {
  cerrarSesion as borrarSesion,
  iniciarSesion,
  obtenerPerfil,
} from '../api/auth'
import { tieneSesion } from '../api/client'
import { AuthContext } from './contexto'

export default function AuthProvider({ children }) {
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

  async function login(usuario, password) {
    const datos = await iniciarSesion(usuario, password)
    setPerfil(datos)
    return datos
  }

  function logout() {
    borrarSesion()
    setPerfil(null)
  }

  const valor = useMemo(() => {
    const codigos = perfil?.codigos ?? []

    function puedeEscribir(roles) {
      if (!perfil) {
        return false
      }
      if (perfil.is_superuser || codigos.includes('AD')) {
        return true
      }
      return roles.some((rol) => codigos.includes(rol))
    }

    return {
      perfil,
      cargando,
      codigos,
      login,
      logout,
      puedeEscribir,
    }
  }, [perfil, cargando])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
