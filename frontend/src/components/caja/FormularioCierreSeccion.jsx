import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { IconCash, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { nuevaClave } from '../../utils/clave'
import { formatearMoneda, sinSucursal } from '../../utils/formato'
import MensajeError from '../common/MensajeError.jsx'

const MAXIMO_MONTO = 9999999999.99

function validarMonto(valor, etiqueta) {
  const texto = String(valor ?? '').trim()
  if (!texto) {
    return `Ingresá el ${etiqueta}.`
  }
  const numero = Number(texto.replace(',', '.'))
  if (!Number.isFinite(numero)) {
    return `El ${etiqueta} debe ser un número.`
  }
  if (numero < 0) {
    return `El ${etiqueta} no puede ser negativo.`
  }
  if (numero > MAXIMO_MONTO) {
    return `El ${etiqueta} es demasiado grande.`
  }
  const partes = texto.replace(',', '.').split('.')
  if (partes[1] && partes[1].length > 2) {
    return `El ${etiqueta} admite hasta 2 decimales.`
  }
  return ''
}

function numeroValido(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) {
    return null
  }
  const numero = Number(texto.replace(',', '.'))
  if (!Number.isFinite(numero) || numero < 0 || numero > MAXIMO_MONTO) {
    return null
  }
  const partes = texto.replace(',', '.').split('.')
  if (partes[1] && partes[1].length > 2) {
    return null
  }
  return numero
}

function netoRealDe(fila, reales) {
  if (fila.es_efectivo) {
    return null
  }
  const real = reales[fila.metodo_pago] || {}
  const cobrado = numeroValido(real.cobrado)
  const pagado = numeroValido(real.pagado)
  if (cobrado === null || pagado === null) {
    return null
  }
  return cobrado - pagado
}

function diferenciaDe(fila, montos, reales) {
  if (fila.es_efectivo) {
    const contado = numeroValido(montos[fila.metodo_pago])
    if (contado === null) {
      return null
    }
    return contado - Number(fila.monto_sistema)
  }
  const neto = netoRealDe(fila, reales)
  if (neto === null) {
    return null
  }
  return neto - Number(fila.neto_sistema ?? fila.monto_sistema)
}

function claseDiferencia(valor) {
  if (valor === null) {
    return 'caja-diferencia-cero'
  }
  if (valor > 0) {
    return 'caja-diferencia-positiva'
  }
  if (valor < 0) {
    return 'caja-diferencia-negativa'
  }
  return 'caja-diferencia-cero'
}

export default function FormularioCierreSeccion({
  seccion,
  onCerrar,
  onGuardado,
}) {
  const [teorico, setTeorico] = useState([])
  const [montos, setMontos] = useState({})
  const [reales, setReales] = useState({})
  const [observaciones, setObservaciones] = useState('')
  // Contraseña del usuario autenticado: obligatoria para cerrar.
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const [passwordTocada, setPasswordTocada] = useState(false)
  // Clave de idempotencia: si el cierre se reintenta, no repite el arqueo.
  const [claveCierre] = useState(() => nuevaClave())

  useEffect(() => {
    let vigente = true
    pedir(`/movimientos-caja/${seccion.id}/teorico/`)
      .then((datos) => {
        if (!vigente) {
          return
        }
        setTeorico(datos)
        const caja = {}
        const noEfectivo = {}
        datos.forEach((fila) => {
          if (fila.es_efectivo) {
            caja[fila.metodo_pago] =
              Number(fila.monto_sistema) >= 0 ? fila.monto_sistema : ''
          } else {
            noEfectivo[fila.metodo_pago] = {
              cobrado: fila.cobrado_sistema,
              pagado: fila.pagado_sistema,
            }
          }
        })
        setMontos(caja)
        setReales(noEfectivo)
        setCargando(false)
      })
      .catch((e) => {
        if (!vigente) {
          return
        }
        setErrorCarga(e.message)
        setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [seccion.id])

  const totalSistema = teorico.reduce(
    (acumulado, fila) => acumulado + Number(fila.monto_sistema),
    0,
  )
  const totalReal = teorico.reduce((acumulado, fila) => {
    if (fila.es_efectivo) {
      return acumulado + (numeroValido(montos[fila.metodo_pago]) ?? 0)
    }
    const neto = netoRealDe(fila, reales)
    return acumulado + (neto ?? 0)
  }, 0)
  const totalDiferencia = totalReal - totalSistema

  const hayErrorMontos = teorico.some((fila) => {
    if (fila.es_efectivo) {
      return Boolean(
        validarMonto(
          montos[fila.metodo_pago],
          `monto contado en ${fila.metodo_pago_detalle}`,
        ),
      )
    }
    const real = reales[fila.metodo_pago] || {}
    return (
      Boolean(
        validarMonto(
          real.cobrado,
          `monto cobrado en ${fila.metodo_pago_detalle}`,
        ),
      ) ||
      Boolean(
        validarMonto(
          real.pagado,
          `monto pagado en ${fila.metodo_pago_detalle}`,
        ),
      )
    )
  })

  const formularioInvalido =
    guardando || teorico.length === 0 || hayErrorMontos || !password

  function cambiarContado(fila, valor) {
    setMontos((actuales) => ({
      ...actuales,
      [fila.metodo_pago]: valor,
    }))
    const mensaje = validarMonto(
      valor,
      `monto contado en ${fila.metodo_pago_detalle}`,
    )
    setErrores((previos) => {
      const siguientes = { ...previos }
      const clave = String(fila.metodo_pago)
      if (mensaje) {
        siguientes[clave] = mensaje
      } else {
        delete siguientes[clave]
      }
      return siguientes
    })
  }

  function cambiarReal(fila, campo, valor) {
    setReales((actuales) => ({
      ...actuales,
      [fila.metodo_pago]: {
        ...(actuales[fila.metodo_pago] || {}),
        [campo]: valor,
      },
    }))
    const mensaje = validarMonto(
      valor,
      `el monto ${campo} en ${fila.metodo_pago_detalle}`,
    )
    setErrores((previos) => {
      const siguientes = { ...previos }
      const clave = `${fila.metodo_pago}-${campo}`
      if (mensaje) {
        siguientes[clave] = mensaje
      } else {
        delete siguientes[clave]
      }
      return siguientes
    })
  }

  async function cerrar() {
    const nuevos = {}
    const montosReales = {}
    teorico.forEach((fila) => {
      if (fila.es_efectivo) {
        const mensaje = validarMonto(
          montos[fila.metodo_pago],
          `monto contado en ${fila.metodo_pago_detalle}`,
        )
        if (mensaje) {
          nuevos[String(fila.metodo_pago)] = mensaje
        } else {
          montosReales[String(fila.metodo_pago)] = montos[fila.metodo_pago]
        }
      } else {
        const real = reales[fila.metodo_pago] || {}
        const errorCobrado = validarMonto(
          real.cobrado,
          `monto cobrado en ${fila.metodo_pago_detalle}`,
        )
        const errorPagado = validarMonto(
          real.pagado,
          `monto pagado en ${fila.metodo_pago_detalle}`,
        )
        if (errorCobrado) {
          nuevos[`${fila.metodo_pago}-cobrado`] = errorCobrado
        }
        if (errorPagado) {
          nuevos[`${fila.metodo_pago}-pagado`] = errorPagado
        }
        if (!errorCobrado && !errorPagado) {
          montosReales[String(fila.metodo_pago)] = {
            cobrado: real.cobrado,
            pagado: real.pagado,
          }
        }
      }
    })

    if (!password) {
      nuevos.password = 'Ingresá tu contraseña para cerrar el movimiento.'
      setPasswordTocada(true)
    }

    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    const resultado = await Swal.fire({
      title: `¿Cerrar el movimiento #${seccion.id}?`,
      text: 'Se guarda el arqueo por método de pago y ya no se puede cobrar ni modificar.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Volver',
    })
    if (!resultado.isConfirmed) {
      return
    }

    setGuardando(true)
    try {
      const cerrada = await pedir(`/movimientos-caja/${seccion.id}/cerrar/`, {
        method: 'POST',
        body: JSON.stringify({
          clave: claveCierre,
          montos_reales: montosReales,
          observaciones: observaciones.trim() || null,
          password,
        }),
      })
      onGuardado?.(cerrada, true)
    } catch (e) {
      if (e.campos) {
        setErrores(e.campos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      if (e.message.toLowerCase().includes('contraseñ')) {
        setErrores((actuales) => ({ ...actuales, password: e.message }))
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cerrar el movimiento',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-cierre">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconCash size={24} />
            Cerrar movimiento #{seccion.id}
          </h2>
          <button
            type="button"
            className="comercial-modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <IconX size={20} />
          </button>
        </div>

        {cargando ? (
          <p className="comercial-nota">
            <IconLoader2 className="icono-girando" size={18} />
            Calculando el teórico por método de pago…
          </p>
        ) : (
          <>
            {errorCarga && <p className="comercial-error">{errorCarga}</p>}

            <div className="caja-detalle-grid">
              <div>
                <span>Caja física</span>
                <strong>
                  {sinSucursal(seccion.caja_detalle, seccion.sucursal_detalle)}
                </strong>
              </div>
              <div>
                <span>Empleado</span>
                <strong>{seccion.empleado_detalle}</strong>
              </div>
              <div>
                <span>Monto inicial</span>
                <strong>{formatearMoneda(seccion.monto_inicial)}</strong>
              </div>
            </div>

            <table className="caja-cierre-tabla caja-cierre-tabla-desglose">
              <thead>
                <tr>
                  <th rowSpan="2">Método</th>
                  <th colSpan="2">Cobrado</th>
                  <th colSpan="2">Pagado</th>
                  <th colSpan="3">Neto</th>
                </tr>
                <tr>
                  <th>Teórico</th>
                  <th>Real</th>
                  <th>Teórico</th>
                  <th>Real</th>
                  <th>Teórico</th>
                  <th>Real</th>
                  <th>Dif.</th>
                </tr>
              </thead>
              <tbody>
                {teorico.map((fila) => {
                  const esEfectivo = fila.es_efectivo
                  const real = reales[fila.metodo_pago] || {}
                  const netoReal = netoRealDe(fila, reales)
                  const diferencia = diferenciaDe(fila, montos, reales)
                  return (
                    <tr key={fila.metodo_pago}>
                      <td>
                        {fila.metodo_pago_detalle}
                        {esEfectivo && (
                          <>
                            {' '}
                            <span className="caja-chip-efectivo">efectivo</span>
                          </>
                        )}
                      </td>
                      <td className="mono">
                        {formatearMoneda(
                          fila.cobrado_sistema ?? fila.monto_sistema,
                        )}
                      </td>
                      <td>
                        {esEfectivo ? (
                          '—'
                        ) : (
                          <>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              className={
                                errores[`${fila.metodo_pago}-cobrado`]
                                  ? 'caja-cierre-input input-error'
                                  : 'caja-cierre-input'
                              }
                              value={real.cobrado ?? ''}
                              onChange={(evento) =>
                                cambiarReal(
                                  fila,
                                  'cobrado',
                                  evento.target.value,
                                )
                              }
                              placeholder="0.00"
                              aria-label={`Real cobrado en ${fila.metodo_pago_detalle}`}
                              aria-invalid={Boolean(
                                errores[`${fila.metodo_pago}-cobrado`],
                              )}
                            />
                            <MensajeError>
                              {errores[`${fila.metodo_pago}-cobrado`]}
                            </MensajeError>
                          </>
                        )}
                      </td>
                      <td className="mono">
                        {formatearMoneda(fila.pagado_sistema ?? 0)}
                      </td>
                      <td>
                        {esEfectivo ? (
                          '—'
                        ) : (
                          <>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              className={
                                errores[`${fila.metodo_pago}-pagado`]
                                  ? 'caja-cierre-input input-error'
                                  : 'caja-cierre-input'
                              }
                              value={real.pagado ?? ''}
                              onChange={(evento) =>
                                cambiarReal(
                                  fila,
                                  'pagado',
                                  evento.target.value,
                                )
                              }
                              placeholder="0.00"
                              aria-label={`Real pagado en ${fila.metodo_pago_detalle}`}
                              aria-invalid={Boolean(
                                errores[`${fila.metodo_pago}-pagado`],
                              )}
                            />
                            <MensajeError>
                              {errores[`${fila.metodo_pago}-pagado`]}
                            </MensajeError>
                          </>
                        )}
                      </td>
                      <td className="mono">
                        {formatearMoneda(fila.monto_sistema)}
                      </td>
                      <td className="mono">
                        {esEfectivo ? (
                          <>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              className={
                                errores[String(fila.metodo_pago)]
                                  ? 'caja-cierre-input input-error'
                                  : 'caja-cierre-input'
                              }
                              value={montos[fila.metodo_pago] ?? ''}
                              onChange={(evento) =>
                                cambiarContado(fila, evento.target.value)
                              }
                              placeholder="0.00"
                              aria-label={`Real contado en ${fila.metodo_pago_detalle}`}
                              aria-invalid={Boolean(
                                errores[String(fila.metodo_pago)],
                              )}
                            />
                            <MensajeError>
                              {errores[String(fila.metodo_pago)]}
                            </MensajeError>
                          </>
                        ) : netoReal === null ? (
                          '—'
                        ) : (
                          formatearMoneda(netoReal)
                        )}
                      </td>
                      <td className={`mono ${claseDiferencia(diferencia)}`}>
                        {diferencia === null
                          ? '—'
                          : formatearMoneda(diferencia)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5">Total</td>
                  <td className="mono">{formatearMoneda(totalSistema)}</td>
                  <td className="mono">
                    {hayErrorMontos ? '—' : formatearMoneda(totalReal)}
                  </td>
                  <td
                    className={`mono ${
                      hayErrorMontos
                        ? 'caja-diferencia-cero'
                        : claseDiferencia(totalDiferencia)
                    }`}
                  >
                    {hayErrorMontos ? '—' : formatearMoneda(totalDiferencia)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <p className="caja-nota-total">
              El neto teórico de efectivo incluye el monto inicial. Para los
              demás métodos, el neto es cobrado menos pagado.
            </p>

            {!hayErrorMontos && totalDiferencia !== 0 && (
              <p className="caja-aviso-diferencia" role="status">
                Diferencia de{' '}
                <strong>{formatearMoneda(Math.abs(totalDiferencia))}</strong>
                {totalDiferencia < 0 ? ' faltante' : ' sobrante'}: se registrará
                una nota automática del sistema con el detalle. Podés agregar
                observaciones si querés.
              </p>
            )}

            <label className="campo-comercial ancho-completo">
              <span>Observaciones del cierre</span>
              <textarea
                rows="2"
                maxLength="500"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                placeholder="Faltante, sobrante, comisión bancaria, etc."
              />
            </label>

            <label className="campo-comercial ancho-completo">
              <span>Tu contraseña *</span>
              <input
                type="password"
                autoComplete="current-password"
                className={errores.password ? 'input-error' : ''}
                value={password}
                onChange={(evento) => {
                  const valor = evento.target.value
                  setPassword(valor)
                  setPasswordTocada(true)
                  setErrores((previos) => {
                    const siguientes = { ...previos }
                    if (!valor) {
                      siguientes.password =
                        'Ingresá tu contraseña para cerrar el movimiento.'
                    } else {
                      delete siguientes.password
                    }
                    return siguientes
                  })
                }}
                placeholder="Se pide para confirmar el cierre"
                aria-invalid={Boolean(errores.password)}
              />
              <MensajeError>
                {errores.password ||
                  (passwordTocada && !password
                    ? 'Ingresá tu contraseña para cerrar el movimiento.'
                    : '')}
              </MensajeError>
              <p className="caja-nota-total">
                {password
                  ? 'Quien cierra queda registrado en el historial y en la actividad del sistema.'
                  : 'Ingresá tu contraseña para habilitar el cierre.'}
              </p>
            </label>

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={onCerrar}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="boton-comercial-primario"
                disabled={formularioInvalido}
                onClick={cerrar}
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    Cerrando…
                  </>
                ) : (
                  'Cerrar movimiento'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
