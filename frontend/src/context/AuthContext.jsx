import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  cerrarSesion as borrarSesion,
  iniciarSesion,
  obtenerPerfil,
} from '../api/auth'
import { tieneSesion } from '../api/client'
import { AuthContext } from './auth-context'

const MINUTOS_INACTIVIDAD = 30
const MS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60 * 1000
const CLAVE_ACTIVIDAD = 'corralon.ultimaActividad'
const INTERVALO_REVISION = 5000
const THROTTLE_ACTIVIDAD = 10000

function leerUltimaActividad() {
  const guardada = Number(localStorage.getItem(CLAVE_ACTIVIDAD))
  return Number.isFinite(guardada) && guardada > 0 ? guardada : 0
}

function registrarActividad() {
  localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now()))
}

function olvidarActividad() {
  localStorage.removeItem(CLAVE_ACTIVIDAD)
}

function inactividadVencida() {
  const ultima = leerUltimaActividad()
  return ultima > 0 && Date.now() - ultima >= MS_INACTIVIDAD
}

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
  const navigate = useNavigate()
  const navegarRef = useRef(navigate)
  const [vencidaAlMontar] = useState(
    () => tieneSesion() && inactividadVencida(),
  )
  const pausadaRef = useRef(vencidaAlMontar)
  const expiracionRef = useRef(false)
  const ultimoRegistroRef = useRef(leerUltimaActividad())

  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(
    () => tieneSesion() && !vencidaAlMontar,
  )
  const [pausada, setPausada] = useState(vencidaAlMontar)

  useEffect(() => {
    navegarRef.current = navigate
  }, [navigate])

  const logout = useCallback(() => {
    borrarSesion()
    olvidarActividad()
    pausadaRef.current = false
    expiracionRef.current = false
    ultimoRegistroRef.current = 0
    setPausada(false)
    setPerfil(null)
    setCargando(false)
  }, [])

  const manejarExpiracion = useCallback(
    async (pausarUI = true) => {
      if (expiracionRef.current) {
        return
      }

      expiracionRef.current = true
      if (pausarUI) {
        pausadaRef.current = true
        setPausada(true)
        setCargando(false)
      }

      let Swal
      try {
        ;({ default: Swal } = await import('sweetalert2'))
      } catch {
        logout()
        navegarRef.current('/login', { replace: true })
        return
      }

      const eleccion = await Swal.fire({
        icon: 'warning',
        title: 'Sesión inactiva',
        text: 'Pasaron 30 minutos sin actividad. Podés mantener la sesión y volver a donde estabas, o ingresar de nuevo con tus datos.',
        showCancelButton: true,
        confirmButtonColor: '#326f7a',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Mantener sesión',
        cancelButtonText: 'Iniciar sesión de nuevo',
        allowOutsideClick: false,
        allowEscapeKey: false,
        focusCancel: true,
      })

      if (!eleccion.isConfirmed) {
        logout()
        navegarRef.current('/login', { replace: true })
        return
      }

      Swal.fire({
        title: 'Restaurando sesión…',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      })

      try {
        const datos = await obtenerPerfil()
        registrarActividad()
        ultimoRegistroRef.current = Date.now()
        pausadaRef.current = false
        expiracionRef.current = false
        setPerfil(datos)
        setPausada(false)
        Swal.close()
        Swal.fire({
          icon: 'success',
          title: 'Sesión restaurada',
          text: 'Bienvenido nuevamente.',
          timer: 1500,
          showConfirmButton: false,
        })
      } catch {
        logout()
        Swal.close()
        await Swal.fire({
          icon: 'error',
          title: 'No pudimos restaurar la sesión',
          text: 'Tu sesión ya no es válida. Ingresá tus datos nuevamente.',
          confirmButtonColor: '#326f7a',
        })
        navegarRef.current('/login', { replace: true })
      }
    },
    [logout],
  )

  useEffect(() => {
    if (!vencidaAlMontar) {
      return undefined
    }
    // El aviso se muestra despues del primer render para no bloquear el montaje.
    const temporizador = window.setTimeout(() => manejarExpiracion(false), 0)
    return () => window.clearTimeout(temporizador)
  }, [manejarExpiracion, vencidaAlMontar])

  useEffect(() => {
    if (vencidaAlMontar || !tieneSesion()) {
      return undefined
    }

    const solicitud = { vigente: true }
    obtenerPerfil()
      .then((datos) => {
        if (solicitud.vigente) {
          if (!leerUltimaActividad()) {
            registrarActividad()
          }
          setPerfil(datos)
        }
      })
      .catch(() => {
        if (solicitud.vigente) {
          logout()
        }
      })
      .finally(() => {
        if (solicitud.vigente) {
          setCargando(false)
        }
      })

    return () => {
      solicitud.vigente = false
    }
  }, [manejarExpiracion, logout, vencidaAlMontar])

  const login = useCallback(async (usuario, password) => {
    const datos = await iniciarSesion(usuario, password)
    registrarActividad()
    ultimoRegistroRef.current = Date.now()
    pausadaRef.current = false
    expiracionRef.current = false
    setPausada(false)
    setPerfil(datos)
    return datos
  }, [])

  const user = useMemo(() => normalizarPerfil(perfil), [perfil])

  useEffect(() => {
    if (!user) {
      return undefined
    }

    const revisar = () => {
      if (pausadaRef.current || expiracionRef.current) {
        return
      }
      if (!tieneSesion()) {
        logout()
        return
      }
      if (inactividadVencida()) {
        manejarExpiracion()
      }
    }

    const intervalo = window.setInterval(revisar, INTERVALO_REVISION)
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        revisar()
      }
    }
    const alRecuperar = () => revisar()

    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    window.addEventListener('focus', alRecuperar)
    window.addEventListener('pageshow', alRecuperar)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      window.removeEventListener('focus', alRecuperar)
      window.removeEventListener('pageshow', alRecuperar)
    }
  }, [user, logout, manejarExpiracion])

  useEffect(() => {
    if (!user) {
      return undefined
    }

    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

    const alHaberActividad = () => {
      if (pausadaRef.current || expiracionRef.current) {
        return
      }
      const ahora = Date.now()
      if (ahora - ultimoRegistroRef.current < THROTTLE_ACTIVIDAD) {
        return
      }
      ultimoRegistroRef.current = ahora
      registrarActividad()
    }

    eventos.forEach((evento) =>
      window.addEventListener(evento, alHaberActividad, { passive: true }),
    )

    return () => {
      eventos.forEach((evento) =>
        window.removeEventListener(evento, alHaberActividad),
      )
    }
  }, [user])

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
      pausada,
      codigos: user?.codigos ?? [],
      login,
      logout,
      puedeVer,
      puedeEscribir,
    }),
    [
      user,
      perfil,
      cargando,
      pausada,
      login,
      logout,
      puedeVer,
      puedeEscribir,
    ],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
