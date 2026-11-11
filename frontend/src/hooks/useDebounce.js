import { useEffect, useState } from 'react'

/**
 * Devuelve `valor` recién después de que el usuario deja de escribir
 * durante `demora` milisegundos.
 */
export default function useDebounce(valor, demora = 350) {
  const [diferido, setDiferido] = useState(valor)

  useEffect(() => {
    const temporizador = setTimeout(() => setDiferido(valor), demora)
    return () => clearTimeout(temporizador)
  }, [valor, demora])

  return diferido
}
