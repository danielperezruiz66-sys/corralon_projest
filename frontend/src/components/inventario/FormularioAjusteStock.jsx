import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconAdjustments,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { pedirTodas } from '../../api/catalogos'
import { formatearFechaHora, formatearNumero } from '../../utils/formato'
import {
  unidadPermiteDecimales,
  validarCantidadPorUnidad,
  validarTexto,
} from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'

let ingresoSeq = 0
function nuevoIngreso() {
  ingresoSeq += 1
  return {
    key: `ing-${ingresoSeq}`,
    deposito: '',
    cantidad: '',
    fecha_venc: '',
  }
}

function aNumero(valor) {
  const numero = Number(String(valor ?? '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : 0
}

function normalizarCantidad(valor, permiteDecimales) {
  const numero = aNumero(valor)
  if (!Number.isFinite(numero)) return '0.000'
  if (!permiteDecimales) return String(Math.trunc(numero))
  return numero.toFixed(3)
}

export default function FormularioAjusteStock({
  stock,
  depositos = [],
  onCerrar,
  onGuardado,
}) {
  const [lotes, setLotes] = useState([])
  const [cantidades, setCantidades] = useState({})
  const [ingresos, setIngresos] = useState([])
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  const unidad = stock.producto_unidad_detalle || ''
  const permiteDecimales = unidadPermiteDecimales(unidad)
  const step = permiteDecimales ? '0.001' : '1'

  useEffect(() => {
    let vigente = true
    setCargando(true)
    pedirTodas(`/detalles-stock/?stock=${stock.id}`)
      .then((datos) => {
        if (!vigente) return
        const conStock = (datos || []).filter((l) => aNumero(l.cantidad) > 0)
        setLotes(conStock)
        const inicial = {}
        conStock.forEach((l) => {
          inicial[l.id] = String(l.cantidad)
        })
        setCantidades(inicial)
      })
      .catch((e) => {
        if (vigente) {
          Swal.fire({
            icon: 'error',
            title: 'No se pudieron cargar los lotes',
            text: e.message,
            confirmButtonColor: '#4a9da8',
          })
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [stock.id])

  function cambiarCantidadLote(id, valor) {
    setCantidades((prev) => ({ ...prev, [id]: valor }))
  }

  function agregarIngreso() {
    setIngresos((prev) => [...prev, nuevoIngreso()])
  }

  function cambiarIngreso(key, campo, valor) {
    setIngresos((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [campo]: valor } : item)),
    )
  }

  function quitarIngreso(key) {
    setIngresos((prev) => prev.filter((item) => item.key !== key))
  }

  const totalActualLotes = lotes.reduce(
    (acc, l) => acc + aNumero(l.cantidad),
    0,
  )
  const totalResultanteLotes = lotes.reduce(
    (acc, l) => acc + aNumero(cantidades[l.id]),
    0,
  )
  const totalIngresos = ingresos.reduce(
    (acc, i) => acc + aNumero(i.cantidad),
    0,
  )
  const totalFinal = totalResultanteLotes + totalIngresos
  const diferencia = totalFinal - aNumero(stock.cantidad)

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}

    const errorMotivo = validarTexto(motivo, 'El motivo', { min: 3, max: 90 })
    if (errorMotivo) nuevos.motivo = errorMotivo

    const reducciones = []
    for (const lote of lotes) {
      const actual = aNumero(lote.cantidad)
      const valor = cantidades[lote.id]
      if (valor === '' || valor === undefined || valor === null) {
        nuevos[`lote-${lote.id}`] = 'Ingresá la cantidad resultante.'
        continue
      }
      const nueva = aNumero(valor)
      if (!Number.isFinite(nueva) || nueva < 0) {
        nuevos[`lote-${lote.id}`] = 'La cantidad no puede ser negativa.'
        continue
      }
      if (nueva > actual) {
        nuevos[`lote-${lote.id}`] =
          'No puede ser mayor al stock actual del lote.'
        continue
      }
      if (!permiteDecimales && !Number.isInteger(nueva)) {
        nuevos[`lote-${lote.id}`] =
          'La cantidad debe ser un número entero para esta unidad.'
        continue
      }
      if (nueva !== actual) {
        reducciones.push({
          detalle: lote.id,
          cantidad_nueva: normalizarCantidad(nueva, permiteDecimales),
        })
      }
    }

    const ingresosPayload = []
    ingresos.forEach((ingreso) => {
      if (!ingreso.deposito) {
        nuevos[`ing-dep-${ingreso.key}`] = 'Seleccioná un depósito.'
      }
      const errorCantidad = validarCantidadPorUnidad(
        ingreso.cantidad,
        unidad,
        'La cantidad a ingresar',
      )
      if (errorCantidad) {
        nuevos[`ing-cant-${ingreso.key}`] = errorCantidad
      }
      if (
        ingreso.deposito &&
        !errorCantidad &&
        aNumero(ingreso.cantidad) > 0
      ) {
        ingresosPayload.push({
          deposito: Number(ingreso.deposito),
          cantidad: normalizarCantidad(ingreso.cantidad, permiteDecimales),
          fecha_venc: ingreso.fecha_venc || null,
        })
      }
    })

    if (!errorMotivo && reducciones.length === 0 && ingresosPayload.length === 0) {
      nuevos.general = 'Realizá al menos un cambio (reducí un lote o agregá un ingreso).'
    }

    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErrores({})
    setGuardando(true)
    try {
      const actualizado = await pedir(`/stocks/${stock.id}/ajustar/`, {
        method: 'POST',
        body: JSON.stringify({
          motivo: motivo.trim(),
          reducciones,
          ingresos: ingresosPayload,
        }),
      })
      onGuardado?.(actualizado)
    } catch (e) {
      if (e.campos) {
        setErrores(e.campos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo ajustar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal inventario-modal-ancho">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconAdjustments size={24} />
            Ajustar stock
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

        <div className="cobro-resumen">
          <div>
            <span>Producto</span>
            <strong>{stock.producto_detalle}</strong>
          </div>
          <div>
            <span>Sucursal</span>
            <strong>{stock.sucursal_detalle}</strong>
          </div>
          <div>
            <span>Stock actual</span>
            <strong>{formatearNumero(stock.cantidad)}</strong>
          </div>
          <div>
            <span>Stock resultante</span>
            <strong>{formatearNumero(totalFinal)}</strong>
          </div>
        </div>

        {cargando ? (
          <p className="comercial-nota">
            <IconLoader2 className="icono-girando" size={18} /> Cargando lotes…
          </p>
        ) : (
          <form onSubmit={guardar} className="comercial-grid" noValidate>
            <div className="ancho-completo">
              <h3 className="inventario-subtitulo">Lotes existentes (solo reducir)</h3>
              <p className="comercial-nota">
                Indicá la <strong>cantidad resultante</strong> de cada lote (0 a
                stock actual). Para sumar stock, usá “Agregar cantidad” (crea un
                lote nuevo).
              </p>
              <div className="comercial-tabla-scroll">
                <table className="tabla-comercial tabla-lineas">
                  <thead>
                    <tr>
                      <th>Depósito</th>
                      <th>Lote</th>
                      <th>Ingreso</th>
                      <th>Vencimiento</th>
                      <th className="numero">Actual</th>
                      <th className="numero">Nueva cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.length === 0 && (
                      <tr>
                        <td colSpan="6" className="comercial-vacio">
                          No hay lotes con stock para reducir en esta sucursal.
                        </td>
                      </tr>
                    )}
                    {lotes.map((lote) => (
                      <tr key={lote.id}>
                        <td>{lote.deposito_detalle}</td>
                        <td>{lote.lote || '—'}</td>
                        <td>{formatearFechaHora(lote.fecha_ingreso)}</td>
                        <td>{lote.fecha_venc || '—'}</td>
                        <td className="numero">
                          {formatearNumero(lote.cantidad)}
                        </td>
                        <td className="numero">
                          <input
                            type="number"
                            className={
                              errores[`lote-${lote.id}`] ? 'input-error' : ''
                            }
                            min="0"
                            max={String(lote.cantidad)}
                            step={step}
                            value={cantidades[lote.id] ?? ''}
                            onChange={(evento) =>
                              cambiarCantidadLote(lote.id, evento.target.value)
                            }
                          />
                          <MensajeError>
                            {errores[`lote-${lote.id}`]}
                          </MensajeError>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ancho-completo">
              <div className="inventario-subtitulo-con-accion">
                <h3 className="inventario-subtitulo">Agregar cantidad (nuevo lote)</h3>
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={agregarIngreso}
                >
                  <IconPlus size={16} />
                  Agregar cantidad
                </button>
              </div>
              {ingresos.length === 0 && (
                <p className="comercial-nota">
                  No hay ingresos nuevos. Usá “Agregar cantidad” para sumar stock
                  en un depósito (se creará un lote nuevo).
                </p>
              )}
              {ingresos.map((ingreso) => (
                <div key={ingreso.key} className="comercial-grid ingreso-ajuste-fila">
                  <div className="ancho-completo">
                    <CampoSelectorBuscable
                      etiqueta="Depósito para el ingreso"
                      valor={ingreso.deposito}
                      onCambiar={(valor) =>
                        cambiarIngreso(ingreso.key, 'deposito', valor)
                      }
                      opciones={depositos}
                      textoOpcion={(item) => item.nombre}
                      textoSecundario={(item) => item.sucursal_detalle || ''}
                      placeholder="Seleccionar depósito"
                    />
                    <MensajeError>
                      {errores[`ing-dep-${ingreso.key}`]}
                    </MensajeError>
                  </div>
                  <label className="campo-comercial">
                    <span>Cantidad a ingresar</span>
                    <input
                      type="number"
                      className={
                        errores[`ing-cant-${ingreso.key}`] ? 'input-error' : ''
                      }
                      min={step}
                      step={step}
                      value={ingreso.cantidad}
                      onChange={(evento) =>
                        cambiarIngreso(
                          ingreso.key,
                          'cantidad',
                          evento.target.value,
                        )
                      }
                    />
                    <MensajeError>
                      {errores[`ing-cant-${ingreso.key}`]}
                    </MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Vencimiento (opcional)</span>
                    <input
                      type="date"
                      value={ingreso.fecha_venc || ''}
                      onChange={(evento) =>
                        cambiarIngreso(
                          ingreso.key,
                          'fecha_venc',
                          evento.target.value,
                        )
                      }
                    />
                  </label>
                  <div className="campo-comercial campo-accion-ingreso">
                    <span>&nbsp;</span>
                    <button
                      type="button"
                      className="boton-icono boton-icono-peligro"
                      onClick={() => quitarIngreso(ingreso.key)}
                      title="Quitar ingreso"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <label className="campo-comercial ancho-completo">
              <span>Motivo *</span>
              <input
                type="text"
                className={errores.motivo ? 'input-error' : ''}
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Ej. Conteo físico, merma, rotura"
                maxLength={90}
              />
              <MensajeError>{errores.motivo}</MensajeError>
            </label>

            {errores.general && (
              <p className="comercial-error ancho-completo">{errores.general}</p>
            )}

            <p className="comercial-nota ancho-completo">
              Diferencia total: {diferencia > 0 ? '+' : ''}
              {formatearNumero(diferencia)} (actual {formatearNumero(stock.cantidad)} →{' '}
              {formatearNumero(totalFinal)}). El ajuste queda registrado como
              movimiento <strong>AJ</strong> por lote.
            </p>

            <div className="comercial-modal-acciones ancho-completo">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={onCerrar}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="boton-comercial-primario"
                disabled={guardando || cargando}
              >
                {guardando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    Ajustando…
                  </>
                ) : (
                  'Confirmar ajuste'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
