import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconDownload,
  IconListDetails,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import { useAuth } from '../context/auth-context'
import useDebounce from '../hooks/useDebounce'
import useCacheModulo from '../hooks/useCacheModulo'
import { descargarCsv } from '../utils/csv'
import { formatearFecha, formatearFechaHora, formatearNumero } from '../utils/formato'
import '../styles/Comercial.css'
import '../styles/Filtros.css'
import '../styles/Actividad.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const RESUMEN_VACIO = {
  total: 0,
  por_accion: {},
  por_modelo: {},
}

const ACCIONES = [
  { id: '', etiqueta: 'Todas', color: '' },
  { id: 'CREAR', etiqueta: 'Creación', color: 'estado-pe' },
  { id: 'EDITAR', etiqueta: 'Edición', color: 'estado-pc' },
  { id: 'ELIMINAR', etiqueta: 'Eliminación', color: 'estado-an' },
]

const ETIQUETA_ACCION = {
  CREAR: 'Creado',
  EDITAR: 'Editado',
  ELIMINAR: 'Eliminado',
}

export default function Actividad() {
  const { user, puedeEscribir } = useAuth()
  const puedeGestionar = puedeEscribir(['AD', 'GE'])

  const [searchParams, setSearchParams] = useSearchParams()
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [accion, setAccion] = useState(() => searchParams.get('accion') || '')
  const [usuario, setUsuario] = useState(() => searchParams.get('usuario') || '')
  const [fechaDesde, setFechaDesde] = useState(
    () => searchParams.get('fecha_desde') || ''
  )
  const [fechaHasta, setFechaHasta] = useState(
    () => searchParams.get('fecha_hasta') || ''
  )
  const [pagina, setPagina] = useState(
    () => Number(searchParams.get('page')) || 1,
  )

  const [exportando, setExportando] = useState(false)

  const busqueda = useDebounce(texto.trim(), 350)

  const filtrosComunes = useCallback(() => {
    const p = new URLSearchParams()
    if (busqueda) p.set('search', busqueda)
    if (accion) p.set('accion', accion)
    if (usuario) p.set('usuario', usuario)
    if (fechaDesde) p.set('fecha_desde', fechaDesde)
    if (fechaHasta) p.set('fecha_hasta', fechaHasta)
    return p
  }, [busqueda, accion, usuario, fechaDesde, fechaHasta])

  const parametros = useCallback(() => {
    const p = filtrosComunes()
    p.set('page', String(pagina))
    return p
  }, [filtrosComunes, pagina])

  useEffect(() => {
    setSearchParams(parametros(), { replace: true })
  }, [parametros, setSearchParams])

  const consultarListado = useCallback(
    ({ signal } = {}) =>
      pedir(`/actividad/?${parametros().toString()}`, { signal }),
    [parametros],
  )
  const consultarResumen = useCallback(
    ({ signal } = {}) =>
      pedir(`/actividad/resumen/?${filtrosComunes().toString()}`, { signal }),
    [filtrosComunes],
  )
  const consultarEmpleados = useCallback(
    () =>
      pedirTodas('/empleados/').then((lista) =>
        lista.filter((empleado) => empleado.usuario),
      ),
    [],
  )

  const {
    datos,
    cargando,
    actualizando,
    error,
  } = useCacheModulo({
    clave: `actividad|${user?.id ?? ''}|${parametros().toString()}`,
    consultar: consultarListado,
    inicial: PAGINA_VACIA,
  })
  const { datos: resumen } = useCacheModulo({
    clave: `actividad-resumen|${user?.id ?? ''}|${filtrosComunes().toString()}`,
    consultar: consultarResumen,
    inicial: RESUMEN_VACIO,
  })
  const { datos: empleados } = useCacheModulo({
    clave: `actividad-empleados|${user?.id ?? ''}`,
    consultar: consultarEmpleados,
    inicial: [],
  })

  const buscando = texto.trim() !== busqueda || actualizando

  function irAPagina(numero) {
    setPagina(numero)
  }

  function cambiarAccion(nueva) {
    setAccion((actual) => (actual === nueva ? '' : nueva))
    setPagina(1)
  }

  async function exportar() {
    setExportando(true)
    try {
      const todos = await pedirTodas(`/actividad/?${filtrosComunes().toString()}`)
      if (todos.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay registros de actividad para exportar con los filtros actuales.',
          confirmButtonColor: '#4a9da8',
        })
        return
      }

      const filas = todos.map((item) => [
        formatearFecha(item.fecha),
        item.usuario_detalle ?? '—',
        item.modelo_detalle ?? item.modelo ?? '—',
        item.objeto ?? '—',
        ETIQUETA_ACCION[item.accion] ?? item.accion ?? '—',
        item.detalle ?? '—',
      ])
      descargarCsv(
        `actividad-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Fecha', 'Usuario', 'Modelo', 'Objeto', 'Acción', 'Detalle'],
        filas,
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

  if (!puedeGestionar) {
    return null
  }

  const porAccion = resumen.por_accion ?? {}
  const totalRegistros = resumen.total ?? datos.count ?? 0
  const mensajeVacio = accion
    ? `No hay ${ETIQUETA_ACCION[accion]?.toLowerCase() || 'registros'} para los filtros elegidos.`
    : 'No se encontraron registros de actividad.'

  return (
    <>
      <Encabezado
        titulo="Actividad"
        subtitulo="Registro de cambios del sistema"
      />

      <div className="comercial actividad">
        <section className="filtros-area">
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
                placeholder="Buscar por usuario, modelo o objeto"
                aria-label="Buscar actividad"
              />
              {buscando && <IconLoader2 className="icono-girando" size={18} />}
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

          <section className="filtros-tabs filtros-pills">
            {ACCIONES.map((opcion) => (
              <button
                key={opcion.id || 'todas'}
                type="button"
                className={
                  accion === opcion.id
                    ? `activo ${opcion.color}`
                    : opcion.color
                }
                onClick={() => cambiarAccion(opcion.id)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </section>

          <section className="filtros-campos filtros-campos-inline">
            <label className="campo-comercial">
              <span>Usuario</span>
              <select
                value={usuario}
                onChange={(e) => {
                  setUsuario(e.target.value)
                  setPagina(1)
                              }}
              >
                <option value="">Todos</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.usuario}>
                    {emp.apellido}, {emp.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo-comercial">
              <span>Desde</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value)
                  setPagina(1)
                              }}
              />
            </label>
            <label className="campo-comercial">
              <span>Hasta</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value)
                  setPagina(1)
                              }}
              />
            </label>
          </section>
        </section>

        <section className="dashboard-kpis actividad-kpis">
          <article className="kpi-tarjeta">
            <span className="kpi-icono">
              <IconListDetails size={26} stroke={1.75} />
            </span>
            <div className="kpi-contenido">
              <p className="kpi-etiqueta">Total de registros</p>
              <p className="kpi-valor">{formatearNumero(totalRegistros)}</p>
            </div>
          </article>
          <article className="kpi-tarjeta kpi-crear">
            <span className="kpi-icono">
              <IconPlus size={26} stroke={1.75} />
            </span>
            <div className="kpi-contenido">
              <p className="kpi-etiqueta">Creaciones</p>
              <p className="kpi-valor">{formatearNumero(porAccion.CREAR || 0)}</p>
            </div>
          </article>
          <article className="kpi-tarjeta kpi-editar">
            <span className="kpi-icono">
              <IconPencil size={26} stroke={1.75} />
            </span>
            <div className="kpi-contenido">
              <p className="kpi-etiqueta">Ediciones</p>
              <p className="kpi-valor">{formatearNumero(porAccion.EDITAR || 0)}</p>
            </div>
          </article>
          <article className="kpi-tarjeta kpi-eliminar">
            <span className="kpi-icono">
              <IconTrash size={26} stroke={1.75} />
            </span>
            <div className="kpi-contenido">
              <p className="kpi-etiqueta">Eliminaciones</p>
              <p className="kpi-valor">{formatearNumero(porAccion.ELIMINAR || 0)}</p>
            </div>
          </article>
        </section>

        {error && <p className="comercial-error">{error}</p>}

        <section className={`comercial-panel ${actualizando ? 'panel-actualizando' : ''}`}>
          <div className="comercial-tabla-scroll">
            <table className="tabla-comercial">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Modelo</th>
                  <th>Objeto</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="6" className="comercial-vacio">
                      Cargando actividad…
                    </td>
                  </tr>
                )}
                {!cargando && !error && datos.results.length === 0 && (
                  <tr>
                    <td colSpan="6" className="comercial-vacio">
                      {mensajeVacio}
                    </td>
                  </tr>
                )}
                {!cargando &&
                  datos.results.map((item) => (
                    <tr key={item.id}>
                      <td className="texto-chico">
                        {formatearFechaHora(item.fecha)}
                      </td>
                      <td>{item.usuario_detalle ?? '—'}</td>
                      <td>{item.modelo_detalle ?? item.modelo ?? '—'}</td>
                      <td>{item.objeto ?? '—'}</td>
                      <td>
                        <span
                          className={`estado-badge ${ACCIONES.find(
                            (a) => a.id === item.accion
                          )?.color ?? ''}`}
                        >
                          {ETIQUETA_ACCION[item.accion] ?? item.accion ?? '—'}
                        </span>
                      </td>
                      <td
                        className="texto-chico"
                        title={item.detalle || undefined}
                      >
                        {item.detalle || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="comercial-paginacion">
            <span>
              {datos.count} registro{datos.count === 1 ? '' : 's'}
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
      </div>
    </>
  )
}
