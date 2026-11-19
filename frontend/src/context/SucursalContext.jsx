import { useCallback, useMemo, useState } from 'react'
import { useAuth } from './auth-context'
import { SucursalContext } from './sucursal-context'

const CLAVE = 'corralon.sucursal'

export function SucursalProvider({ children }) {
  const { user } = useAuth()
  const sucursales = useMemo(() => user?.sucursales ?? [], [user])
  const [seleccionada, setSeleccionada] = useState(
    () => localStorage.getItem(CLAVE) || '',
  )

  // Con una sola sucursal asignada queda siempre activa: asi los listados
  // (cajas, ventas, stock) nunca muestran datos de otra sucursal.
  const sucursalActiva = useMemo(() => {
    if (sucursales.length === 1) {
      return String(sucursales[0].id)
    }
    const existe = sucursales.some(
      (sucursal) => String(sucursal.id) === String(seleccionada),
    )
    return existe ? String(seleccionada) : ''
  }, [sucursales, seleccionada])

  const cambiarSucursal = useCallback((valor) => {
    const texto = valor ? String(valor) : ''
    setSeleccionada(texto)
    if (texto) {
      localStorage.setItem(CLAVE, texto)
    } else {
      localStorage.removeItem(CLAVE)
    }
  }, [])

  const sucursalDetalle = sucursales.find(
    (sucursal) => String(sucursal.id) === sucursalActiva,
  )

  const valor = useMemo(
    () => ({
      sucursales,
      sucursalActiva,
      sucursalDetalle,
      cambiarSucursal,
      haySeleccion: Boolean(sucursalActiva),
    }),
    [sucursales, sucursalActiva, sucursalDetalle, cambiarSucursal],
  )

  return (
    <SucursalContext.Provider value={valor}>
      {children}
    </SucursalContext.Provider>
  )
}
