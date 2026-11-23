import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconBrandWhatsapp,
  IconDownload,
  IconEye,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconShoppingCart,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import { useAuth } from '../context/auth-context'
import FormularioCliente from '../components/clientes/FormularioCliente.jsx'
import useDebounce from '../hooks/useDebounce'
import useCacheModulo from '../hooks/useCacheModulo'
import { descargarCsv } from '../utils/csv'
import { formatearFechaHora, formatearMoneda } from '../utils/formato'
import '../styles/Clientes.css'
import '../styles/Filtros.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const ESTADOS = [
  { id: '', etiqueta: 'Todos' },
  { id: 'true', etiqueta: 'Activos' },
  { id: 'false', etiqueta: 'Inactivos' },
]

function nombreCliente(cliente) {
  if (cliente.razon_social) {
    return cliente.razon_social
  }
  const nombre = [cliente.apellido, cliente.nombre].filter(Boolean).join(', ')
  return nombre || `Cliente #${cliente.id}`
}

function documentoCliente(cliente) {
  if (!cliente.dni) {
    return '—'
  }
  return [cliente.tipo_documento_detalle, cliente.dni]
    .filter(Boolean)
    .join(' ')
}

function telefonoWhatsapp(telefono) {
  const digitos = String(telefono || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
  if (!digitos) {
    return ''
  }
  return digitos.startsWith('54') ? digitos : `54${digitos}`
}

export default function Clientes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [pagina, setPagina] = useState(
    () => Number(searchParams.get('page')) || 1,
  )
  const [estado, setEstado] = useState(
    () => searchParams.get('estado') || '',
  )
  const [exportando, setExportando] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(
    () => searchParams.get('nuevo') === '1',
  )
  const [clienteEditando, setClienteEditando] = useState(null)
  const [clienteDetalle, setClienteDetalle] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const solicitudResumen = useRef(0)

  const busqueda = useDebounce(texto.trim(), 350)

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

  const consulta = useCallback(() => {
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    return parametros.toString()
  }, [pagina, busqueda, estado])

  const consultar = useCallback(
    ({ signal } = {}) => pedir(`/clientes/?${consulta()}`, { signal }),
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
    clave: `clientes|${user?.id ?? ''}|${consulta()}`,
    consultar,
    inicial: PAGINA_VACIA,
  })

  const buscando = texto.trim() !== busqueda || actualizando

  function limpiarTexto() {
    setTexto('')
    setPagina(1)
  }

  function cambiarEstado(nuevoEstado) {
    if (nuevoEstado === estado) {
      return
    }
    setEstado(nuevoEstado)
    setPagina(1)
  }

  function irAPagina(nueva) {
    setPagina(nueva)
  }

  function abrirNuevo() {
    setClienteEditando(null)
    setModalAbierto(true)
  }

  function abrirEdicion(cliente) {
    solicitudResumen.current += 1
    setClienteDetalle(null)
    setResumen(null)
    setClienteEditando(cliente)
    setModalAbierto(false)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setClienteEditando(null)
  }

  function clienteGuardado(_, esEdicion) {
    Swal.fire({
      icon: 'success',
      title: esEdicion ? 'Cliente actualizado' : 'Cliente registrado',
      timer: 1500,
      showConfirmButton: false,
    })
    cerrarModal()
    invalidar(`clientes|${user?.id ?? ''}`)
    refrescar(true)
  }

  async function alternarEstadoCliente(cliente) {
    const nuevoEstado = !cliente.estado
    const resultado = await Swal.fire({
      title: `¿Marcar como ${nuevoEstado ? 'activo' : 'inactivo'}?`,
      text: nuevoEstado
        ? 'Volverá a estar disponible para nuevas ventas.'
        : 'No se ofrecerá al crear ventas, pero conserva su historial.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: nuevoEstado ? 'Sí, activar' : 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) {
      return
    }

    try {
      const actualizado = await pedir(`/clientes/${cliente.id}/estado/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      setClienteDetalle((actual) =>
        actual && actual.id === actualizado.id ? actualizado : actual,
      )
      invalidar(`clientes|${user?.id ?? ''}`)
      refrescar(true)
      Swal.fire({
        icon: 'success',
        title: nuevoEstado ? 'Cliente activado' : 'Cliente desactivado',
        timer: 1500,
        showConfirmButton: false,
      })
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cambiar el estado',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function abrirDetalle(cliente) {
    solicitudResumen.current += 1
    const solicitud = solicitudResumen.current
    setClienteDetalle(cliente)
    setResumen(null)
    setCargandoResumen(true)
    try {
      const datosResumen = await pedir(
        `/clientes/${cliente.id}/resumen/`,
      )
      if (solicitudResumen.current === solicitud) {
        setResumen(datosResumen)
      }
    } catch (e) {
      if (solicitudResumen.current === solicitud) {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo cargar la ficha',
          text: e.message,
          confirmButtonColor: '#4a9da8',
        })
      }
    } finally {
      if (solicitudResumen.current === solicitud) {
        setCargandoResumen(false)
      }
    }
  }

  function cerrarDetalle() {
    solicitudResumen.current += 1
    setClienteDetalle(null)
    setResumen(null)
    setCargandoResumen(false)
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

      const todos = await pedirTodas(
        `/clientes/?${parametros.toString()}`,
      )
      if (todos.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay clientes para exportar con los filtros actuales.',
          confirmButtonColor: '#4a9da8',
        })
        return
      }

      const filas = todos.map((cliente) => [
        cliente.id,
        nombreCliente(cliente),
        cliente.tipo_documento_detalle || '',
        cliente.dni || '',
        cliente.telefono || '',
        cliente.email || '',
        cliente.condicion_iva_detalle || '',
        cliente.direccion || '',
        cliente.estado ? 'Activo' : 'Inactivo',
      ])
      descargarCsv(
        `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'N.º de cliente',
          'Cliente',
          'Tipo de documento',
          'Documento',
          'Teléfono',
          'Email',
          'Condición IVA',
          'Dirección',
          'Estado',
        ],
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
        titulo="Clientes"
        subtitulo="Alta, edición y consulta de clientes"
      />

      <div className="clientes">
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
                placeholder="Buscar por DNI, razón social, nombre o email"
                aria-label="Buscar clientes"
              />
              {buscando && (
                <IconLoader2 className="icono-girando" size={18} />
              )}
              {texto && (
                <button
                  type="button"
                  className="boton-limpiar-busqueda"
                  onClick={limpiarTexto}
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
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={abrirNuevo}
              >
                <IconPlus size={18} />
                Nuevo cliente
              </button>
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
        </section>

        {error && <p className="clientes-error">{error}</p>}

        <section className="clientes-panel">
          <div className="clientes-tabla-scroll">
            <table className="tabla-clientes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Condición IVA</th>
                  <th>Estado</th>
                  <th className="cliente-acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="7" className="clientes-vacio">
                      Cargando clientes…
                    </td>
                  </tr>
                )}

                {!cargando && !error && datos.results.length === 0 && (
                  <tr>
                    <td colSpan="7" className="clientes-vacio">
                      No se encontraron clientes.
                    </td>
                  </tr>
                )}

                {!cargando &&
                  datos.results.map((cliente) => (
                    <tr key={cliente.id}>
                      <td>
                        <strong>{nombreCliente(cliente)}</strong>
                      </td>
                      <td>{documentoCliente(cliente)}</td>
                      <td>{cliente.telefono || '—'}</td>
                      <td>{cliente.email || '—'}</td>
                      <td>{cliente.condicion_iva_detalle || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className={`cliente-estado-cliente ${
                            cliente.estado ? 'activo' : 'inactivo'
                          }`}
                          onClick={() => alternarEstadoCliente(cliente)}
                          title={
                            cliente.estado
                              ? 'Marcar como inactivo'
                              : 'Marcar como activo'
                          }
                        >
                          {cliente.estado ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="cliente-acciones">
                        <div className="cliente-acciones-fila">
                          <button
                            type="button"
                            className="boton-secundario boton-accion-cliente"
                            onClick={() => abrirDetalle(cliente)}
                          >
                            <IconEye size={16} />
                            Ver
                          </button>
                          <button
                            type="button"
                            className="boton-secundario boton-accion-cliente"
                            onClick={() => abrirEdicion(cliente)}
                          >
                            <IconPencil size={16} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="clientes-paginacion">
            <span>
              {datos.count} cliente{datos.count === 1 ? '' : 's'}
            </span>
            <div>
              <button
                type="button"
                className="boton-secundario"
                disabled={!datos.previous || cargando}
                onClick={() => irAPagina(pagina - 1)}
              >
                Anterior
              </button>
              <span>Página {pagina}</span>
              <button
                type="button"
                className="boton-secundario"
                disabled={!datos.next || cargando}
                onClick={() => irAPagina(pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </div>

      {(modalAbierto || clienteEditando) && (
        <FormularioCliente
          cliente={clienteEditando}
          onCerrar={cerrarModal}
          onGuardado={clienteGuardado}
        />
      )}

      {clienteDetalle && (
        <div className="modal-fondo modal-fondo-superior" role="dialog" aria-modal="true">
          <div className="modal-tarjeta modal-tarjeta-ancha">
            <div className="modal-cabecera">
              <h2>
                {nombreCliente(clienteDetalle)}
                <span
                  className={`cliente-estado-cliente ${
                    clienteDetalle.estado ? 'activo' : 'inactivo'
                  }`}
                >
                  {clienteDetalle.estado ? 'Activo' : 'Inactivo'}
                </span>
              </h2>
              <button
                type="button"
                className="modal-cerrar"
                onClick={cerrarDetalle}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="cliente-detalle-grid">
              <div>
                <span>Documento</span>
                <strong>{documentoCliente(clienteDetalle)}</strong>
              </div>
              <div>
                <span>Condición IVA</span>
                <strong>
                  {clienteDetalle.condicion_iva_detalle || '—'}
                </strong>
              </div>
              <div>
                <span>Ingresos brutos</span>
                <strong>{clienteDetalle.ingresos_brutos || '—'}</strong>
              </div>
              <div>
                <span>Teléfono</span>
                <strong>{clienteDetalle.telefono || '—'}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{clienteDetalle.email || '—'}</strong>
              </div>
              <div>
                <span>Dirección</span>
                <strong>{clienteDetalle.direccion || '—'}</strong>
              </div>
            </div>

            {clienteDetalle.notas && (
              <div className="cliente-notas">
                <span>Notas internas</span>
                <p>{clienteDetalle.notas}</p>
              </div>
            )}

            {cargandoResumen && (
              <p className="cliente-resumen-cargando">
                <IconLoader2 className="icono-girando" size={18} />
                Cargando resumen de ventas…
              </p>
            )}

            {!cargandoResumen && resumen && (
              <>
                <div className="cliente-resumen">
                  <div>
                    <span>Total comprado</span>
                    <strong>
                      {formatearMoneda(resumen.total_comprado)}
                    </strong>
                  </div>
                  <div>
                    <span>Ventas</span>
                    <strong>{resumen.cantidad_ventas}</strong>
                  </div>
                  <div>
                    <span>Saldo pendiente</span>
                    <strong>
                      {formatearMoneda(resumen.saldo_pendiente)}
                    </strong>
                  </div>
                </div>

                <div className="cliente-ultima-venta">
                  <span>Última venta</span>
                  <strong>
                    {resumen.ultima_venta
                      ? formatearFechaHora(resumen.ultima_venta)
                      : 'Sin ventas registradas'}
                  </strong>
                </div>

                {resumen.ventas_recientes.length > 0 && (
                  <div className="clientes-tabla-scroll">
                    <table className="tabla-clientes tabla-resumen-cliente">
                      <thead>
                        <tr>
                          <th>Venta</th>
                          <th>Fecha</th>
                          <th className="numero">Monto</th>
                          <th>Estado</th>
                          <th className="numero">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.ventas_recientes.map((venta) => (
                          <tr key={venta.id}>
                            <td className="mono">#{venta.id}</td>
                            <td>{formatearFechaHora(venta.fecha_venta)}</td>
                            <td className="numero">
                              {formatearMoneda(venta.monto_venta)}
                            </td>
                            <td>{venta.estado_detalle}</td>
                            <td className="numero">
                              {formatearMoneda(venta.saldo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="modal-acciones cliente-detalle-acciones">
              <button
                type="button"
                className="boton-secundario"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="boton-secundario"
                onClick={() => abrirEdicion(clienteDetalle)}
              >
                <IconPencil size={18} />
                Editar
              </button>
              {clienteDetalle.telefono && (
                <a
                  className="boton-secundario"
                  href={`https://wa.me/${telefonoWhatsapp(
                    clienteDetalle.telefono,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconBrandWhatsapp size={18} />
                  WhatsApp
                </a>
              )}
              {clienteDetalle.estado && (
                <button
                  type="button"
                  className="boton-primario"
                  onClick={() =>
                    navigate(`/ventas?nueva=1&cliente=${clienteDetalle.id}`)
                  }
                >
                  <IconShoppingCart size={18} />
                  Nueva venta
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
