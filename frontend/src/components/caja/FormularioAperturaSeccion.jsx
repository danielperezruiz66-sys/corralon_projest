import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { IconCash, IconLoader2, IconX } from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import { useAuth } from '../../context/auth-context'
import MensajeError from '../common/MensajeError.jsx'
import {
  formatearFechaHora,
  formatearMoneda,
} from '../../utils/formato'
import { validarNumero } from '../../utils/validaciones'

function nombreEmpleado(empleado) {
  return `${empleado.apellido}, ${empleado.nombre} (${empleado.legajo})`
}

export default function FormularioAperturaSeccion({
  sucursalActiva,
  sucursalNombre,
  cajasDisponibles,
  onCerrar,
  onGuardado,
}) {
  const { user } = useAuth()
  const codigos = user?.codigos ?? []
  const esGestion = Boolean(
    user?.is_superuser ||
      codigos.includes('AD') ||
      codigos.includes('GE'),
  )
  const empleadoPropio = user?.empleado ?? null

  const [caja, setCaja] = useState(() =>
    cajasDisponibles.length > 0 ? String(cajasDisponibles[0].caja) : '',
  )
  const [montoInicial, setMontoInicial] = useState('0')
  // '' => se abre a nombre del usuario actual (solo si tiene empleado).
  const [aperturaPara, setAperturaPara] = useState('')
  const [elegibles, setElegibles] = useState([])
  const [cargandoElegibles, setCargandoElegibles] = useState(() => esGestion)
  const [errorElegibles, setErrorElegibles] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const [sugerencia, setSugerencia] = useState({
    monto_sugerido: '0.00',
    encontrado: false,
  })
  const [observaciones, setObservaciones] = useState('')
  const valorActual =
    caja ||
    (cajasDisponibles.length > 0 ? String(cajasDisponibles[0].caja) : '')

  // Sugerencia de monto inicial: efectivo contado en el último cierre de la
  // caja en esta sucursal. Al cambiar de caja se repone el campo.
  useEffect(() => {
    if (!valorActual) {
      return undefined
    }
    let vigente = true

    pedir(
      `/secciones-caja/sugerencia/?caja=${valorActual}&sucursal=${sucursalActiva}`,
    )
      .then((datos) => {
        if (!vigente) {
          return
        }
        setSugerencia(datos)
        setMontoInicial(datos.monto_sugerido)
      })
      .catch(() => {
        if (vigente) {
          setSugerencia({ monto_sugerido: '0.00', encontrado: false })
        }
      })

    return () => {
      vigente = false
    }
  }, [valorActual, sucursalActiva])

  // Empleados habilitados para abrir caja en la sucursal elegida
  // (AD/GE en cualquiera; CA solo si esta asignado). Solo para AD/GE.
  useEffect(() => {
    if (!esGestion) {
      return undefined
    }
    let vigente = true

    pedirTodas(`/empleados/?estado=AC&puede_operar_caja=${sucursalActiva}`)
      .then((lista) => {
        if (vigente) {
          setElegibles(lista)
        }
      })
      .catch((e) => {
        if (vigente) {
          setErrorElegibles(e.message)
        }
      })
      .finally(() => {
        if (vigente) {
          setCargandoElegibles(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [esGestion, sucursalActiva])

  const elegiblesOtros = empleadoPropio
    ? elegibles.filter(
        (empleado) => String(empleado.id) !== String(empleadoPropio.id),
      )
    : elegibles

  const sinPropio = !empleadoPropio
  const sinEmpleadoParaElegir = !esGestion && sinPropio
  const seleccionInvalida = esGestion && sinPropio && !aperturaPara
  const sinElegibles = esGestion && sinPropio && !cargandoElegibles && elegibles.length === 0
  // El motivo es obligatorio cuando el monto difiere del sugerido.
  const motivoObligatorio =
    Number(montoInicial) !== Number(sugerencia.monto_sugerido)

  const notaCabecera = empleadoPropio
    ? esGestion
      ? 'Se abre a tu nombre o a nombre de un empleado habilitado (AD/GE o cajero asignado a la sucursal). Queda registrado quien la abre.'
      : 'La seccion se abre a tu nombre.'
    : esGestion
      ? 'Tu usuario no tiene un empleado asociado: elegi a nombre de quien se abre la seccion. Queda registrado quien la abre.'
      : 'Tu usuario no tiene un empleado asociado. Pedile a un administrador que te asocie uno para poder abrir la caja.'

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}

    if (!valorActual) {
      nuevos.caja = 'Elegí una caja física.'
    }

    const montoError = validarNumero(montoInicial, {
      etiqueta: 'El monto inicial',
      mayorQueCero: false,
      decimales: 2,
      maximo: 9999999999.99,
    })
    if (montoError) {
      nuevos.monto_inicial = montoError
    }

    if (seleccionInvalida || sinElegibles) {
      nuevos.empleado = sinElegibles
        ? 'No hay empleados habilitados para abrir caja en esta sucursal.'
        : 'Elegí a nombre de quién se abre la sección.'
    }

    if (motivoObligatorio && observaciones.trim() === '') {
      nuevos.observaciones_apertura =
        'Indicá el motivo del monto inicial (difiere del efectivo contado en el último cierre).'
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
      const cuerpo = {
        caja: Number(valorActual),
        sucursal: Number(sucursalActiva),
        monto_inicial: montoInicial,
      }
      if (esGestion && aperturaPara) {
        cuerpo.empleado = Number(aperturaPara)
      }
      const motivo = observaciones.trim()
      if (motivo) {
        cuerpo.observaciones_apertura = motivo
      }
      const guardada = await pedir('/secciones-caja/', {
        method: 'POST',
        body: JSON.stringify(cuerpo),
      })
      onGuardado?.(guardada, false)
    } catch (e) {
      if (e.campos?.empleado) {
        setErrores((actual) => ({ ...actual, empleado: e.campos.empleado }))
      }
      if (e.message?.toLowerCase().includes('motivo')) {
        setErrores((actual) => ({
          ...actual,
          observaciones_apertura: e.message,
        }))
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo abrir la seccion',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  const sinDisponibles = cajasDisponibles.length === 0
  const botonDeshabilitado =
    guardando ||
    sinDisponibles ||
    sinEmpleadoParaElegir ||
    (esGestion && sinPropio && cargandoElegibles)

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-angosto">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconCash size={24} />
            Abrir seccion de caja
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

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <p className="caja-nota-total ancho-completo">
            Se abrirá en <strong>{sucursalNombre}</strong>. {notaCabecera}
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Caja fisica *</span>
            <select
              className={errores.caja ? 'input-error' : ''}
              value={valorActual}
              onChange={(evento) => setCaja(evento.target.value)}
              disabled={sinDisponibles}
            >
              {sinDisponibles ? (
                <option value="">No hay cajas disponibles</option>
              ) : (
                cajasDisponibles.map((disponible) => (
                  <option key={disponible.id} value={disponible.caja}>
                    {disponible.caja_detalle}
                  </option>
                ))
              )}
            </select>
            <MensajeError>{errores.caja}</MensajeError>
            {sinDisponibles && (
              <p className="caja-nota-total">
                Todas las cajas físicas habilitadas en esta sucursal ya tienen
                una seccion abierta. Cerrá una para poder abrir otra.
              </p>
            )}
          </label>

          {empleadoPropio ? (
            <div className="campo-comercial ancho-completo">
              <span>Empleado</span>
              {esGestion ? (
                <>
                  <select
                    className={errores.empleado ? 'input-error' : ''}
                    value={aperturaPara}
                    onChange={(evento) => setAperturaPara(evento.target.value)}
                  >
                    <option value="">
                      Yo mismo ({nombreEmpleado(empleadoPropio)})
                    </option>
                    {elegiblesOtros.map((empleado) => (
                      <option key={empleado.id} value={empleado.id}>
                        {nombreEmpleado(empleado)}
                      </option>
                    ))}
                  </select>
                  {cargandoElegibles && (
                    <p className="caja-nota-total">
                      Cargando empleados habilitados…
                    </p>
                  )}
                  {errorElegibles && (
                    <p className="caja-nota-total">
                      No se pudo cargar la lista de empleados: {errorElegibles}.
                      La sección se abre a tu nombre.
                    </p>
                  )}
                </>
              ) : (
                <p className="caja-nota-total">
                  Se abrirá a tu nombre:{' '}
                  <strong>{nombreEmpleado(empleadoPropio)}</strong>
                </p>
              )}
              <MensajeError>{errores.empleado}</MensajeError>
            </div>
          ) : (
            <label className="campo-comercial ancho-completo">
              <span>Empleado *</span>
              {esGestion ? (
                <>
                  <select
                    className={errores.empleado ? 'input-error' : ''}
                    value={aperturaPara}
                    onChange={(evento) => setAperturaPara(evento.target.value)}
                    disabled={cargandoElegibles || sinElegibles}
                  >
                    <option value="">
                      {cargandoElegibles
                        ? 'Cargando empleados habilitados…'
                        : 'Elegí a nombre de quién se abre…'}
                    </option>
                    {elegibles.map((empleado) => (
                      <option key={empleado.id} value={empleado.id}>
                        {nombreEmpleado(empleado)}
                      </option>
                    ))}
                  </select>
                  {sinElegibles && (
                    <p className="caja-nota-total">
                      No hay empleados habilitados para abrir caja en esta
                      sucursal (AD/GE en cualquiera; cajero asignado a la
                      sucursal).
                    </p>
                  )}
                  {errorElegibles && (
                    <p className="caja-nota-total">
                      No se pudo cargar la lista de empleados: {errorElegibles}.
                    </p>
                  )}
                </>
              ) : (
                <p className="caja-nota-total">
                  Tu usuario no tiene un empleado asociado. Pedile a un
                  administrador que te asocie uno para poder abrir la caja.
                </p>
              )}
              <MensajeError>{errores.empleado}</MensajeError>
            </label>
          )}

          <label className="campo-comercial ancho-completo">
            <span>Monto inicial</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={errores.monto_inicial ? 'input-error' : ''}
              value={montoInicial}
              onChange={(evento) => setMontoInicial(evento.target.value)}
            />
            <MensajeError>{errores.monto_inicial}</MensajeError>
            <p className="caja-nota-total">
              {sugerencia.encontrado ? (
                <>
                  Sugerido: <strong>{formatearMoneda(Number(sugerencia.monto_sugerido))}</strong>
                  {' · '}efectivo contado en la seccion #{sugerencia.seccion_id}
                  {sugerencia.fecha_hora_cierre
                    ? ` (cerrada el ${formatearFechaHora(sugerencia.fecha_hora_cierre)})`
                    : ''}
                  .{' '}
                  {motivoObligatorio
                    ? 'Como lo modificaste, indicá el motivo.'
                    : 'Podés modificarlo; si lo hacés, pediremos el motivo.'}
                </>
              ) : (
                'Primera apertura de la caja en esta sucursal o sin cierre previo: el monto base es 0.'
              )}
            </p>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Observación de apertura{motivoObligatorio ? ' *' : ''}</span>
            <textarea
              rows="2"
              maxLength="500"
              className={errores.observaciones_apertura ? 'input-error' : ''}
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              placeholder={
                motivoObligatorio
                  ? 'Por qué se agrega o se quita dinero respecto del cierre anterior…'
                  : 'Opcional: si modificás el monto inicial, indicá el motivo…'
              }
            />
            <MensajeError>{errores.observaciones_apertura}</MensajeError>
          </label>

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
              disabled={botonDeshabilitado}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Abriendo…
                </>
              ) : (
                'Abrir seccion'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
