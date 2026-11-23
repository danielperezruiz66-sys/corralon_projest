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
    cajasDisponibles.length > 0 ? String(cajasDisponibles[0].id) : '',
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
    (cajasDisponibles.length > 0 ? String(cajasDisponibles[0].id) : '')

  // Sugerencia de monto inicial: efectivo contado en el último cierre de la
  // caja en esta sucursal. Al cambiar de caja se repone el campo.
  useEffect(() => {
    if (!valorActual) {
      return undefined
    }
    let vigente = true

    pedir(
      `/movimientos-caja/sugerencia/?caja=${valorActual}&sucursal=${sucursalActiva}`,
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
  const montoError = validarNumero(montoInicial, {
    etiqueta: 'El monto inicial',
    mayorQueCero: false,
    decimales: 2,
    maximo: 9999999999.99,
  })
  // El motivo es obligatorio cuando el monto difiere del sugerido.
  const motivoObligatorio =
    !montoError && Number(montoInicial) !== Number(sugerencia.monto_sugerido)
  const motivoFaltante = motivoObligatorio && observaciones.trim() === ''

  const notaCabecera = empleadoPropio
    ? esGestion
      ? 'Se abre a tu nombre o a nombre de un empleado habilitado (AD/GE o cajero). Queda registrado quién la abre.'
      : 'El movimiento se abre a tu nombre.'
    : esGestion
      ? 'Tu usuario no tiene un empleado asociado: elegí a nombre de quién se abre el movimiento. Queda registrado quién lo abre.'
      : 'Tu usuario no tiene un empleado asociado. Pedile a un administrador que te asocie uno para poder abrir la caja.'

  function cambiarMonto(evento) {
    const valor = evento.target.value
    setMontoInicial(valor)
    const mensaje = validarNumero(valor, {
      etiqueta: 'El monto inicial',
      mayorQueCero: false,
      decimales: 2,
      maximo: 9999999999.99,
    })
    const requiereMotivo =
      !mensaje && Number(valor) !== Number(sugerencia.monto_sugerido)
    setErrores((previos) => {
      const siguientes = { ...previos }
      if (mensaje) {
        siguientes.monto_inicial = mensaje
      } else {
        delete siguientes.monto_inicial
      }
      if (requiereMotivo && !observaciones.trim()) {
        siguientes.observaciones_apertura =
          'Indicá el motivo del monto inicial (difiere del efectivo contado en el último cierre).'
      } else if (!requiereMotivo) {
        delete siguientes.observaciones_apertura
      }
      return siguientes
    })
  }

  function cambiarObservaciones(evento) {
    const valor = evento.target.value
    setObservaciones(valor)
    setErrores((previos) => {
      const siguientes = { ...previos }
      if (motivoObligatorio && !valor.trim()) {
        siguientes.observaciones_apertura =
          'Indicá el motivo del monto inicial (difiere del efectivo contado en el último cierre).'
      } else {
        delete siguientes.observaciones_apertura
      }
      return siguientes
    })
  }

  function cambiarAperturaPara(evento) {
    const valor = evento.target.value
    setAperturaPara(valor)
    setErrores((previos) => {
      const siguientes = { ...previos }
      if (esGestion && !empleadoPropio && !valor) {
        siguientes.empleado = 'Elegí a nombre de quién se abre el movimiento.'
      } else {
        delete siguientes.empleado
      }
      return siguientes
    })
  }

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}

    if (!valorActual) {
      nuevos.caja = 'Elegí una caja física.'
    }

    const errorMonto = validarNumero(montoInicial, {
      etiqueta: 'El monto inicial',
      mayorQueCero: false,
      decimales: 2,
      maximo: 9999999999.99,
    })
    if (errorMonto) {
      nuevos.monto_inicial = errorMonto
    }

    if (seleccionInvalida || sinElegibles) {
      nuevos.empleado = sinElegibles
        ? 'No hay empleados habilitados para abrir caja.'
        : 'Elegí a nombre de quién se abre el movimiento.'
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
      const guardada = await pedir('/movimientos-caja/', {
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
        title: 'No se pudo abrir el movimiento',
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
    seleccionInvalida ||
    Boolean(montoError) ||
    motivoFaltante ||
    (esGestion && sinPropio && cargandoElegibles)

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-angosto">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconCash size={24} />
            Abrir movimiento de caja
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
            {notaCabecera}
          </p>

          <label className="campo-comercial ancho-completo">
            <span>Caja física *</span>
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
                  <option key={disponible.id} value={disponible.id}>
                    Caja {disponible.numero_caja}
                  </option>
                ))
              )}
            </select>
            <MensajeError>{errores.caja}</MensajeError>
            {sinDisponibles && (
              <p className="caja-nota-total">
                Todas las cajas ya tienen un movimiento abierto o en pausa.
                Cerrá uno para poder abrir otro.
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
                      El movimiento se abre a tu nombre.
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
                    onChange={cambiarAperturaPara}
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
                      No hay empleados habilitados para abrir caja (AD/GE
                      en cualquiera; cajero habilitado).
                    </p>
                  )}
                  {seleccionInvalida && !errores.empleado && (
                    <p className="caja-nota-total">
                      Elegí el empleado a nombre de quién se abre el
                      movimiento.
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
              onChange={cambiarMonto}
              aria-invalid={Boolean(errores.monto_inicial)}
            />
            <MensajeError>{errores.monto_inicial}</MensajeError>
            <p className="caja-nota-total">
              {sugerencia.encontrado ? (
                <>
                  Sugerido: <strong>{formatearMoneda(Number(sugerencia.monto_sugerido))}</strong>
                  {' · '}efectivo contado en el movimiento #{sugerencia.seccion_id}
                  {sugerencia.fecha_hora_cierre
                    ? ` (cerrada el ${formatearFechaHora(sugerencia.fecha_hora_cierre)})`
                    : ''}
                  .{' '}
                  {motivoObligatorio
                    ? 'Como lo modificaste, indicá el motivo.'
                    : 'Podés modificarlo; si lo hacés, pediremos el motivo.'}
                </>
              ) : (
                'Primera apertura de la caja o sin cierre previo: el monto base es 0.'
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
              onChange={cambiarObservaciones}
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
                'Abrir movimiento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
