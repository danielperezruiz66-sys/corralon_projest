import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconKey,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import FormularioContrasena from '../components/empleados/FormularioContrasena.jsx'
import FormularioEmpleado from '../components/empleados/FormularioEmpleado.jsx'
import { useAuth } from '../context/auth-context'
import useDebounce from '../hooks/useDebounce'
import useCacheModulo from '../hooks/useCacheModulo'
import '../styles/Comercial.css'
import '../styles/Inventario.css'
import '../styles/Filtros.css'
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

const ROLES = [
  { id: '', etiqueta: 'Todos los roles' },
  { id: 'AD', etiqueta: 'Admin' },
  { id: 'GE', etiqueta: 'Gerente' },
  { id: 'CA', etiqueta: 'Cajero' },
  { id: 'VE', etiqueta: 'Vendedor' },
  { id: 'ED', etiqueta: 'Depósito' },
]

export default function Empleados() {
  const { user, puedeEscribir } = useAuth()
  const puedeGestionar = puedeEscribir(['AD', 'GE'])
  const esAdministrador = Boolean(
    user?.is_superuser || (user?.codigos ?? []).includes('AD'),
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [estado, setEstado] = useState(() => searchParams.get('estado') || '')
  const [rol, setRol] = useState(() => searchParams.get('rol') || '')
  const [pagina, setPagina] = useState(
    () => Number(searchParams.get('page')) || 1,
  )


  const [empleadoEditando, setEmpleadoEditando] = useState(null)
  const [contrasenaPara, setContrasenaPara] = useState(null)

  const busqueda = useDebounce(texto.trim(), 350)

  useEffect(() => {
    const parametros = new URLSearchParams()
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    if (rol) {
      parametros.set('rol', rol)
    }
    if (pagina > 1) {
      parametros.set('page', String(pagina))
    }
    setSearchParams(parametros, { replace: true })
  }, [busqueda, estado, rol, pagina, setSearchParams])

  const consulta = useCallback(() => {
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    if (rol) {
      parametros.set('rol', rol)
    }
    return parametros.toString()
  }, [pagina, busqueda, estado, rol])

  const consultar = useCallback(
    ({ signal } = {}) => pedir(`/empleados/?${consulta()}`, { signal }),
    [consulta],
  )

  const {
    datos,
    cargando,
    actualizando,
    error,
    refrescar,
    invalidar,
  } = useCacheModulo({
    clave: `empleados|${user?.id ?? ''}|${consulta()}`,
    consultar,
    inicial: PAGINA_VACIA,
  })

  const buscando = texto.trim() !== busqueda || actualizando

  function irAPagina(numero) {
    setPagina(numero)
  }

  function cambiarEstado(nuevo) {
    setEstado((actual) => (actual === nuevo ? '' : nuevo))
    setPagina(1)
  }

  function cambiarRol(nuevo) {
    setRol((actual) => (actual === nuevo ? '' : nuevo))
    setPagina(1)
  }

  function empleadoGuardado() {
    setEmpleadoEditando(null)
    invalidar(`empleados|${user?.id ?? ''}`)
    refrescar(true)
    Swal.fire({
      icon: 'success',
      title: 'Empleado guardado',
      timer: 1400,
      showConfirmButton: false,
    })
  }


  return (
    <>
      <Encabezado
        titulo="Empleados"
        subtitulo="Administración de empleados, roles y accesos"
      />

      <div className="comercial inventario empleados-modulo">
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

          <section className="filtros-tabs filtros-pills">
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

          <section className="filtros-tabs filtros-pills">
            {ROLES.map((opcion) => (
              <button
                key={opcion.id || 'todos-roles'}
                type="button"
                className={rol === opcion.id ? 'activo' : ''}
                onClick={() => cambiarRol(opcion.id)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </section>
        </section>

        {error && <p className="comercial-error">{error}</p>}

        <section className={`comercial-panel ${actualizando ? 'panel-actualizando' : ''}`}>
          <div className="comercial-tabla-scroll">
            <table className="tabla-comercial tabla-empleados">
              <thead>
                <tr>
                  <th>Legajo</th>
                  <th>Empleado</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Roles</th>
                  <th>Acceso</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="8" className="comercial-vacio">
                      Cargando empleados…
                    </td>
                  </tr>
                )}
                {!cargando && !error && datos.results.length === 0 && (
                  <tr>
                    <td colSpan="8" className="comercial-vacio">
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
          puedeAsignarAdmin={esAdministrador}
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
