import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconDownload,
  IconKey,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import FormularioContrasena from '../components/empleados/FormularioContrasena.jsx'
import FormularioEmpleado from '../components/empleados/FormularioEmpleado.jsx'
import { useAuth } from '../context/auth-context'
import useDebounce from '../hooks/useDebounce'
import { descargarCsv } from '../utils/csv'
import { useSucursal } from '../context/sucursal-context'
import '../styles/Comercial.css'
import '../styles/Inventario.css'
import '../styles/Empleados.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const ESTADOS = [
  { id: '', etiqueta: 'Todos' },
  { id: 'AC', etiqueta: 'Activos' },
  { id: 'BT', etiqueta: 'Baja temporal' },
  { id: 'SU', etiqueta: 'Suspendidos' },
  { id: 'IN', etiqueta: 'Inactivos' },
]

const ETIQUETA_ESTADO = {
  AC: 'Activo',
  BT: 'Baja temporal',
  SU: 'Suspendido',
  IN: 'Inactivo',
}

export default function Empleados() {
  const { user, puedeEscribir } = useAuth()
  const { sucursalActiva } = useSucursal()
  const puedeGestionar = puedeEscribir(['AD', 'GE'])
  const esAdministrador = Boolean(
    user?.is_superuser || (user?.codigos ?? []).includes('AD'),
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [estado, setEstado] = useState(() => searchParams.get('estado') || '')
  const [pagina, setPagina] = useState(
    () => Number(searchParams.get('page')) || 1,
  )

  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')
  const [refresco, setRefresco] = useState(0)
  const [exportando, setExportando] = useState(false)

  const [empleadoEditando, setEmpleadoEditando] = useState(null)
  const [contrasenaPara, setContrasenaPara] = useState(null)

  const busqueda = useDebounce(texto.trim(), 350)
  const buscando = texto.trim() !== busqueda || actualizando

  useEffect(() => {
    const parametros = new URLSearchParams()
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
  }, [busqueda, estado, pagina, setSearchParams])

  useEffect(() => {
    let vigente = true
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    if (sucursalActiva) {
      parametros.set('sucursal', sucursalActiva)
    }

    pedir(`/empleados/?${parametros.toString()}`)
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
  }, [busqueda, estado, pagina, refresco, sucursalActiva])

  function irAPagina(numero) {
    setPagina(numero)
    setActualizando(true)
  }

  function cambiarEstado(nuevo) {
    setEstado((actual) => (actual === nuevo ? '' : nuevo))
    setPagina(1)
    setActualizando(true)
  }

  function empleadoGuardado() {
    setEmpleadoEditando(null)
    setRefresco((actual) => actual + 1)
    Swal.fire({
      icon: 'success',
      title: 'Empleado guardado',
      timer: 1400,
      showConfirmButton: false,
    })
  }

  async function exportar() {
    setExportando(true)
    try {
      const parametros = new URLSearchParams()
      if (busqueda) {
        parametros.set('search', busqueda)
      }
      if (estado) {
        parametros.set('estado', estado)
      }
      if (sucursalActiva) {
        parametros.set('sucursal', sucursalActiva)
      }

      const todos = await pedirTodas(
        `/empleados/?${parametros.toString()}`,
      )
      if (todos.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay empleados para exportar con los filtros actuales.',
          confirmButtonColor: '#4a9da8',
        })
        return
      }

      const filas = todos.map((empleado) => [
        empleado.legajo,
        `${empleado.apellido}, ${empleado.nombre}`,
        empleado.dni,
        empleado.telefono || '',
        (empleado.roles_detalle || []).join(', '),
        (empleado.sucursales_detalle || []).join(', '),
        empleado.usuario_detalle || 'Sin acceso',
        ETIQUETA_ESTADO[empleado.estado] ?? empleado.estado,
      ])
      descargarCsv(
        `empleados-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Legajo', 'Empleado', 'DNI', 'Teléfono', 'Roles', 'Sucursales', 'Usuario', 'Estado'],
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

  return (
    <>
      <Encabezado
        titulo="Empleados"
        subtitulo="Administración de empleados, roles y accesos"
      />

      <div className="comercial inventario" key={sucursalActiva || 'todas'}>
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
              placeholder="Buscar por legajo, DNI, nombre o apellido"
              aria-label="Buscar empleados"
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
            {puedeGestionar && (
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={() => setEmpleadoEditando({})}
              >
                <IconPlus size={18} />
                Nuevo empleado
              </button>
            )}
          </div>
        </section>

        <section className="inventario-filtros">
          {ESTADOS.map((opcion) => (
            <button
              key={opcion.id || 'todos'}
              type="button"
              className={estado === opcion.id ? 'activo' : ''}
              onClick={() => cambiarEstado(opcion.id)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </section>

        {error && <p className="comercial-error">{error}</p>}

        <section className={`comercial-panel ${actualizando ? 'panel-actualizando' : ''}`}>
          <div className="comercial-tabla-scroll">
            <table className="tabla-comercial">
              <thead>
                <tr>
                  <th>Legajo</th>
                  <th>Empleado</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Roles</th>
                  <th>Sucursales</th>
                  <th>Acceso</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="9" className="comercial-vacio">
                      Cargando empleados…
                    </td>
                  </tr>
                )}
                {!cargando && !error && datos.results.length === 0 && (
                  <tr>
                    <td colSpan="9" className="comercial-vacio">
                      No se encontraron empleados.
                    </td>
                  </tr>
                )}
                {!cargando &&
                  datos.results.map((empleado) => (
                    <tr key={empleado.id}>
                      <td className="mono">{empleado.legajo}</td>
                      <td>
                        <strong>
                          {empleado.apellido}, {empleado.nombre}
                        </strong>
                      </td>
                      <td className="mono">{empleado.dni}</td>
                      <td>{empleado.telefono || '—'}</td>
                      <td>
                        <div className="empleados-roles">
                          {(empleado.roles_detalle || []).map((codigo) => (
                            <span key={codigo} className="empleados-rol">
                              {codigo}
                            </span>
                          ))}
                          {(empleado.roles_detalle || []).length === 0 && (
                            <span className="empleados-nota">—</span>
                          )}
                        </div>
                      </td>
                      <td className="empleados-sucursales">
                        {(empleado.sucursales_detalle || []).join(' / ') || '—'}
                      </td>
                      <td>{empleado.usuario_detalle || 'Sin acceso'}</td>
                      <td>
                        <span className={`empleados-badge ${empleado.estado.toLowerCase()}`}>
                          {ETIQUETA_ESTADO[empleado.estado] ?? empleado.estado}
                        </span>
                      </td>
                      <td>
                        <div className="acciones-fila">
                          {puedeGestionar && (
                            <button
                              type="button"
                              className="boton-icono"
                              onClick={() => setEmpleadoEditando(empleado)}
                              title="Editar empleado"
                            >
                              <IconPencil size={17} />
                            </button>
                          )}
                          {esAdministrador && (
                            <button
                              type="button"
                              className="boton-icono"
                              onClick={() => setContrasenaPara(empleado)}
                              title="Cambiar contraseña"
                            >
                              <IconKey size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="comercial-paginacion">
            <span>
              {datos.count} empleado{datos.count === 1 ? '' : 's'}
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

      {empleadoEditando !== null && (
        <FormularioEmpleado
          empleado={empleadoEditando}
          onCerrar={() => setEmpleadoEditando(null)}
          onGuardado={empleadoGuardado}
        />
      )}

      {contrasenaPara && (
        <FormularioContrasena
          empleado={contrasenaPara}
          onCerrar={() => setContrasenaPara(null)}
        />
      )}
    </>
  )
}
