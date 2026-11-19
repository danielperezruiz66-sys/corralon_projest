import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconDownload,
  IconEye,
  IconLoader2,
  IconPackage,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import FormularioProductoProveedor from '../components/proveedores/FormularioProductoProveedor.jsx'
import FormularioProveedor from '../components/proveedores/FormularioProveedor.jsx'
import { useAuth } from '../context/auth-context'
import { useSucursal } from '../context/sucursal-context'
import useDebounce from '../hooks/useDebounce'
import { descargarCsv, numeroCsv } from '../utils/csv'
import { formatearMoneda } from '../utils/formato'
import '../styles/Comercial.css'
import '../styles/Inventario.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const TABS = [
  { id: 'proveedores', etiqueta: 'Proveedores', icono: IconTruck },
  { id: 'costos', etiqueta: 'Productos y costos', icono: IconPackage },
]

const ESTADOS = [
  { id: '', etiqueta: 'Todos' },
  { id: 'true', etiqueta: 'Activos' },
  { id: 'false', etiqueta: 'Inactivos' },
]

export default function Proveedores() {
  const { puedeEscribir } = useAuth()
  const { sucursalActiva } = useSucursal()
  const puedeEditar = puedeEscribir(['GE', 'ED'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'proveedores')
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [pagina, setPagina] = useState(
    () => Number(searchParams.get('page')) || 1,
  )
  const [estado, setEstado] = useState(
    () => searchParams.get('estado') || '',
  )
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [refresco, setRefresco] = useState(0)

  const [sucursales, setSucursales] = useState([])

  const [proveedorEditando, setProveedorEditando] = useState(null)
  const [costoEditando, setCostoEditando] = useState(null)
  const [detalleProveedor, setDetalleProveedor] = useState(null)
  const [detalleCostos, setDetalleCostos] = useState([])

  const busqueda = useDebounce(texto.trim(), 350)
  const buscando = texto.trim() !== busqueda || actualizando

  useEffect(() => {
    let vigente = true
    pedirTodas('/sucursales/')
      .then((sucursalesData) => {
        if (!vigente) {
          return
        }
        setSucursales(sucursalesData)
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
        }
      })

    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => {
    const parametros = new URLSearchParams()
    if (tab !== 'proveedores') {
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

  useEffect(() => {
    let vigente = true
    const controlador = new AbortController()
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }

    let ruta = '/proveedores/'
    if (tab === 'proveedores') {
      if (estado) {
        parametros.set('estado_prov', estado)
      }
    } else {
      ruta = '/productos-proveedores/'
    }

    pedir(`${ruta}?${parametros.toString()}`, {
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
  }, [tab, pagina, busqueda, estado, refresco])

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

  function refrescar() {
    setRefresco((valor) => valor + 1)
    setActualizando(true)
  }

  async function alternarEstado(proveedor) {
    const nuevo = !proveedor.estado_prov
    const resultado = await Swal.fire({
      title: `¿Marcar como ${nuevo ? 'activo' : 'inactivo'}?`,
      text: nuevo
        ? 'Volverá a estar disponible para compras.'
        : 'No se ofrecerá al registrar compras.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: nuevo ? 'Sí, activar' : 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) {
      return
    }
    try {
      const actualizado = await pedir(`/proveedores/${proveedor.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado_prov: nuevo }),
      })
      setDatos((actual) => ({
        ...actual,
        results: actual.results.map((item) =>
          item.id === actualizado.id ? actualizado : item,
        ),
      }))
      setDetalleProveedor((actual) =>
        actual && actual.id === actualizado.id ? actualizado : actual,
      )
      if (estado) {
        refrescar()
      }
      Swal.fire({
        icon: 'success',
        title: nuevo ? 'Proveedor activado' : 'Proveedor desactivado',
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

  function guardadoProveedor(_, esEdicion) {
    Swal.fire({
      icon: 'success',
      title: esEdicion ? 'Proveedor actualizado' : 'Proveedor creado',
      timer: 1500,
      showConfirmButton: false,
    })
    setProveedorEditando(null)
    refrescar()
  }

  function guardadoCosto(_, esEdicion) {
    Swal.fire({
      icon: 'success',
      title: esEdicion ? 'Costo actualizado' : 'Costo asociado',
      timer: 1500,
      showConfirmButton: false,
    })
    setCostoEditando(null)
    refrescar()
  }

  async function abrirDetalle(proveedor) {
    setDetalleProveedor(proveedor)
    setDetalleCostos([])
    try {
      const costos = await pedirTodas(
        `/productos-proveedores/?proveedor=${proveedor.id}`,
      )
      setDetalleCostos(costos)
    } catch (e) {
      setError(e.message)
    }
  }

  async function exportar() {
    setExportando(true)
    try {
      const parametros = new URLSearchParams()
      if (busqueda) parametros.set('search', busqueda)
      if (tab === 'proveedores' && estado) {
        parametros.set('estado_prov', estado)
      }
      const ruta =
        tab === 'proveedores' ? '/proveedores/' : '/productos-proveedores/'
      const todos = await pedirTodas(`${ruta}?${parametros}`)

      if (todos.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay datos para exportar.',
          confirmButtonColor: '#4a9da8',
        })
        return
      }

      let encabezados = []
      let filas = []
      if (tab === 'proveedores') {
        encabezados = [
          'Razón social',
          'Nombre',
          'CUIT',
          'Contacto',
          'Email',
          'Sucursales',
          'Estado',
        ]
        filas = todos.map((item) => [
          item.razon_social,
          item.nombre,
          item.cuit,
          item.contacto || '',
          item.email_prov || '',
          (item.sucursales_detalle || []).join(' / '),
          item.estado_prov ? 'Activo' : 'Inactivo',
        ])
      } else {
        encabezados = [
          'Proveedor',
          'Producto',
          'Código proveedor',
          'Precio costo',
          'Estado',
        ]
        filas = todos.map((item) => [
          item.proveedor_detalle,
          item.producto_detalle,
          item.codigo_producto_proveedor || '',
          numeroCsv(item.precio_lista),
          item.estado ? 'Activo' : 'Inactivo',
        ])
      }

      descargarCsv(
        `${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
        encabezados,
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
        titulo="Proveedores"
        subtitulo="Información, sucursales y costos"
      />

      <div className="comercial inventario">
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
              placeholder={
                tab === 'proveedores'
                  ? 'Buscar por CUIT, nombre o razón social'
                  : 'Buscar por proveedor, producto o código'
              }
              aria-label="Buscar proveedores"
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
            {puedeEditar && tab === 'proveedores' && (
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={() => setProveedorEditando({})}
              >
                <IconPlus size={18} />
                Nuevo proveedor
              </button>
            )}
            {puedeEditar && tab === 'costos' && (
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={() => setCostoEditando({})}
              >
                <IconPlus size={18} />
                Asociar producto
              </button>
            )}
          </div>
        </section>

        <section className="inventario-tabs">
          {TABS.map((item) => {
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

        {tab === 'proveedores' && (
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
        )}

        {error && <p className="comercial-error">{error}</p>}

        <section className={`comercial-panel ${actualizando ? 'panel-actualizando' : ''}`}>
          <div className="comercial-tabla-scroll">
            {tab === 'proveedores' ? (
              <table className="tabla-comercial">
                <thead>
                  <tr>
                    <th>Razón social</th>
                    <th>Nombre</th>
                    <th>CUIT</th>
                    <th>Contacto</th>
                    <th>Email</th>
                    <th>Sucursales</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando && (
                    <tr>
                      <td colSpan="8" className="comercial-vacio">
                        Cargando proveedores…
                      </td>
                    </tr>
                  )}
                  {!cargando && datos.results.length === 0 && (
                    <tr>
                      <td colSpan="8" className="comercial-vacio">
                        No se encontraron proveedores.
                      </td>
                    </tr>
                  )}
                  {datos.results.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.razon_social}</strong>
                      </td>
                      <td>{item.nombre}</td>
                      <td className="mono">{item.cuit}</td>
                      <td>{item.contacto || '—'}</td>
                      <td>{item.email_prov || '—'}</td>
                      <td className="texto-chico">
                        {(item.sucursales_detalle || []).join(' / ') || '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`inventario-estado ${
                            item.estado_prov ? 'activo' : 'inactivo'
                          }`}
                          onClick={() => alternarEstado(item)}
                          title={
                            item.estado_prov
                              ? 'Marcar como inactivo'
                              : 'Marcar como activo'
                          }
                        >
                          {item.estado_prov ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td>
                        <div className="acciones-fila">
                          <button
                            type="button"
                            className="boton-icono"
                            onClick={() => abrirDetalle(item)}
                            title="Ver ficha"
                          >
                            <IconEye size={17} />
                          </button>
                          {puedeEditar && (
                            <button
                              type="button"
                              className="boton-icono"
                              onClick={() => setProveedorEditando(item)}
                              title="Editar proveedor"
                            >
                              <IconPencil size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="tabla-comercial">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Producto</th>
                    <th>Código proveedor</th>
                    <th className="numero">Precio costo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando && (
                    <tr>
                      <td colSpan="6" className="comercial-vacio">
                        Cargando costos…
                      </td>
                    </tr>
                  )}
                  {!cargando && datos.results.length === 0 && (
                    <tr>
                      <td colSpan="6" className="comercial-vacio">
                        No se encontraron costos cargados.
                      </td>
                    </tr>
                  )}
                  {datos.results.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.proveedor_detalle}</strong>
                      </td>
                      <td>{item.producto_detalle}</td>
                      <td>{item.codigo_producto_proveedor || '—'}</td>
                      <td className="numero">
                        {formatearMoneda(item.precio_lista)}
                      </td>
                      <td>{item.estado ? 'Activo' : 'Inactivo'}</td>
                      <td>
                        {puedeEditar && (
                          <button
                            type="button"
                            className="boton-icono"
                            onClick={() => setCostoEditando(item)}
                            title="Editar costo"
                          >
                            <IconPencil size={17} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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

      {proveedorEditando !== null && (
        <FormularioProveedor
          key={sucursalActiva || 'todas'}
          proveedor={proveedorEditando}
          sucursales={sucursales}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setProveedorEditando(null)}
          onGuardado={guardadoProveedor}
        />
      )}

      {costoEditando !== null && (
        <FormularioProductoProveedor
          asociacion={costoEditando}
          sucursales={sucursales}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setCostoEditando(null)}
          onGuardado={guardadoCosto}
        />
      )}

      {detalleProveedor && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal inventario-modal-ancho">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconTruck size={24} />
                {detalleProveedor.razon_social}
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={() => setDetalleProveedor(null)}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="detalle-cabecera">
              <div>
                <span>Nombre</span>
                <strong>{detalleProveedor.nombre}</strong>
              </div>
              <div>
                <span>CUIT</span>
                <strong>{detalleProveedor.cuit}</strong>
              </div>
              <div>
                <span>Contacto</span>
                <strong>{detalleProveedor.contacto || '—'}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{detalleProveedor.email_prov || '—'}</strong>
              </div>
              <div>
                <span>Sucursales</span>
                <strong>
                  {(detalleProveedor.sucursales_detalle || []).join(' / ') ||
                    '—'}
                </strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>
                  {detalleProveedor.estado_prov ? 'Activo' : 'Inactivo'}
                </strong>
              </div>
            </div>

            <h3 className="inventario-subtitulo">Productos y costos</h3>
            <div className="comercial-tabla-scroll">
              <table className="tabla-comercial tabla-lineas">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Código proveedor</th>
                    <th className="numero">Costo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleCostos.map((item) => (
                    <tr key={item.id}>
                      <td>{item.producto_detalle}</td>
                      <td>{item.codigo_producto_proveedor || '—'}</td>
                      <td className="numero">
                        {formatearMoneda(item.precio_lista)}
                      </td>
                      <td>{item.estado ? 'Activo' : 'Inactivo'}</td>
                    </tr>
                  ))}
                  {detalleCostos.length === 0 && (
                    <tr>
                      <td colSpan="4" className="comercial-vacio">
                        Sin productos asociados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => setDetalleProveedor(null)}
              >
                Cerrar
              </button>
              {puedeEditar && (
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={() => {
                    const proveedor = detalleProveedor
                    setDetalleProveedor(null)
                    setProveedorEditando(proveedor)
                  }}
                >
                  <IconPencil size={18} />
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
