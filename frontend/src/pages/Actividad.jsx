import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconDownload,
  IconLoader2,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import { useAuth } from '../context/auth-context'
import useDebounce from '../hooks/useDebounce'
import { descargarCsv } from '../utils/csv'
import { formatearFecha, formatearFechaHora, formatearNumero } from '../utils/formato'
import '../styles/Comercial.css'
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
  const { puedeEscribir } = useAuth()
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

  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [resumen, setResumen] = useState(RESUMEN_VACIO)
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')
  const [exportando, setExportando] = useState(false)

  const busqueda = useDebounce(texto.trim(), 350)
  const buscando = texto.trim() !== busqueda || actualizando

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

  // Cargar empleados para el filtro por usuario.
  useEffect(() => {
    let vigente = true
    pedirTodas('/empleados/')
      .then((lista) => {
        if (vigente) {
          setEmpleados(lista.filter((e) => e.usuario))
        }
      })
      .catch(() => {
        if (vigente) setEmpleados([])
      })
    return () => {
      vigente = false
    }
  }, [])

  // Listado paginado.
  useEffect(() => {
    let vigente = true
    pedir(`/actividad/?${parametros().toString()}`)
      .then((datosPagina) => {
        if (vigente) {
          setDatos(datosPagina)
          setCargando(false)
          setActualizando(false)
          setError('')
        }
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
          setCargando(false)
          setActualizando(false)
        }
      })
    return () => {
      vigente = false
    }
  }, [parametros])

  // Resumen real del filtro (totales, no pagina).
  useEffect(() => {
    let vigente = true
    pedir(`/actividad/resumen/?${filtrosComunes().toString()}`)
      .then((datosResumen) => {
        if (vigente) setResumen(datosResumen)
      })
      .catch(() => {
        if (vigente) setResumen(RESUMEN_VACIO)
      })
    return () => {
      vigente = false
    }
  }, [filtrosComunes])

  function irAPagina(numero) {
    setPagina(numero)
    setActualizando(true)
  }

  function cambiarAccion(nueva) {
    setAccion((actual) => (actual === nueva ? '' : nueva))
    setPagina(1)
    setActualizando(true)
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
        {/* KPIs superiores (totales reales del filtro) */}
        <section className="comercial-barra">
          <div className="comercial-kpis">
            <div className="comercial-kpi">
              <span className="comercial-kpi-label">Total de registros</span>
              <span className="comercial-kpi-valor">
                {formatearNumero(totalRegistros)}
              </span>
            </div>
            <div className="comercial-kpi">
              <span className="comercial-kpi-label">Creaciones</span>
              <span className="comercial-kpi-valor">
                {formatearNumero(porAccion.CREAR || 0)}
              </span>
            </div>
            <div className="comercial-kpi">
              <span className="comercial-kpi-label">Ediciones</span>
              <span className="comercial-kpi-valor">
                {formatearNumero(porAccion.EDITAR || 0)}
              </span>
            </div>
            <div className="comercial-kpi">
              <span className="comercial-kpi-label">Eliminaciones</span>
              <span className="comercial-kpi-valor">
                {formatearNumero(porAccion.ELIMINAR || 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Barra de búsqueda y acciones */}
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
                setActualizando(true)
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

        {/* Filtros por tipo de tarea */}
        <section className="inventario-filtros">
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

        {/* Filtros por usuario y fechas */}
        <section className="inventario-filtros inventario-filtros-form">
          <label className="campo-comercial">
            <span>Usuario</span>
            <select
              value={usuario}
              onChange={(e) => {
                setUsuario(e.target.value)
                setPagina(1)
                setActualizando(true)
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
                setActualizando(true)
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
                setActualizando(true)
              }}
            />
          </label>
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
