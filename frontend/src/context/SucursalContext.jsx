import { useEffect, useMemo } from 'react'
import { useAuth } from './auth-context'
import { SucursalContext } from './sucursal-context'

const CLAVE = 'corralon.sucursal'

export function SucursalProvider({ children }) {
  const { user } = useAuth()
  const sucursales = useMemo(() => user?.sucursales ?? [], [user])

  // El sistema opera con una sola sucursal. Si el perfil devuelve varias
  // (por ejemplo, una base vieja), se usa la marcada como central.
  const sucursalDetalle =
    sucursales.find((sucursal) => sucursal.es_central) ??
    sucursales[0] ??
    null
  const sucursalActiva = sucursalDetalle
    ? String(sucursalDetalle.id)
    : ''

  // Limpia la seleccion que guardaban las versiones anteriores.
  useEffect(() => {
    localStorage.removeItem(CLAVE)
  }, [])

  const valor = useMemo(
    () => ({
      sucursales,
      sucursalActiva,
      sucursalDetalle,
    }),
    [sucursales, sucursalActiva, sucursalDetalle],
  )

  return (
    <SucursalContext.Provider value={valor}>
      {children}
    </SucursalContext.Provider>
  )
}
