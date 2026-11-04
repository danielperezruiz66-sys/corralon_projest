import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconCheck,
  IconEye,
  IconPlus,
  IconSearch,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import FormularioCompra from '../components/comercial/FormularioCompra.jsx'
import { formatearFechaHora, formatearMoneda } from '../utils/formato'
import '../styles/Comercial.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const ESTADOS = [
  { id: '', etiqueta: 'Todas' },
  { id: 'PE', etiqueta: 'Pendientes' },
  { id: 'PA', etiqueta: 'Pagadas' },
  { id: 'PC', etiqueta: 'Parciales' },
  { id: 'AN', etiqueta: 'Anuladas' },
]

function claseEstado(estado) {
  return `estado-badge estado-${estado.toLowerCase()}`
}

export default function Compras() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [porRecibir, setPorRecibir] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [refresco, setRefresco] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(
    () => searchParams.get('nueva') === '1',
  )

  useEffect(() => {
    if (searchParams.get('nueva') === '1') {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let vigente = true
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    if (porRecibir) {
      parametros.set('por_recibir', '1')
    }

    pedir(`/compras/?${parametros.toString()}`)
      .then((respuesta) => {
        if (vigente) {
          setDatos(respuesta)
          setError('')
        }
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [pagina, busqueda, estado, porRecibir, refresco])

  function buscar(evento) {
    evento.preventDefault()
    setCargando(true)
    setError('')
    setPagina(1)
    setBusqueda(texto.trim())
    setRefresco((valor) => valor + 1)
  }

  function limpiar() {
    setCargando(true)
    setError('')
    setTexto('')
    setBusqueda('')
    setPagina(1)
    setRefresco((valor) => valor + 1)
  }

  function cambiarEstado(nuevoEstado) {
    if (nuevoEstado === estado) {
      return
    }
    setCargando(true)
    setError('')
    setEstado(nuevoEstado)
    setPagina(1)
  }

  function alternarPorRecibir() {
    setCargando(true)
    setError('')
    setPorRecibir((valor) => !valor)
    setPagina(1)
  }

  function irAPagina(nueva) {
    setCargando(true)
    setError('')
    setPagina(nueva)
  }

  async function recibirCompra(compra) {
    const resultado = await Swal.fire({
      title: `¿Recibir compra #${compra.id}?`,
      text: 'Se repone el stock en el depósito predeterminado de la sucursal.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, recibir',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) {
      return
    }

    try {
      await pedir(`/compras/${compra.id}/recibir/`, { method: 'POST' })
      Swal.fire({
        icon: 'success',
        title: 'Compra recibida',
        text: 'El stock fue repuesto.',
        timer: 1600,
        showConfirmButton: false,
      })
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo recibir',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  return (
    <>
      <Encabezado
        titulo="Compras"
        subtitulo="Registro, recepción y control de compras"
      />

      <div className="comercial">
        <section className="comercial-barra">
          <form className="comercial-busqueda" onSubmit={buscar}>
            <IconSearch size={20} />
            <input
              type="search"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Buscar por proveedor o CUIT"
              aria-label="Buscar compras"
            />
            <button type="submit" className="boton-comercial-secundario">
              Buscar
            </button>
            {(texto || busqueda) && (
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={limpiar}
              >
                Limpiar
              </button>
            )}
          </form>

          <div className="comercial-acciones-barra">
            <button
              type="button"
              className="boton-comercial-primario"
              onClick={() => setModalAbierto(true)}
            >
              <IconPlus size={18} />
              Nueva compra
            </button>
          </div>
        </section>

        <section className="filtros-tabs">
          {ESTADOS.map((opcion) => (
            <button
              key={opcion.id || 'todas'}
              type="button"
              className={estado === opcion.id ? 'activo' : ''}
              onClick={() => cambiarEstado(opcion.id)}
            >
              {opcion.etiqueta}
            </button>
          ))}
          <button
            type="button"
            className={`filtro-destacado ${porRecibir ? 'activo' : ''}`}
            onClick={alternarPorRecibir}
          >
            Por recibir
          </button>
        </section>

        {error && <p className="comercial-error">{error}</p>}

        <section className="comercial-panel">
          <div className="comercial-tabla-scroll">
            <table className="tabla-comercial">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Caja / Sección</th>
                  <th className="numero">Monto</th>
                  <th>Estado</th>
                  <th>Recepción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="8" className="comercial-vacio">
                      Cargando compras…
                    </td>
                  </tr>
                )}

                {!cargando && !error && datos.results.length === 0 && (
                  <tr>
                    <td colSpan="8" className="comercial-vacio">
                      No se encontraron compras.
                    </td>
                  </tr>
                )}

                {!cargando &&
                  datos.results.map((compra) => (
                    <tr key={compra.id}>
                      <td className="mono">#{compra.id}</td>
                      <td>{formatearFechaHora(compra.fecha_compra)}</td>
                      <td>
                        <strong>{compra.proveedor_detalle || 'Sin proveedor'}</strong>
                      </td>
                      <td className="texto-chico">
                        {compra.seccion_caja_detalle || '—'}
                      </td>
                      <td className="numero">
                        {formatearMoneda(compra.monto_compra)}
                      </td>
                      <td>
                        <span className={claseEstado(compra.estado)}>
                          {compra.estado_detalle}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`estado-badge ${
                            compra.recibida ? 'estado-recibida' : 'estado-pe'
                          }`}
                        >
                          {compra.recibida ? 'Recibida' : 'Por recibir'}
                        </span>
                      </td>
                      <td>
                        <div className="acciones-fila">
                          <button
                            type="button"
                            className="boton-icono"
                            onClick={() => setDetalle(compra)}
                            title="Ver detalle"
                          >
                            <IconEye size={17} />
                          </button>
                          {!compra.recibida && (
                            <button
                              type="button"
                              className="boton-icono boton-icono-exito"
                              onClick={() => recibirCompra(compra)}
                              title="Recibir compra"
                            >
                              <IconCheck size={17} />
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
              {datos.count} compra{datos.count === 1 ? '' : 's'}
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

      {modalAbierto && (
        <FormularioCompra
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => setRefresco((valor) => valor + 1)}
        />
      )}

      {detalle && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconTruckDelivery size={24} />
                Compra #{detalle.id}
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={() => setDetalle(null)}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="detalle-cabecera">
              <div>
                <span>Proveedor</span>
                <strong>{detalle.proveedor_detalle || 'Sin proveedor'}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>{formatearFechaHora(detalle.fecha_compra)}</strong>
              </div>
              <div>
                <span>Caja / Sección</span>
                <strong>{detalle.seccion_caja_detalle || '—'}</strong>
              </div>
              <div>
                <span>Recepción</span>
                <span
                  className={`estado-badge ${
                    detalle.recibida ? 'estado-recibida' : 'estado-pe'
                  }`}
                >
                  {detalle.recibida ? 'Recibida' : 'Por recibir'}
                </span>
              </div>
            </div>

            <div className="comercial-tabla-scroll">
              <table className="tabla-comercial tabla-lineas">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="numero">Cantidad</th>
                    <th className="numero">Precio</th>
                    <th className="numero">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.detalles.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.producto_detalle}</strong>
                      </td>
                      <td className="numero">{item.cantidad_compra}</td>
                      <td className="numero">
                        {formatearMoneda(item.precio_compra)}
                      </td>
                      <td className="numero">{formatearMoneda(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="comercial-total">
              <span>Total</span>
              <strong>{formatearMoneda(detalle.monto_compra)}</strong>
            </div>

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>
              {!detalle.recibida && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => {
                    const compra = detalle
                    setDetalle(null)
                    recibirCompra(compra)
                  }}
                >
                  Recibir compra
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
