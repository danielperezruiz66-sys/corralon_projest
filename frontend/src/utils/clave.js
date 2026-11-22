/**
 * Clave de idempotencia.
 *
 * Identifica una operacion (cobro, pago, cierre) para que un reintento
 * —doble clic, corte de red, recarga— no la ejecute dos veces. El backend
 * guarda la clave y, si recibe la misma otra vez, devuelve el resultado
 * anterior en vez de cobrar o arquear de nuevo.
 */
export function nuevaClave() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
