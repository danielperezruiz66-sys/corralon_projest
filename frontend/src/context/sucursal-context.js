import { createContext, useContext } from 'react'

export const SucursalContext = createContext(null)

export function useSucursal() {
  const contexto = useContext(SucursalContext)
  if (!contexto) {
    throw new Error('useSucursal debe usarse dentro de SucursalProvider.')
  }
  return contexto
}
