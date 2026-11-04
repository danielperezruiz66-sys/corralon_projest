import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconCheck,
  IconCircleX,
  IconEye,
  IconFileText,
  IconPlus,
  IconSearch,
  IconShoppingCart,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import FormularioVenta from '../components/comercial/FormularioVenta.jsx'
import { formatearFechaHora, formatearMoneda } from '../utils/formato'
import '../styles/Comercial.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const ESTADOS = [
  { id: '', etiqueta: 'Todas', ayuda: 'Todas las ventas.' },
  {
    id: 'PE',
    etiqueta: 'Pendientes',
    ayuda: 'Venta creada, con stock descontado, sin confirmar. Vence a los 30 minutos.',
  },
  {
    id: 'CO',
    etiqueta: 'Confirmadas',
    ayuda: 'Venta confirmada, con stock comprometido, pero sin pago total registrado.',
  },
  {
    id: 'PA',
    etiqueta: 'Pagadas',
    ayuda: 'Venta con pagos que cubren el total.',
  },
  {
    id: 'PC',
    etiqueta: 'Parciales',
    ayuda: 'Venta con pagos parciales; queda saldo pendiente.',
  },
  {
    id: 'AN',
    etiqueta: 'Anuladas',
    ayuda: 'Venta cancelada; el stock fue restaurado.',
  },
]

function nombreCliente(venta) {
  return venta.cliente_detalle || 'Consumidor final'
}

function claseEstado(estado) {
  return `estado-badge estado-${estado.toLowerCase()}`
}

export default function Ventas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [refresco, setRefresco] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(
    () =>
      searchParams.has('nueva') || searchParams.has('presupuesto'),
  )
  const [modo, setModo] = useState(
    () => (searchParams.get('presupuesto') === '1' ? 'presupuesto' : 'venta'),
  )

  useEffect(() => {
    if (searchParams.has('nueva') || searchParams.has('presupuesto')) {
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

    pedir(`/ventas/?${parametros.toString()}`)
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
  }, [pagina, busqueda, estado, refresco])

  function abrirNueva(modoNuevo = 'venta') {
    setModo(modoNuevo)
    setModalAbierto(true)
  }

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

  function irAPagina(nueva) {
    setCargando(true)
    setError('')
    setPagina(nueva)
  }

  async function confirmarVenta(venta) {
    const resultado = await Swal.fire({
      title: `¿Confirmar venta #${venta.id}?`,
      text: `${nombreCliente(venta)} · ${formatearMoneda(venta.monto_venta)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) {
      return
    }

    try {
      await pedir(`/ventas/${venta.id}/confirmar/`, { method: 'POST' })
      Swal.fire({
        icon: 'success',
        title: 'Venta confirmada',
        timer: 1500,
        showConfirmButton: false,
      })
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo confirmar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function cancelarVenta(venta) {
    const resultado = await Swal.fire({
      title: `¿Anular venta #${venta.id}?`,
      text: 'Se restaura el stock de los productos.',
      icon: 'warning',
      input: 'text',
      inputLabel: 'Motivo (opcional)',
      inputPlaceholder: 'Ej. el cliente desistió',
      showCancelButton: true,
      confirmButtonColor: '#b91c1c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Volver',
    })
    if (!resultado.isConfirmed) {
      return
    }

    try {
      await pedir(`/ventas/${venta.id}/cancelar/`, {
        method: 'POST',
        body: JSON.stringify({ motivo: resultado.value || '' }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Venta anulada',
        timer: 1500,
        showConfirmButton: false,
      })
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo anular',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  return (
    <>
      <Encabezado
        titulo="Ventas"
        subtitulo="Seguimiento, confirmación y presupuestos"
      />

      <div className="comercial">
        <section className="comercial-barra">
          <form className="comercial-busqueda" onSubmit={buscar}>
            <IconSearch size={20} />
            <input
              type="search"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Buscar por N.º de venta, cliente o DNI"
              aria-label="Buscar ventas"
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
              className="boton-comercial-secundario"
              onClick={() => abrirNueva('presupuesto')}
            >
              <IconFileText size={18} />
              Nuevo presupuesto
            </button>
            <button
              type="button"
              className="boton-comercial-primario"
              onClick={() => abrirNueva('venta')}
            >
              <IconPlus size={18} />
              Nueva venta
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
              title={opcion.ayuda}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </section>

        <p className="filtros-ayuda">
          Pendiente: sin confirmar · Confirmada: confirmada sin pago total ·
          Parcial: pago parcial · Pagada: pago total · Anulada: stock
          restaurado.
        </p>

        {error && <p className="comercial-error">{error}</p>}

        <section className="comercial-panel">
          <div className="comercial-tabla-scroll">
            <table className="tabla-comercial">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Caja / Sección</th>
                  <th className="numero">Monto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="7" className="comercial-vacio">
                      Cargando ventas…
                    </td>
                  </tr>
                )}

                {!cargando && !error && datos.results.length === 0 && (
                  <tr>
                    <td colSpan="7" className="comercial-vacio">
                      No se encontraron ventas.
                    </td>
                  </tr>
                )}

                {!cargando &&
                  datos.results.map((venta) => (
                    <tr key={venta.id}>
                      <td className="mono">#{venta.id}</td>
                      <td>{formatearFechaHora(venta.fecha_venta)}</td>
                      <td>
                        <strong>{nombreCliente(venta)}</strong>
                      </td>
                      <td className="texto-chico">
                        {venta.seccion_caja_detalle || '—'}
                      </td>
                      <td className="numero">
                        {formatearMoneda(venta.monto_venta)}
                      </td>
                      <td>
                        <span className={claseEstado(venta.estado)}>
                          {venta.estado_detalle}
                        </span>
                      </td>
                      <td>
                        <div className="acciones-fila">
                          <button
                            type="button"
                            className="boton-icono"
                            onClick={() => setDetalle(venta)}
                            title="Ver detalle"
                          >
                            <IconEye size={17} />
                          </button>
                          {venta.estado === 'PE' && (
                            <>
                              <button
                                type="button"
                                className="boton-icono boton-icono-exito"
                                onClick={() => confirmarVenta(venta)}
                                title="Confirmar venta"
                              >
                                <IconCheck size={17} />
                              </button>
                              <button
                                type="button"
                                className="boton-icono boton-icono-peligro"
                                onClick={() => cancelarVenta(venta)}
                                title="Anular venta"
                              >
                                <IconCircleX size={17} />
                              </button>
                            </>
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
              {datos.count} venta{datos.count === 1 ? '' : 's'}
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
        <FormularioVenta
          modo={modo}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => setRefresco((valor) => valor + 1)}
        />
      )}

      {detalle && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconShoppingCart size={24} />
                Venta #{detalle.id}
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
                <span>Cliente</span>
                <strong>{nombreCliente(detalle)}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>{formatearFechaHora(detalle.fecha_venta)}</strong>
              </div>
              <div>
                <span>Caja / Sección</span>
                <strong>{detalle.seccion_caja_detalle || '—'}</strong>
              </div>
              <div>
                <span>Estado</span>
                <span className={claseEstado(detalle.estado)}>
                  {detalle.estado_detalle}
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
                      <td className="numero">{item.cantidad_venta}</td>
                      <td className="numero">
                        {formatearMoneda(item.precio_venta)}
                      </td>
                      <td className="numero">{formatearMoneda(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="comercial-total">
              <span>Total</span>
              <strong>{formatearMoneda(detalle.monto_venta)}</strong>
            </div>

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>
              {detalle.estado === 'PE' && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => {
                    const venta = detalle
                    setDetalle(null)
                    confirmarVenta(venta)
                  }}
                >
                  Confirmar venta
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
