import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconCash,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleX,
  IconDownload,
  IconEye,
  IconFileText,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconShoppingCart,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import FiltrosFecha from '../components/comercial/FiltrosFecha.jsx'
import FormularioVenta from '../components/comercial/FormularioVenta.jsx'
import { useAuth } from '../context/auth-context'
import { useSucursal } from '../context/sucursal-context'
import useDebounce from '../hooks/useDebounce'
import { descargarCsv, numeroCsv } from '../utils/csv'
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
    ayuda: 'Venta creada, con stock descontado y sin confirmar. Puede tener pagos parciales. Vence a los 30 minutos si no tiene pagos.',
  },
  {
    id: 'CO',
    etiqueta: 'Confirmadas',
    ayuda: 'Venta con el pago total registrado y confirmada por el cajero.',
  },
  {
    id: 'AN',
    etiqueta: 'Anuladas',
    ayuda: 'Venta cancelada; el stock fue restaurado.',
  },
]

const ORDEN_INICIAL = '-fecha_venta'
let siguientePagoId = 1

function nuevoPago(metodo = '', monto = '') {
  siguientePagoId += 1
  return { id: siguientePagoId, metodo, monto }
}

function montoPago(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : 0
}

function nombreCliente(venta) {
  return venta.cliente_detalle || venta.cliente_venta || 'Consumidor final'
}

function claseEstado(estado) {
  return `estado-badge estado-${estado.toLowerCase()}`
}

function totalPagado(venta) {
  return (venta.pagos ?? []).reduce(
    (total, pago) => total + Number(pago.monto_pagado),
    0,
  )
}

function saldoVenta(venta) {
  return Math.max(0, Number(venta.monto_venta) - totalPagado(venta))
}

export default function Ventas() {
  const { puedeEscribir } = useAuth()
  const { sucursalActiva } = useSucursal()
  const puedeCobrar = puedeEscribir(['GE', 'CA'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [clienteInicial] = useState(
    () => searchParams.get('cliente') || '',
  )
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [estado, setEstado] = useState(
    () => searchParams.get('estado') || '',
  )
  const [alerta, setAlerta] = useState(
    () => searchParams.get('alerta') || '',
  )
  const [fechas, setFechas] = useState(() => ({
    fecha: searchParams.get('fecha') || '',
    desde: searchParams.get('fecha_desde') || '',
    hasta: searchParams.get('fecha_hasta') || '',
  }))
  const [orden, setOrden] = useState(
    () => searchParams.get('ordering') || ORDEN_INICIAL,
  )
  const [pagina, setPagina] = useState(
    () => Number(searchParams.get('page')) || 1,
  )
  const [refresco, setRefresco] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [cobro, setCobro] = useState(null)
  const [metodos, setMetodos] = useState([])
  const [pagosCobro, setPagosCobro] = useState([])
  const [confirmarCobro, setConfirmarCobro] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(
    () =>
      searchParams.has('nueva') || searchParams.has('presupuesto'),
  )
  const [modo, setModo] = useState(
    () => (searchParams.get('presupuesto') === '1' ? 'presupuesto' : 'venta'),
  )

  const textoDiferido = useDebounce(texto.trim(), 350)
  const busqueda = textoDiferido
  const rangoInvalido = Boolean(
    fechas.desde && fechas.hasta && fechas.desde > fechas.hasta,
  )
  const hayFiltros = Boolean(
    texto ||
      estado ||
      alerta ||
      fechas.fecha ||
      fechas.desde ||
      fechas.hasta ||
      orden !== ORDEN_INICIAL,
  )
  const buscando = texto.trim() !== busqueda || actualizando

  useEffect(() => {
    let vigente = true
    pedirTodas('/metodos-pago/?estado=true')
      .then((datos) => {
        if (vigente) {
          setMetodos(datos)
        }
      })
      .catch(() => {
        if (vigente) {
          setMetodos([])
        }
      })

    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => {
    const parametros = new URLSearchParams()
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    if (alerta) {
      parametros.set('alerta', alerta)
    }
    if (fechas.fecha) {
      parametros.set('fecha', fechas.fecha)
    }
    if (fechas.desde) {
      parametros.set('fecha_desde', fechas.desde)
    }
    if (fechas.hasta) {
      parametros.set('fecha_hasta', fechas.hasta)
    }
    if (orden !== ORDEN_INICIAL) {
      parametros.set('ordering', orden)
    }
    if (pagina > 1) {
      parametros.set('page', String(pagina))
    }
    setSearchParams(parametros, { replace: true })
  }, [busqueda, estado, alerta, fechas, orden, pagina, setSearchParams])

  useEffect(() => {
    if (rangoInvalido) {
      return undefined
    }

    let vigente = true
    const controlador = new AbortController()
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (estado) {
      parametros.set('estado', estado)
    }
    if (alerta) {
      parametros.set('alerta', alerta)
    }
    if (sucursalActiva) {
      parametros.set('sucursal', sucursalActiva)
    }
    if (fechas.fecha) {
      parametros.set('fecha', fechas.fecha)
    }
    if (fechas.desde) {
      parametros.set('fecha_desde', fechas.desde)
    }
    if (fechas.hasta) {
      parametros.set('fecha_hasta', fechas.hasta)
    }
    if (orden) {
      parametros.set('ordering', orden)
    }

    pedir(`/ventas/?${parametros.toString()}`, {
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
  }, [
    pagina,
    busqueda,
    estado,
    alerta,
    fechas,
    orden,
    refresco,
    rangoInvalido,
    sucursalActiva,
  ])

  function abrirNueva(modoNuevo = 'venta') {
    setModo(modoNuevo)
    setModalAbierto(true)
  }

  function limpiarTexto() {
    setTexto('')
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function limpiarTodo() {
    setTexto('')
    setEstado('')
    setAlerta('')
    setFechas({ fecha: '', desde: '', hasta: '' })
    setOrden(ORDEN_INICIAL)
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function cambiarEstado(nuevoEstado) {
    if (nuevoEstado === estado && !alerta) {
      return
    }
    setEstado(nuevoEstado)
    setAlerta('')
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function cambiarFechas(nuevas) {
    setFechas(nuevas)
    setPagina(1)
    setError('')
    setActualizando(
      !(nuevas.desde && nuevas.hasta && nuevas.desde > nuevas.hasta),
    )
  }

  function irAPagina(nueva) {
    setPagina(nueva)
    setError('')
    setActualizando(true)
  }

  function alternarOrden(campo) {
    setOrden((actual) =>
      actual === `-${campo}` ? campo : `-${campo}`,
    )
    setPagina(1)
    setActualizando(true)
  }

  function iconoOrden(campo) {
    if (orden === campo) {
      return <IconChevronUp size={14} />
    }
    if (orden === `-${campo}`) {
      return <IconChevronDown size={14} />
    }
    return null
  }

  async function exportar() {
    if (rangoInvalido) {
      return
    }
    setExportando(true)
    try {
      const parametros = new URLSearchParams()
      if (busqueda) {
        parametros.set('search', busqueda)
      }
      if (estado) {
        parametros.set('estado', estado)
      }
      if (alerta) {
        parametros.set('alerta', alerta)
      }
      if (sucursalActiva) {
        parametros.set('sucursal', sucursalActiva)
      }
      if (fechas.fecha) {
        parametros.set('fecha', fechas.fecha)
      }
      if (fechas.desde) {
        parametros.set('fecha_desde', fechas.desde)
      }
      if (fechas.hasta) {
        parametros.set('fecha_hasta', fechas.hasta)
      }
      if (orden) {
        parametros.set('ordering', orden)
      }

      const ventas = await pedirTodas(
        `/ventas/?${parametros.toString()}`,
      )
      if (ventas.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay ventas para exportar con los filtros actuales.',
          confirmButtonColor: '#4a9da8',
        })
        return
      }

      const filas = ventas.map((venta) => [
        venta.id,
        formatearFechaHora(venta.fecha_venta),
        nombreCliente(venta),
        venta.seccion_caja_detalle || '',
        numeroCsv(venta.monto_venta),
        numeroCsv(totalPagado(venta)),
        numeroCsv(saldoVenta(venta)),
        venta.estado_detalle,
      ])
      descargarCsv(
        `ventas-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'N.º de venta',
          'Fecha',
          'Cliente',
          'Caja / Sección',
          'Monto',
          'Pagado',
          'Saldo',
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

  const saldoCobro = cobro ? saldoVenta(cobro) : 0
  const totalCobro = pagosCobro.reduce(
    (total, pago) => total + montoPago(pago.monto),
    0,
  )
  const saldoDespuesCobro = saldoCobro - totalCobro
  const excedeSaldoCobro = totalCobro > saldoCobro + 0.001
  const cubreTotalCobro = saldoCobro > 0 && totalCobro >= saldoCobro - 0.001
  const pagosIncompletos = pagosCobro.some(
    (pago) => !pago.metodo || !(Number(pago.monto) > 0),
  )
  const confirmarEfectivo = confirmarCobro && cubreTotalCobro && !excedeSaldoCobro

  function agregarPago() {
    const usados = new Set(pagosCobro.map((pago) => pago.metodo))
    const libre =
      metodos.find((item) => !usados.has(String(item.id))) || metodos[0]
    setPagosCobro((previos) => [
      ...previos,
      nuevoPago(libre ? String(libre.id) : '', ''),
    ])
  }

  function actualizarPago(id, campo, valor) {
    setPagosCobro((previos) =>
      previos.map((pago) =>
        pago.id === id ? { ...pago, [campo]: valor } : pago,
      ),
    )
  }

  function quitarPago(id) {
    setPagosCobro((previos) =>
      previos.length > 1
        ? previos.filter((pago) => pago.id !== id)
        : previos,
    )
  }

  function abrirCobro(venta) {
    const saldo = saldoVenta(venta)
    const metodoInicial = metodos[0] ? String(metodos[0].id) : ''
    setPagosCobro([
      nuevoPago(metodoInicial, saldo > 0 ? saldo.toFixed(2) : ''),
    ])
    setConfirmarCobro(false)
    setCobro(venta)
    setDetalle(null)
  }

  async function registrarCobro() {
    if (!cobro) {
      return
    }
    if (metodos.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin métodos de pago',
        text: 'Configurá al menos un método de pago activo.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (pagosIncompletos) {
      Swal.fire({
        icon: 'warning',
        title: 'Pagos incompletos',
        text: 'Revisá el método y el monto de cada línea.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (excedeSaldoCobro) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto excedido',
        text: `El saldo pendiente es ${formatearMoneda(saldoCobro)}.`,
        confirmButtonColor: '#4a9da8',
      })
      return
    }
    if (confirmarEfectivo && totalCobro < saldoCobro - 0.001) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta saldo',
        text: 'Para confirmar la venta los pagos deben cubrir el total.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    setCobrando(true)
    try {
      await pedir(`/ventas/${cobro.id}/cobrar/`, {
        method: 'POST',
        body: JSON.stringify({
          pagos: pagosCobro.map((pago) => ({
            metodo_pago: Number(pago.metodo),
            monto_pagado: montoPago(pago.monto).toFixed(2),
          })),
          confirmar: confirmarEfectivo,
        }),
      })

      const quedaSaldo = totalCobro < saldoCobro - 0.001
      Swal.fire({
        icon: 'success',
        title: confirmarEfectivo
          ? 'Venta confirmada'
          : quedaSaldo
            ? 'Pagos registrados'
            : 'Total cubierto',
        text: confirmarEfectivo
          ? 'Los pagos quedaron registrados y la venta se cerró.'
          : quedaSaldo
            ? `Saldo pendiente: ${formatearMoneda(
                saldoCobro - totalCobro,
              )}. La venta sigue pendiente.`
            : 'Pagos registrados. Confirmá la venta para cerrarla.',
        timer: 2400,
        showConfirmButton: false,
      })
      setCobro(null)
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar el cobro',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
      setRefresco((valor) => valor + 1)
    } finally {
      setCobrando(false)
    }
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
              placeholder="Buscar por N.º de venta, cliente, DNI o consumidor final"
              aria-label="Buscar ventas"
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
            {hayFiltros && (
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={limpiarTodo}
              >
                Limpiar filtros
              </button>
            )}
            <button
              type="button"
              className="boton-comercial-secundario"
              onClick={exportar}
              disabled={exportando || rangoInvalido}
            >
              <IconDownload size={18} />
              {exportando ? 'Exportando…' : 'Exportar CSV'}
            </button>
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

        {alerta && (
          <div className="filtro-origen">
            <span>
              Filtro del dashboard:{' '}
              <strong>
                {alerta === 'por_vencer'
                  ? 'ventas por vencer'
                  : 'ventas vencidas sin barrido'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setAlerta('')
                setPagina(1)
                setActualizando(true)
              }}
            >
              <IconX size={15} />
              Quitar filtro
            </button>
          </div>
        )}

        <FiltrosFecha
          valores={fechas}
          onCambiar={cambiarFechas}
          error={
            rangoInvalido
              ? 'La fecha desde no puede ser posterior a la fecha hasta.'
              : ''
          }
        />

        <p className="filtros-ayuda">
          Pendiente: creada y sin confirmar; puede tener pagos parciales.
          Confirmada: paga y confirmada por el cajero. Anulada: stock
          restaurado.
        </p>

        {error && <p className="comercial-error">{error}</p>}

        <section
          className={`comercial-panel ${
            actualizando ? 'panel-actualizando' : ''
          }`}
        >
          <div className="comercial-tabla-scroll">
            <table className="tabla-comercial">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th
                    aria-sort={
                      orden === 'fecha_venta'
                        ? 'ascending'
                        : orden === '-fecha_venta'
                          ? 'descending'
                          : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="encabezado-orden"
                      onClick={() => alternarOrden('fecha_venta')}
                    >
                      Fecha {iconoOrden('fecha_venta')}
                    </button>
                  </th>
                  <th>Cliente</th>
                  <th>Caja / Sección</th>
                  <th
                    className="numero"
                    aria-sort={
                      orden === 'monto_venta'
                        ? 'ascending'
                        : orden === '-monto_venta'
                          ? 'descending'
                          : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="encabezado-orden"
                      onClick={() => alternarOrden('monto_venta')}
                    >
                      Monto {iconoOrden('monto_venta')}
                    </button>
                  </th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && !rangoInvalido && (
                  <tr>
                    <td colSpan="7" className="comercial-vacio">
                      Cargando ventas…
                    </td>
                  </tr>
                )}

                {!cargando &&
                  !rangoInvalido &&
                  !error &&
                  datos.results.length === 0 && (
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
                        <strong>{formatearMoneda(venta.monto_venta)}</strong>
                        {saldoVenta(venta) > 0 && (
                          <small>
                            Saldo: {formatearMoneda(saldoVenta(venta))}
                          </small>
                        )}
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
                          {puedeCobrar &&
                            venta.estado === 'PE' &&
                            saldoVenta(venta) > 0 && (
                              <button
                                type="button"
                                className="boton-icono boton-icono-exito"
                                onClick={() => abrirCobro(venta)}
                                title="Cobrar venta"
                              >
                                <IconCash size={17} />
                              </button>
                            )}
                          {puedeCobrar &&
                            venta.estado === 'PE' &&
                            saldoVenta(venta) <= 0 && (
                              <button
                                type="button"
                                className="boton-icono boton-icono-exito"
                                onClick={() => confirmarVenta(venta)}
                                title="Confirmar venta"
                              >
                                <IconCheck size={17} />
                              </button>
                            )}
                          {puedeCobrar &&
                            venta.estado === 'PE' &&
                            totalPagado(venta) === 0 && (
                              <button
                                type="button"
                                className="boton-icono boton-icono-peligro"
                                onClick={() => cancelarVenta(venta)}
                                title="Anular venta"
                              >
                                <IconCircleX size={17} />
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
          key={sucursalActiva || 'todas'}
          modo={modo}
          clienteInicial={clienteInicial}
          sucursalActiva={sucursalActiva}
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

            {detalle.pagos?.length > 0 && (
              <div className="cobro-pagos">
                <span>Pagos registrados</span>
                {detalle.pagos.map((pago) => (
                  <div key={pago.id}>
                    <span>{pago.metodo_pago_detalle}</span>
                    <strong>{formatearMoneda(pago.monto_pagado)}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>
              {puedeCobrar &&
                detalle.estado === 'PE' &&
                saldoVenta(detalle) <= 0 && (
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
              {puedeCobrar &&
                detalle.estado === 'PE' &&
                saldoVenta(detalle) > 0 && (
                  <button
                    type="button"
                    className="boton-comercial-primario"
                    onClick={() => abrirCobro(detalle)}
                  >
                    Cobrar venta
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {cobro && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal comercial-modal-medio">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconCash size={24} />
                Cobrar venta #{cobro.id}
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={() => setCobro(null)}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <p className="cobro-cliente">
              <IconUser size={18} />
              {nombreCliente(cobro)}
            </p>

            <div className="cobro-resumen">
              <div>
                <span>Total</span>
                <strong>{formatearMoneda(cobro.monto_venta)}</strong>
              </div>
              <div>
                <span>Pagado</span>
                <strong>{formatearMoneda(totalPagado(cobro))}</strong>
              </div>
              <div>
                <span>Saldo</span>
                <strong>{formatearMoneda(saldoVenta(cobro))}</strong>
              </div>
            </div>

            <p className="cobro-nota">
              Podés combinar varios métodos de pago. Si la suma cubre el
              saldo, podés confirmar la venta en el mismo paso.
            </p>

            <div className="cobro-pagos-lista">
              {pagosCobro.map((pago, indice) => (
                <div className="cobro-pago-fila" key={pago.id}>
                  <label className="campo-comercial">
                    <span>Método {indice + 1}</span>
                    <select
                      className={!pago.metodo ? 'input-error' : ''}
                      value={pago.metodo}
                      onChange={(evento) =>
                        actualizarPago(
                          pago.id,
                          'metodo',
                          evento.target.value,
                        )
                      }
                    >
                      <option value="">Seleccioná un método</option>
                      {metodos.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.metodo_pago}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="campo-comercial">
                    <span>Monto</span>
                    <input
                      type="number"
                      className={
                        !(Number(pago.monto) > 0) ? 'input-error' : ''
                      }
                      min="0.01"
                      step="0.01"
                      value={pago.monto}
                      onChange={(evento) =>
                        actualizarPago(
                          pago.id,
                          'monto',
                          evento.target.value,
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="boton-quitar-pago"
                    onClick={() => quitarPago(pago.id)}
                    disabled={pagosCobro.length === 1}
                    aria-label={`Quitar pago ${indice + 1}`}
                    title="Quitar este pago"
                  >
                    <IconTrash size={17} />
                  </button>
                </div>
              ))}
            </div>
            {pagosIncompletos && (
              <small className="mensaje-error-campo">
                Completá método y monto en cada línea.
              </small>
            )}
            {excedeSaldoCobro && (
              <small className="mensaje-error-campo">
                El total de los pagos supera el saldo pendiente.
              </small>
            )}

            <button
              type="button"
              className="boton-agregar-pago"
              onClick={agregarPago}
              disabled={metodos.length === 0}
            >
              <IconPlus size={16} />
              Agregar método de pago
            </button>

            <div className="cobro-totales">
              <div>
                <span>Total a registrar</span>
                <strong>{formatearMoneda(totalCobro)}</strong>
              </div>
              <div>
                <span>Saldo después</span>
                <strong
                  className={
                    excedeSaldoCobro
                      ? 'cobro-saldo-excedido'
                      : saldoDespuesCobro <= 0
                        ? 'cobro-saldo-cubierto'
                        : ''
                  }
                >
                  {formatearMoneda(Math.max(0, saldoDespuesCobro))}
                </strong>
              </div>
            </div>

            {excedeSaldoCobro && (
              <p className="comercial-error">
                Los pagos superan el saldo de{' '}
                {formatearMoneda(saldoCobro)}.
              </p>
            )}

            {cubreTotalCobro && !excedeSaldoCobro && (
              <label className="cobro-confirmar">
                <input
                  type="checkbox"
                  checked={confirmarCobro}
                  onChange={(evento) =>
                    setConfirmarCobro(evento.target.checked)
                  }
                />
                <span>Confirmar la venta al registrar los pagos</span>
              </label>
            )}

            {metodos.length === 0 && (
              <p className="comercial-error">
                No hay métodos de pago activos. Configuralos antes de cobrar.
              </p>
            )}

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => setCobro(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={registrarCobro}
                disabled={
                  cobrando ||
                  metodos.length === 0 ||
                  pagosIncompletos ||
                  excedeSaldoCobro
                }
              >
                {cobrando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    Registrando…
                  </>
                ) : confirmarEfectivo ? (
                  'Registrar pagos y confirmar'
                ) : (
                  'Registrar pagos'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
