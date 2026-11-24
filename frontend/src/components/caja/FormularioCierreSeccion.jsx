import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { IconCash, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { nuevaClave } from '../../utils/clave'
import { formatearMoneda, sinSucursal } from '../../utils/formato'
import MensajeError from '../common/MensajeError.jsx'
import { validarNumero } from '../../utils/validaciones'

function diferenciaDe(montos, fila) {
  const contado = montos[fila.metodo_pago]
  if (contado === '' || contado === undefined) {
    return null
  }
  return Number(contado) - Number(fila.monto_sistema)
}

export default function FormularioCierreSeccion({
  seccion,
  onCerrar,
  onGuardado,
}) {
  const [teorico, setTeorico] = useState([])
  const [montos, setMontos] = useState({})
  const [observaciones, setObservaciones] = useState('')
  // Contraseña del usuario autenticado: obligatoria para cerrar.
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
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
        setMontos(
          Object.fromEntries(
            datos.map((fila) => [fila.metodo_pago, fila.monto_sistema]),
          ),
        )
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
  const totalContado = teorico.reduce(
    (acumulado, fila) => acumulado + (Number(montos[fila.metodo_pago]) || 0),
    0,
  )
  const totalDiferencia = totalContado - totalSistema

  async function cerrar() {
    const nuevos = {}
    const montosReales = {}
    teorico.forEach((fila) => {
      const valor = montos[fila.metodo_pago]
      const mensaje = validarNumero(valor, {
        etiqueta: `El contado en ${fila.metodo_pago_detalle}`,
        mayorQueCero: false,
        decimales: 2,
        maximo: 9999999999.99,
      })
      if (mensaje) {
        nuevos[String(fila.metodo_pago)] = mensaje
      } else {
        montosReales[String(fila.metodo_pago)] =
          valor === '' || valor === undefined ? '0' : valor
      }
    })

    if (observaciones.trim().length < 10) {
      nuevos.observaciones = 'Indicá el motivo del cierre (10 caracteres o más).'
    }

    if (!password) {
      nuevos.password = 'Ingresá tu contraseña para cerrar la seccion.'
    }

    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    const resultado = await Swal.fire({
      title: `¿Cerrar la seccion #${seccion.id}?`,
      text: 'Se guarda el arqueo por metodo de pago y el motivo del cierre; ya no se puede cobrar ni modificar.',
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
        title: 'No se pudo cerrar la seccion',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconCash size={24} />
            Cerrar seccion #{seccion.id}
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
            Calculando el teorico por metodo de pago…
          </p>
        ) : (
          <>
            {errorCarga && <p className="comercial-error">{errorCarga}</p>}

            <div className="caja-detalle-grid">
              <div>
                <span>Caja fisica</span>
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

            <table className="caja-cierre-tabla">
              <thead>
                <tr>
                  <th>Metodo</th>
                  <th>Teorico</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {teorico.map((fila) => {
                  const diferencia = diferenciaDe(montos, fila)
                  let claseDiferencia = 'caja-diferencia-cero'
                  if (diferencia !== null) {
                    if (diferencia > 0) {
                      claseDiferencia = 'caja-diferencia-positiva'
                    } else if (diferencia < 0) {
                      claseDiferencia = 'caja-diferencia-negativa'
                    }
                  }
                  return (
                    <tr key={fila.metodo_pago}>
                      <td>
                        {fila.metodo_pago_detalle}
                        {fila.es_efectivo && (
                          <span className="caja-chip-efectivo">efectivo</span>
                        )}
                      </td>
                      <td className="mono">
                        {formatearMoneda(fila.monto_sistema)}
                      </td>
                      <td>
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
                          onChange={(evento) => {
                            setMontos((actuales) => ({
                              ...actuales,
                              [fila.metodo_pago]: evento.target.value,
                            }))
                            if (errores[String(fila.metodo_pago)]) {
                              setErrores((previos) => {
                                const siguientes = { ...previos }
                                delete siguientes[String(fila.metodo_pago)]
                                return siguientes
                              })
                            }
                          }}
                          placeholder="0.00"
                          aria-label={`Contado en ${fila.metodo_pago_detalle}`}
                        />
                        <MensajeError>{errores[String(fila.metodo_pago)]}</MensajeError>
                      </td>
                      <td className={`mono ${claseDiferencia}`}>
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
                  <td>Total</td>
                  <td className="mono">{formatearMoneda(totalSistema)}</td>
                  <td className="mono">{formatearMoneda(totalContado)}</td>
                  <td
                    className={`mono ${
                      totalDiferencia > 0
                        ? 'caja-diferencia-positiva'
                        : totalDiferencia < 0
                          ? 'caja-diferencia-negativa'
                          : 'caja-diferencia-cero'
                    }`}
                  >
                    {formatearMoneda(totalDiferencia)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {totalDiferencia !== 0 && (
              <p className="caja-aviso-diferencia" role="status">
                Diferencia de{' '}
                <strong>{formatearMoneda(Math.abs(totalDiferencia))}</strong>
                {totalDiferencia < 0 ? ' faltante' : ' sobrante'}: se registrará
                una nota automática del sistema con el detalle. Indicá el motivo
                del cierre; se agregará a esa nota.
              </p>
            )}

            <label className="campo-comercial ancho-completo">
              <span>Observaciones del cierre *</span>
              <textarea
                rows="2"
                maxLength="500"
                className={errores.observaciones ? 'input-error' : ''}
                value={observaciones}
                onChange={(evento) => {
                  setObservaciones(evento.target.value)
                  if (errores.observaciones) {
                    setErrores((previos) => {
                      const siguientes = { ...previos }
                      delete siguientes.observaciones
                      return siguientes
                    })
                  }
                }}
                placeholder="Indicá el motivo del cierre: faltante, sobrante, rotura de billete, etc."
              />
              <MensajeError>{errores.observaciones}</MensajeError>
            </label>

            <label className="campo-comercial ancho-completo">
              <span>Tu contraseña *</span>
              <input
                type="password"
                autoComplete="current-password"
                className={errores.password ? 'input-error' : ''}
                value={password}
                onChange={(evento) => {
                  setPassword(evento.target.value)
                  if (errores.password) {
                    setErrores((previos) => {
                      const siguientes = { ...previos }
                      delete siguientes.password
                      return siguientes
                    })
                  }
                }}
                placeholder="Se pide para confirmar el cierre"
              />
              <MensajeError>{errores.password}</MensajeError>
              <p className="caja-nota-total">
                Quien cierra queda registrado en el historial y en la
                actividad del sistema.
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
                disabled={guardando || teorico.length === 0}
                onClick={cerrar}
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    Cerrando…
                  </>
                ) : (
                  'Cerrar seccion'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
