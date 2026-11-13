import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconBuildingWarehouse,
  IconCash,
  IconCheck,
  IconDownload,
  IconEye,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import DetalleSeccionCaja from '../components/caja/DetalleSeccionCaja.jsx'
import FormularioAsignacionCaja from '../components/caja/FormularioAsignacionCaja.jsx'
import FormularioAperturaSeccion from '../components/caja/FormularioAperturaSeccion.jsx'
import FormularioCaja from '../components/caja/FormularioCaja.jsx'
import FormularioCierreSeccion from '../components/caja/FormularioCierreSeccion.jsx'
import { useAuth } from '../context/auth-context'
import { useSucursal } from '../context/sucursal-context'
import useDebounce from '../hooks/useDebounce'
import { descargarCsv, numeroCsv } from '../utils/csv'
import {
  formatearFechaHora,
  formatearMoneda,
} from '../utils/formato'
import '../styles/Comercial.css'
import '../styles/Inventario.css'
import '../styles/Caja.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const TABS = [
  { id: 'listado', etiqueta: 'Secciones', icono: IconCash },
  { id: 'gestion', etiqueta: 'Gestion de cajas', icono: IconSettings, soloGestion: true },
]

const FILTROS_ESTADO = [
  { id: '', etiqueta: 'Todas' },
  { id: 'AB', etiqueta: 'Abiertas' },
  { id: 'CE', etiqueta: 'Cerradas' },
  { id: 'AU', etiqueta: 'Auditadas' },
]

const CLASE_ESTADO = {
  AB: 'estado-ab',
  CE: 'estado-ce',
  AU: 'estado-au',
}

export default function Caja() {
  const { puedeEscribir } = useAuth()
  const { sucursalActiva, sucursalDetalle } = useSucursal()
  const puedeOperar = puedeEscribir(['AD', 'GE', 'CA'])
  const puedeGestionar = puedeEscribir(['AD', 'GE'])

  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'listado')
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [estado, setEstado] = useState(() => searchParams.get('estado') || '')
  const [pagina, setPagina] = useState(() =>
    Number(searchParams.get('page')) || 1,
  )

  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [abiertas, setAbiertas] = useState([])
  const [asignacionesBranch, setAsignacionesBranch] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [cajasFisicas, setCajasFisicas] = useState([])
  const [asignaciones, setAsignaciones] = useState([])

  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [refresco, setRefresco] = useState(0)

  const [aperturaAbierta, setAperturaAbierta] = useState(false)
  const [cierreSeccion, setCierreSeccion] = useState(null)
  const [detalleSeccion, setDetalleSeccion] = useState(null)
  const [cajaEditando, setCajaEditando] = useState(null)
  const [asignacionEditando, setAsignacionEditando] = useState(null)

  const busqueda = useDebounce(texto.trim(), 350)
  const buscando = texto.trim() !== busqueda || actualizando

  useEffect(() => {
    const parametros = new URLSearchParams()
    if (tab !== 'listado') {
      parametros.set('tab', tab)
    }
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    if (pagina > 1) {
      parametros.set('page', String(pagina))
    }
    setSearchParams(parametros, { replace: true })
  }, [tab, busqueda, estado, pagina, setSearchParams])

  // Secciones abiertas (para el encabezado y la disponibilidad de cajas).
  useEffect(() => {
    if (tab !== 'listado') {
      return undefined
    }
    let vigente = true
    const parametros = new URLSearchParams({ estado: 'AB' })
    if (sucursalActiva) {
      parametros.set('sucursal', sucursalActiva)
    }

    pedirTodas(`/secciones-caja/?${parametros.toString()}`)
      .then((secciones) => {
        if (vigente) {
          setAbiertas(secciones)
        }
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
        }
      })

    return () => {
      vigente = false
    }
  }, [tab, sucursalActiva, refresco])

  // Cajas habilitadas de la sucursal elegida (para abrir una seccion).
  useEffect(() => {
    if (tab !== 'listado' || !sucursalActiva) {
      return undefined
    }
    let vigente = true
    const parametros = new URLSearchParams({
      sucursal: sucursalActiva,
      habilitada: 'true',
    })

    pedirTodas(`/sucursales-cajas/?${parametros.toString()}`)
      .then((asignacionesData) => {
        if (vigente) {
          setAsignacionesBranch(asignacionesData)
        }
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
        }
      })

    return () => {
      vigente = false
    }
  }, [tab, sucursalActiva, refresco])

  // Listado e historial.
  useEffect(() => {
    if (tab !== 'listado') {
      return undefined
    }
    let vigente = true
    const controlador = new AbortController()
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (sucursalActiva) {
      parametros.set('sucursal', sucursalActiva)
    }
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }

    pedir(`/secciones-caja/?${parametros.toString()}`, {
      signal: controlador.signal,
    })
      .then((respuesta) => {
        if (vigente) {
          setDatos(respuesta)
          setError('')
        }
      })
      .catch((e) => {
        if (!vigente || e.name === 'AbortError') {
          return
        }
        setError(e.message)
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
          setActualizando(false)
        }
      })

    return () => {
      vigente = false
      controlador.abort()
    }
  }, [tab, pagina, busqueda, estado, sucursalActiva, refresco])

  // Gestion: cajas fisicas, asignaciones y sucursales.
  useEffect(() => {
    if (tab !== 'gestion') {
      return undefined
    }
    let vigente = true

    Promise.all([
      pedirTodas('/cajas/'),
      pedirTodas('/sucursales-cajas/'),
      pedirTodas('/sucursales/'),
    ])
      .then(([cajasData, asignacionesData, sucursalesData]) => {
        if (!vigente) {
          return
        }
        setCajasFisicas(cajasData)
        setAsignaciones(asignacionesData)
        setSucursales(sucursalesData)
        setError('')
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
          setActualizando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [tab, refresco])

  function refrescar() {
    setRefresco((valor) => valor + 1)
    setActualizando(true)
  }

  function cambiarTab(nuevoTab) {
    setTab(nuevoTab)
    setTexto('')
    setEstado('')
    setPagina(1)
    setError('')
    setCargando(true)
  }

  function cambiarEstado(nuevoEstado) {
    if (nuevoEstado === estado) {
      return
    }
    setEstado(nuevoEstado)
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function irAPagina(nueva) {
    setPagina(nueva)
    setError('')
    setActualizando(true)
  }

  function seccionAbiertaGuardada(seccion) {
    setAperturaAbierta(false)
    Swal.fire({
      icon: 'success',
      title: 'Seccion abierta',
      text: `${seccion.caja_detalle} · Sección #${seccion.id}`,
      timer: 1500,
      showConfirmButton: false,
    })
    refrescar()
  }

  function seccionCerradaGuardada() {
    setCierreSeccion(null)
    Swal.fire({
      icon: 'success',
      title: 'Seccion cerrada',
      timer: 1500,
      showConfirmButton: false,
    })
    refrescar()
  }

  function guardadoCaja(_, esEdicion) {
    setCajaEditando(null)
    Swal.fire({
      icon: 'success',
      title: esEdicion ? 'Caja actualizada' : 'Caja creada',
      timer: 1500,
      showConfirmButton: false,
    })
    refrescar()
  }

  function guardadaAsignacion(_, esEdicion) {
    setAsignacionEditando(null)
    Swal.fire({
      icon: 'success',
      title: esEdicion ? 'Asignación actualizada' : 'Asignación creada',
      timer: 1500,
      showConfirmButton: false,
    })
    refrescar()
  }

  async function alternarHabilitada(asignacion) {
    const nuevo = !asignacion.habilitada
    const resultado = await Swal.fire({
      title: nuevo ? '¿Habilitar?' : '¿Deshabilitar?',
      text: nuevo
        ? 'La caja podrá abrir secciones en esta sucursal.'
        : 'La caja dejará de abrir secciones en esta sucursal.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: nuevo ? 'Sí, habilitar' : 'Sí, deshabilitar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) {
      return
    }
    try {
      await pedir(`/sucursales-cajas/${asignacion.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ habilitada: nuevo }),
      })
      Swal.fire({
        icon: 'success',
        title: nuevo ? 'Habilitada' : 'Deshabilitada',
        timer: 1400,
        showConfirmButton: false,
      })
      refrescar()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo actualizar la asignación',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function exportar() {
    setExportando(true)
    try {
      const parametros = new URLSearchParams()
      if (sucursalActiva) parametros.set('sucursal', sucursalActiva)
      if (busqueda) parametros.set('search', busqueda)
      if (estado) parametros.set('estado', estado)
      const todos = await pedirTodas(
        `/secciones-caja/?${parametros.toString()}`,
      )

      if (todos.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay secciones para exportar.',
          confirmButtonColor: '#4a9da8',
        })
        return
      }

      descargarCsv(
        `secciones-caja-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Caja física',
          'Sucursal',
          'Sección',
          'Empleado',
          'Apertura',
          'Cierre',
          'Monto inicial',
          'Monto teorico',
          'Monto final',
          'Diferencia',
          'Estado',
        ],
        todos.map((item) => [
          item.caja_detalle,
          item.sucursal_detalle,
          item.id,
          item.empleado_detalle,
          item.fecha_hora_apertura ?? '',
          item.fecha_hora_cierre ?? '',
          numeroCsv(item.monto_inicial),
          item.monto_teorico === null ? '' : numeroCsv(item.monto_teorico),
          item.monto_final === null ? '' : numeroCsv(item.monto_final),
          item.monto_final === null || item.monto_teorico === null
            ? ''
            : numeroCsv(Number(item.monto_final) - Number(item.monto_teorico)),
          item.estado_detalle,
        ]),
      )
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo exportar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setExportando(false)
    }
  }

  const cajasDisponibles = sucursalActiva
    ? asignacionesBranch.filter(
        (asignacion) =>
          !abiertas.some((s) => s.caja === asignacion.caja),
      )
    : []

  const tabsVisibles = TABS.filter(
    (item) => !item.soloGestion || puedeGestionar,
  )

  return (
    <>
      <Encabezado
        titulo="Caja"
        subtitulo="Apertura, cierre y auditoria de secciones de caja"
      />

      <div className="comercial inventario">
        {tab === 'listado' && (
          <>
            <section className="caja-contexto">
              <span className="caja-chip">
                <IconBuildingWarehouse size={16} />
                <span>Sucursal</span>
                <strong>{sucursalDetalle?.nombre ?? 'Todas'}</strong>
              </span>
              {abiertas.length === 0 ? (
                <span className="caja-chip caja-chip-vacio">
                  <IconCash size={16} />
                  Ninguna seccion abierta
                </span>
              ) : (
                abiertas.map((seccion) => (
                  <span className="caja-chip" key={seccion.id}>
                    <IconCash size={16} />
                    <strong>{seccion.caja_detalle}</strong>
                    Sección #{seccion.id} · {seccion.empleado_detalle}
                  </span>
                ))
              )}
            </section>

            <section
              id="cajas-abiertas"
              className="comercial-panel"
              aria-label="Cajas abiertas"
            >
              <div className="caja-panel-cabecera">
                <h2 className="caja-panel-titulo">
                  <IconCash size={22} />
                  Cajas abiertas
                </h2>
                {puedeOperar && (
                  <button
                    type="button"
                    className="boton-comercial-primario"
                    disabled={!sucursalActiva}
                    onClick={() => setAperturaAbierta(true)}
                    title={
                      sucursalActiva
                        ? 'Abrir una seccion de caja'
                        : 'Elegí una sucursal en el encabezado'
                    }
                  >
                    <IconPlus size={18} />
                    Abrir seccion
                  </button>
                )}
              </div>

              {!sucursalActiva && (
                <p className="caja-nota-total">
                  Elegí una sucursal en el encabezado para abrir una seccion.
                </p>
              )}

              <div className="caja-abiertas">
                {abiertas.length === 0 && (
                  <p className="caja-abierta-vacia">
                    No hay cajas con secciones abiertas.
                  </p>
                )}
                {abiertas.map((seccion) => (
                  <article className="caja-abierta" key={seccion.id}>
                    <div className="caja-abierta-cabecera">
                      <div>
                        <strong>{seccion.caja_detalle}</strong>
                        <small>
                          Sección #{seccion.id} · {seccion.sucursal_detalle}
                        </small>
                      </div>
                      <span className={`estado-badge ${CLASE_ESTADO[seccion.estado]}`}>
                        {seccion.estado_detalle}
                      </span>
                    </div>
                    <div className="caja-abierta-detalles">
                      <span>
                        Empleado{' '}
                        <strong>{seccion.empleado_detalle}</strong>
                      </span>
                      <span>
                        Apertura{' '}
                        <strong>
                          {formatearFechaHora(seccion.fecha_hora_apertura)}
                        </strong>
                      </span>
                      <span>
                        Inicial{' '}
                        <strong>{formatearMoneda(seccion.monto_inicial)}</strong>
                      </span>
                    </div>
                    <div className="caja-abierta-acciones">
                      <button
                        type="button"
                        className="boton-comercial-secundario"
                        onClick={() => setDetalleSeccion(seccion)}
                      >
                        <IconEye size={17} />
                        Ver
                      </button>
                      {puedeOperar && (
                        <button
                          type="button"
                          className="boton-comercial-primario"
                          onClick={() => setCierreSeccion(seccion)}
                        >
                          <IconCash size={17} />
                          Cerrar seccion
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="comercial-barra">
          <form
            className="comercial-busqueda"
            onSubmit={(evento) => evento.preventDefault()}
          >
            <IconSearch size={20} />
            <input
              type="search"
              value={texto}
              onChange={(evento) => {
                setTexto(evento.target.value)
                setPagina(1)
              }}
              placeholder="Buscar por sucursal, caja o empleado"
              aria-label="Buscar secciones de caja"
            />
            {buscando && (
              <IconLoader2 className="icono-girando" size={18} />
            )}
            {texto && (
              <button
                type="button"
                className="boton-limpiar-busqueda"
                onClick={() => {
                  setTexto('')
                  setPagina(1)
                }}
                aria-label="Limpiar búsqueda"
              >
                <IconX size={16} />
              </button>
            )}
          </form>

          <div className="comercial-acciones-barra">
            <button
              type="button"
              className="boton-comercial-secundario"
              onClick={exportar}
              disabled={exportando}
            >
              <IconDownload size={18} />
              {exportando ? 'Exportando…' : 'Exportar CSV'}
            </button>
          </div>
        </section>

        <section className="inventario-tabs">
          {tabsVisibles.map((item) => {
            const Icono = item.icono
            return (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'activo' : ''}
                onClick={() => cambiarTab(item.id)}
              >
                <Icono size={18} />
                {item.etiqueta}
              </button>
            )
          })}
        </section>

        {tab === 'listado' && (
          <section className="inventario-filtros">
            {FILTROS_ESTADO.map((opcion) => (
              <button
                key={opcion.id || 'todas'}
                type="button"
                className={estado === opcion.id ? 'activo' : ''}
                onClick={() => cambiarEstado(opcion.id)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </section>
        )}

        {error && <p className="comercial-error">{error}</p>}

        {tab === 'listado' && (
          <section
            className={`comercial-panel ${actualizando ? 'panel-actualizando' : ''}`}
          >
            <div className="comercial-tabla-scroll">
              <table className="tabla-comercial">
                <thead>
                  <tr>
                    <th>Sección</th>
                    <th>Caja</th>
                    <th>Sucursal</th>
                    <th>Empleado</th>
                    <th>Apertura</th>
                    <th>Cierre</th>
                    <th>Inicial</th>
                    <th>Teorico</th>
                    <th>Final</th>
                    <th>Diferencia</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando && (
                    <tr>
                      <td colSpan="12" className="comercial-vacio">
                        Cargando secciones…
                      </td>
                    </tr>
                  )}
                  {!cargando && datos.results.length === 0 && (
                    <tr>
                      <td colSpan="12" className="comercial-vacio">
                        No se encontraron secciones.
                      </td>
                    </tr>
                  )}
                  {datos.results.map((item) => {
                    const diferencia =
                      item.monto_final === null || item.monto_teorico === null
                        ? null
                        : Number(item.monto_final) - Number(item.monto_teorico)
                    return (
                      <tr key={item.id}>
                        <td className="mono">#{item.id}</td>
                        <td>{item.caja_detalle}</td>
                        <td>{item.sucursal_detalle}</td>
                        <td>{item.empleado_detalle}</td>
                        <td className="mono">
                          {formatearFechaHora(item.fecha_hora_apertura)}
                        </td>
                        <td className="mono">
                          {formatearFechaHora(item.fecha_hora_cierre)}
                        </td>
                        <td className="numero">
                          {formatearMoneda(item.monto_inicial)}
                        </td>
                        <td className="numero">
                          {item.monto_teorico === null
                            ? '—'
                            : formatearMoneda(item.monto_teorico)}
                        </td>
                        <td className="numero">
                          {item.monto_final === null
                            ? '—'
                            : formatearMoneda(item.monto_final)}
                        </td>
                        <td
                          className={`numero ${
                            diferencia === null
                              ? 'caja-diferencia-cero'
                              : diferencia > 0
                                ? 'caja-diferencia-positiva'
                                : diferencia < 0
                                  ? 'caja-diferencia-negativa'
                                  : 'caja-diferencia-cero'
                          }`}
                        >
                          {diferencia === null
                            ? '—'
                            : formatearMoneda(diferencia)}
                        </td>
                        <td>
                          <span
                            className={`estado-badge ${CLASE_ESTADO[item.estado]}`}
                          >
                            {item.estado_detalle}
                          </span>
                        </td>
                        <td>
                          <div className="acciones-fila">
                            <button
                              type="button"
                              className="boton-icono"
                              onClick={() => setDetalleSeccion(item)}
                              title="Ver detalle"
                            >
                              <IconEye size={17} />
                            </button>
                            {puedeOperar && item.estado === 'AB' && (
                              <button
                                type="button"
                                className="boton-icono boton-icono-exito"
                                onClick={() => setCierreSeccion(item)}
                                title="Cerrar seccion"
                              >
                                <IconCash size={17} />
                              </button>
                            )}
                            {puedeGestionar && item.estado === 'CE' && (
                              <button
                                type="button"
                                className="boton-icono"
                                onClick={() => setDetalleSeccion(item)}
                                title="Auditar"
                              >
                                <IconCheck size={17} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="comercial-paginacion">
              <span>
                {datos.count} seccion{datos.count === 1 ? '' : 'es'}
              </span>
              <div>
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  disabled={!datos.previous || cargando}
                  onClick={() => irAPagina(pagina - 1)}
                >
                  Anterior
                </button>
                <span>Página {pagina}</span>
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  disabled={!datos.next || cargando}
                  onClick={() => irAPagina(pagina + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === 'gestion' && puedeGestionar && (
          <>
            <section className="comercial-panel">
              <div className="caja-panel-cabecera">
                <h2 className="caja-panel-titulo">
                  <IconCash size={22} />
                  Cajas fisicas
                </h2>
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => setCajaEditando({})}
                >
                  <IconPlus size={18} />
                  Nueva caja
                </button>
              </div>

              <div className="comercial-tabla-scroll">
                <table className="tabla-comercial">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th>Asignaciones</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && (
                      <tr>
                        <td colSpan="4" className="comercial-vacio">
                          Cargando cajas…
                        </td>
                      </tr>
                    )}
                    {!cargando && cajasFisicas.length === 0 && (
                      <tr>
                        <td colSpan="4" className="comercial-vacio">
                          No hay cajas físicas.
                        </td>
                      </tr>
                    )}
                    {cajasFisicas.map((caja) => (
                      <tr key={caja.id}>
                        <td>
                          <strong>{caja.nombre}</strong>
                        </td>
                        <td>{caja.estado_detalle}</td>
                        <td className="texto-chico">
                          {asignaciones
                            .filter((item) => item.caja === caja.id)
                            .map((item) => item.sucursal_detalle)
                            .join(', ') || '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="boton-icono"
                            onClick={() => setCajaEditando(caja)}
                            title="Editar caja"
                          >
                            <IconPencil size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="comercial-panel">
              <div className="caja-panel-cabecera">
                <h2 className="caja-panel-titulo">
                  <IconBuildingWarehouse size={22} />
                  Asignaciones sucursal ↔ caja
                </h2>
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => setAsignacionEditando({})}
                >
                  <IconPlus size={18} />
                  Nueva asignación
                </button>
              </div>

              <div className="comercial-tabla-scroll">
                <table className="tabla-comercial">
                  <thead>
                    <tr>
                      <th>Caja</th>
                      <th>Sucursal</th>
                      <th>Habilitada</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && (
                      <tr>
                        <td colSpan="4" className="comercial-vacio">
                          Cargando asignaciones…
                        </td>
                      </tr>
                    )}
                    {!cargando && asignaciones.length === 0 && (
                      <tr>
                        <td colSpan="4" className="comercial-vacio">
                          No hay asignaciones.
                        </td>
                      </tr>
                    )}
                    {asignaciones.map((asignacion) => (
                      <tr key={asignacion.id}>
                        <td>{asignacion.caja_detalle}</td>
                        <td>{asignacion.sucursal_detalle}</td>
                        <td>
                          <button
                            type="button"
                            className={`inventario-estado ${
                              asignacion.habilitada ? 'activo' : 'inactivo'
                            }`}
                            aria-pressed={asignacion.habilitada}
                            onClick={() => alternarHabilitada(asignacion)}
                            title={
                              asignacion.habilitada
                                ? 'Deshabilitar'
                                : 'Habilitar'
                            }
                          >
                              {asignacion.habilitada
                                ? 'Habilitada'
                                : 'Deshabilitada'}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="boton-icono"
                            onClick={() => setAsignacionEditando(asignacion)}
                            title="Editar asignación"
                          >
                            <IconPencil size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {aperturaAbierta && sucursalActiva && (
        <FormularioAperturaSeccion
          sucursalActiva={sucursalActiva}
          sucursalNombre={sucursalDetalle?.nombre ?? ''}
          cajasDisponibles={cajasDisponibles}
          onCerrar={() => setAperturaAbierta(false)}
          onGuardado={seccionAbiertaGuardada}
        />
      )}

      {cierreSeccion && (
        <FormularioCierreSeccion
          seccion={cierreSeccion}
          onCerrar={() => setCierreSeccion(null)}
          onGuardado={seccionCerradaGuardada}
        />
      )}

      {detalleSeccion && (
        <DetalleSeccionCaja
          seccion={detalleSeccion}
          puedeAuditar={puedeGestionar}
          onCerrar={() => setDetalleSeccion(null)}
          onAuditado={() => {
            setDetalleSeccion(null)
            refrescar()
          }}
        />
      )}

      {cajaEditando !== null && (
        <FormularioCaja
          caja={cajaEditando}
          onCerrar={() => setCajaEditando(null)}
          onGuardado={guardadoCaja}
        />
      )}

      {asignacionEditando !== null && (
        <FormularioAsignacionCaja
          asignacion={
            asignacionEditando.id ? asignacionEditando : null
          }
          cajas={cajasFisicas}
          sucursales={sucursales}
          onCerrar={() => setAsignacionEditando(null)}
          onGuardado={guardadaAsignacion}
        />
      )}
    </>
  )
}
