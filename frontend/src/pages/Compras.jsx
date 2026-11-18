import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconBan,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClipboardList,
  IconDownload,
  IconEye,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import FiltrosFecha from '../components/comercial/FiltrosFecha.jsx'
import FormularioCompra from '../components/comercial/FormularioCompra.jsx'
import { useAuth } from '../context/auth-context'
import { useSucursal } from '../context/sucursal-context'
import useDebounce from '../hooks/useDebounce'
import { descargarCsv, numeroCsv } from '../utils/csv'
import { nuevaClave } from '../utils/clave'
import { formatearFecha, formatearFechaHora, formatearMoneda } from '../utils/formato'
import '../styles/Comercial.css'
import '../styles/components/comercial/Cobro.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const ESTADOS = [
  { id: '', etiqueta: 'Todas', ayuda: 'Todas las compras.' },
  {
    id: 'PE',
    etiqueta: 'Pendientes',
    ayuda: 'Compra registrada sin pago total.',
  },
  {
    id: 'PA',
    etiqueta: 'Pagadas',
    ayuda: 'Compra con pagos que cubren el total.',
  },
  {
    id: 'PC',
    etiqueta: 'Parciales',
    ayuda: 'Compra con pagos parciales; queda saldo pendiente.',
  },
  {
    id: 'AN',
    etiqueta: 'Anuladas',
    ayuda: 'Compra anulada.',
  },
]

const ORDEN_INICIAL = '-fecha_compra'

const TABS = [
  { id: 'compras', etiqueta: 'Compras', icono: IconTruckDelivery },
  { id: 'solicitudes', etiqueta: 'Solicitudes', icono: IconClipboardList },
]

function claseEstado(estado) {
  return `estado-badge estado-${estado.toLowerCase()}`
}

function claseEntrega(compra) {
  if (compra.estado === 'AN') {
    return 'estado-badge estado-an'
  }
  if (compra.estado_entrega === 'RE') {
    return 'estado-badge estado-recibida'
  }
  if (compra.estado_entrega === 'EC') {
    return 'estado-badge estado-ec'
  }
  return 'estado-badge estado-pe'
}

function etiquetaEntrega(compra) {
  if (compra.estado === 'AN') {
    return 'Anulada'
  }
  return compra.estado_entrega_detalle || 'Por recibir'
}

let siguientePagoId = 1

function nuevoPago(metodo = '', monto = '') {
  siguientePagoId += 1
  return { id: siguientePagoId, metodo, monto }
}

function montoPago(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : 0
}

function totalPagado(compra) {
  return (compra.pagos ?? []).reduce(
    (total, pago) => total + Number(pago.monto_pagado),
    0,
  )
}

function saldoCompra(compra) {
  return Math.max(0, Number(compra.monto_compra) - totalPagado(compra))
}

function fechaHoyLocal() {
  const hoy = new Date()
  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-')
}

function fechaMinimaLlegada() {
  return fechaHoyLocal()
}

export default function Compras() {
  const { puedeEscribir } = useAuth()
  const { sucursalActiva } = useSucursal()
  const puedeCrear = puedeEscribir(['AD', 'GE', 'ED', 'CA', 'VE'])
  const puedeOperar = puedeEscribir(['AD', 'GE', 'ED', 'CA', 'VE'])
  const puedeGestionar = puedeEscribir(['AD', 'GE'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [estado, setEstado] = useState(
    () => searchParams.get('estado') || '',
  )
  const [entrega, setEntrega] = useState(() => {
    if (searchParams.get('por_recibir') === '1') {
      return 'por_recibir'
    }
    return searchParams.get('estado_entrega') || ''
  })
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
  const [pago, setPago] = useState(null)
  const [metodos, setMetodos] = useState([])
  const [pagosPago, setPagosPago] = useState([])
  const [pagando, setPagando] = useState(false)
  const [depositos, setDepositos] = useState([])
  const [modalAbierto, setModalAbierto] = useState(
    () => searchParams.get('nueva') === '1',
  )
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'compras')
  const [solicitudes, setSolicitudes] = useState([])
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true)
  const [pagoSolicitud, setPagoSolicitud] = useState(null)
  const [clavePago, setClavePago] = useState('')
  const [resolviendo, setResolviendo] = useState(false)

  const textoDiferido = useDebounce(texto.trim(), 350)
  const busqueda = textoDiferido
  const rangoInvalido = Boolean(
    fechas.desde && fechas.hasta && fechas.desde > fechas.hasta,
  )
  const porRecibir = entrega === 'por_recibir'
  const enCamino = entrega === 'EC'
  const hayFiltros = Boolean(
    texto ||
      estado ||
      entrega ||
      fechas.fecha ||
      fechas.desde ||
      fechas.hasta ||
      orden !== ORDEN_INICIAL,
  )
  const buscando = texto.trim() !== busqueda || actualizando
  const saldoPago = pago ? saldoCompra(pago) : 0
  const solicitudesPendientes = solicitudes.filter(
    (item) => item.estado === 'PE',
  ).length
  const totalPago = pagosPago.reduce(
    (total, item) => total + montoPago(item.monto),
    0,
  )
  const excedeSaldoPago = totalPago > saldoPago
  const pagosIncompletos = pagosPago.some(
    (item) => !item.metodo || montoPago(item.monto) <= 0,
  )

  useEffect(() => {
    let vigente = true
    pedir('/solicitudes-compras/?page=1')
      .then((respuesta) => {
        if (vigente) {
          setSolicitudes(respuesta.results ?? [])
        }
      })
      .catch(() => {
        if (vigente) {
          setSolicitudes([])
        }
      })
      .finally(() => {
        if (vigente) {
          setCargandoSolicitudes(false)
        }
      })
    return () => {
      vigente = false
    }
  }, [refresco])

  useEffect(() => {
    let vigente = true
    pedirTodas('/depositos/')
      .then((datosDepositos) => {
        if (vigente) {
          setDepositos(datosDepositos)
        }
      })
      .catch(() => {})
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
    if (entrega === 'por_recibir') {
      parametros.set('por_recibir', '1')
    } else if (entrega) {
      parametros.set('estado_entrega', entrega)
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
    if (tab !== 'compras') {
      parametros.set('tab', tab)
    }
    setSearchParams(parametros, { replace: true })
  }, [busqueda, estado, entrega, fechas, orden, pagina, tab, setSearchParams])

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
    if (sucursalActiva) {
      parametros.set('sucursal', sucursalActiva)
    }
    if (entrega === 'por_recibir') {
      parametros.set('por_recibir', '1')
    } else if (entrega) {
      parametros.set('estado_entrega', entrega)
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

    pedir(`/compras/?${parametros.toString()}`, {
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
  }, [pagina, busqueda, estado, entrega, fechas, orden, refresco, rangoInvalido, sucursalActiva])

  function limpiarTexto() {
    setTexto('')
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function limpiarTodo() {
    setTexto('')
    setEstado('')
    setEntrega('')
    setFechas({ fecha: '', desde: '', hasta: '' })
    setOrden(ORDEN_INICIAL)
    setPagina(1)
    setError('')
    setActualizando(true)
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

  function cambiarEntrega(nuevoEntrega) {
    setEntrega((actual) => (actual === nuevoEntrega ? '' : nuevoEntrega))
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
    setOrden((actual) => (actual === `-${campo}` ? campo : `-${campo}`))
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
      if (sucursalActiva) {
        parametros.set('sucursal', sucursalActiva)
      }
      if (entrega === 'por_recibir') {
        parametros.set('por_recibir', '1')
      } else if (entrega) {
        parametros.set('estado_entrega', entrega)
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

      const todas = await pedirTodas(
        `/compras/?${parametros.toString()}`,
      )
      if (todas.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay compras para exportar con los filtros actuales.',
          confirmButtonColor: '#4a9da8',
        })
        return
      }

      const filas = todas.map((compra) => [
        compra.id,
        formatearFechaHora(compra.fecha_compra),
        compra.proveedor_detalle || 'Sin proveedor',
        compra.seccion_caja_detalle || '',
        numeroCsv(compra.monto_compra),
        compra.estado_detalle,
        etiquetaEntrega(compra),
        compra.fecha_estimada_llegada
          ? formatearFecha(compra.fecha_estimada_llegada)
          : '',
      ])
      descargarCsv(
        `compras-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'N.º de compra',
          'Fecha',
          'Proveedor',
          'Caja / Sección',
          'Monto',
          'Estado de pago',
          'Recepción',
          'Llegada estimada',
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

  async function marcarEnCamino(compra) {
    const fechaMinima = fechaMinimaLlegada()
    const resultado = await Swal.fire({
      title: `¿Marcar compra #${compra.id} en camino?`,
      text: 'El stock se repone recién al recibirla.',
      icon: 'question',
      input: 'date',
      inputLabel: 'Fecha estimada de llegada',
      inputValue: compra.fecha_estimada_llegada || '',
      inputAttributes: { min: fechaMinima },
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Marcar en camino',
      cancelButtonText: 'Cancelar',
      inputValidator: (valor) => {
        if (!valor) {
          return 'Indicá la fecha estimada de llegada.'
        }
        if (valor < fechaMinima) {
          return 'La fecha estimada de llegada no puede ser anterior a la fecha de compra.'
        }
        return null
      },
    })
    if (!resultado.isConfirmed) {
      return
    }

    try {
      await pedir(`/compras/${compra.id}/en-camino/`, {
        method: 'POST',
        body: JSON.stringify({
          fecha_estimada_llegada: resultado.value || null,
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Compra en camino',
        text: 'Todavía no se movió stock.',
        timer: 1700,
        showConfirmButton: false,
      })
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo actualizar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function recibirCompra(compra) {
    const opciones = {
      '': 'Depósito central (por defecto)',
      ...Object.fromEntries(
        depositos.map((item) => [
          String(item.id),
          `${item.nombre}${item.sucursal_detalle ? ` · ${item.sucursal_detalle}` : ''}`,
        ]),
      ),
    }
    const resultado = await Swal.fire({
      title: `¿Recibir compra #${compra.id}?`,
      text: 'Elegí el depósito de recepción. Si no elegís, se usa el depósito principal de la sucursal central.',
      icon: 'question',
      input: 'select',
      inputOptions: opciones,
      inputValue: '',
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
      await pedir(`/compras/${compra.id}/recibir/`, {
        method: 'POST',
        body: JSON.stringify({
          deposito: resultado.value ? Number(resultado.value) : null,
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Compra recibida',
        text: 'El stock fue repuesto en el depósito seleccionado.',
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

  async function abrirPago(compra) {
    setPago(compra)
    setClavePago(nuevaClave())
    setPagosPago([nuevoPago('', saldoCompra(compra).toFixed(2))])
    if (metodos.length > 0) {
      return
    }
    try {
      const datos = await pedirTodas('/metodos-pago/?estado=true')
      setMetodos(datos)
    } catch {
      setMetodos([])
    }
  }

  function agregarPago() {
    setPagosPago((actuales) => [...actuales, nuevoPago()])
  }

  function actualizarPago(id, campo, valor) {
    setPagosPago((actuales) =>
      actuales.map((item) =>
        item.id === id ? { ...item, [campo]: valor } : item,
      ),
    )
  }

  function quitarPago(id) {
    setPagosPago((actuales) => actuales.filter((item) => item.id !== id))
  }

  function cerrarPago() {
    setPago(null)
    setPagoSolicitud(null)
    setClavePago('')
  }

  async function registrarPago() {
    if (!pago) {
      return
    }
    setPagando(true)
    const cuerpo = {
      clave: clavePago,
      pagos: pagosPago.map((item) => ({
        metodo_pago: Number(item.metodo),
        monto_pagado: montoPago(item.monto).toFixed(2),
      })),
    }
    try {
      let actualizada
      if (pagoSolicitud) {
        await pedir(`/solicitudes-compras/${pagoSolicitud.id}/resolver/`, {
          method: 'POST',
          body: JSON.stringify({ accion: 'PAGAR', ...cuerpo }),
        })
        actualizada = await pedir(`/compras/${pago.id}/`)
      } else {
        actualizada = await pedir(`/compras/${pago.id}/pagar/`, {
          method: 'POST',
          body: JSON.stringify(cuerpo),
        })
      }
      cerrarPago()
      setDetalle((actual) =>
        actual && actual.id === actualizada.id ? actualizada : actual,
      )
      setRefresco((valor) => valor + 1)
      Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        text:
          actualizada.estado === 'PA'
            ? 'La compra quedó pagada.'
            : 'La compra quedó con pago parcial.',
        timer: 1700,
        showConfirmButton: false,
      })
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar el pago',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setPagando(false)
    }
  }

  async function enviarSolicitud(compra, tipo, motivo) {
    try {
      await pedir(`/compras/${compra.id}/solicitar/`, {
        method: 'POST',
        body: JSON.stringify({ tipo, motivo }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Solicitud enviada',
        text: 'Queda a la espera de que administración la resuelva.',
        timer: 1900,
        showConfirmButton: false,
      })
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo enviar la solicitud',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function solicitarPago(compra) {
    const resultado = await Swal.fire({
      title: `¿Solicitar el pago de la compra #${compra.id}?`,
      text: 'Administración (AD/GE) tiene que resolverla. Mientras tanto la compra no se puede pagar.',
      icon: 'question',
      input: 'textarea',
      inputLabel: 'Motivo de la solicitud *',
      inputPlaceholder: 'Indicá por qué se necesita el pago',
      inputAttributes: { maxlength: 500 },
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, solicitar',
      cancelButtonText: 'Cancelar',
      inputValidator: (valor) => {
        if (!valor || valor.trim().length < 10) {
          return 'Explicá el motivo (10 caracteres o más).'
        }
        return null
      },
    })
    if (!resultado.isConfirmed) {
      return
    }
    await enviarSolicitud(compra, 'PG', resultado.value)
  }

  async function solicitarAnulacion(compra) {
    const resultado = await Swal.fire({
      title: `¿Solicitar la anulación de la compra #${compra.id}?`,
      text: 'Administración (AD/GE) tiene que resolverla.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Motivo de la solicitud *',
      inputPlaceholder: 'Indicá por qué hay que anular la compra',
      inputAttributes: { maxlength: 500 },
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, solicitar',
      cancelButtonText: 'Cancelar',
      inputValidator: (valor) => {
        if (!valor || valor.trim().length < 10) {
          return 'Explicá el motivo (10 caracteres o más).'
        }
        return null
      },
    })
    if (!resultado.isConfirmed) {
      return
    }
    await enviarSolicitud(compra, 'AN', resultado.value)
  }

  async function abrirPagoSolicitud(solicitud) {
    setResolviendo(true)
    try {
      const compra = await pedir(`/compras/${solicitud.compra}/`)
      setPagoSolicitud(solicitud)
      setPago(compra)
      setClavePago(nuevaClave())
      setPagosPago([nuevoPago('', saldoCompra(compra).toFixed(2))])
      if (metodos.length === 0) {
        const datos = await pedirTodas('/metodos-pago/?estado=true')
        setMetodos(datos)
      }
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo abrir el pago',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setResolviendo(false)
    }
  }

  async function resolverSolicitud(solicitud, accion, motivo = '') {
    try {
      await pedir(`/solicitudes-compras/${solicitud.id}/resolver/`, {
        method: 'POST',
        body: JSON.stringify({ accion, motivo }),
      })
      Swal.fire({
        icon: 'success',
        title:
          accion === 'RECHAZAR' ? 'Solicitud rechazada' : 'Solicitud resuelta',
        timer: 1800,
        showConfirmButton: false,
      })
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo resolver la solicitud',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function rechazarSolicitud(solicitud) {
    const resultado = await Swal.fire({
      title: '¿Rechazar la solicitud?',
      text: 'La compra queda como está y la solicitud queda registrada como rechazada.',
      icon: 'question',
      input: 'textarea',
      inputLabel: 'Motivo del rechazo *',
      inputPlaceholder: 'Indicá por qué no se aprueba',
      inputAttributes: { maxlength: 500 },
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, rechazar',
      cancelButtonText: 'Cancelar',
      inputValidator: (valor) => {
        if (!valor || valor.trim().length < 10) {
          return 'Explicá el motivo (10 caracteres o más).'
        }
        return null
      },
    })
    if (!resultado.isConfirmed) {
      return
    }
    await resolverSolicitud(solicitud, 'RECHAZAR', resultado.value)
  }

  async function anularCompra(compra) {
    const resultado = await Swal.fire({
      title: `¿Anular compra #${compra.id}?`,
      text: 'Solo se puede anular una compra que no fue recibida ni tiene pagos.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Motivo de la anulación *',
      inputPlaceholder: 'Indicá por qué se anula la compra',
      inputAttributes: { maxlength: 500 },
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      inputValidator: (valor) => {
        if (!valor || !valor.trim()) {
          return 'El motivo de la anulación es obligatorio.'
        }
        return null
      },
    })
    if (!resultado.isConfirmed) {
      return
    }

    try {
      const actualizada = await pedir(`/compras/${compra.id}/anular/`, {
        method: 'POST',
        body: JSON.stringify({ motivo: resultado.value.trim() }),
      })
      setDetalle((actual) =>
        actual && actual.id === actualizada.id ? actualizada : actual,
      )
      setRefresco((valor) => valor + 1)
      Swal.fire({
        icon: 'success',
        title: 'Compra anulada',
        timer: 1600,
        showConfirmButton: false,
      })
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
        titulo="Compras"
        subtitulo="Registro, recepción y control de compras"
      />

      <div className="comercial">
        <section className="compras-tabs">
          {TABS.map((item) => {
            const Icono = item.icono
            return (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'activo' : ''}
                onClick={() => setTab(item.id)}
              >
                <Icono size={18} />
                {item.etiqueta}
                {item.id === 'solicitudes' && solicitudesPendientes > 0 && (
                  <span className="compras-tabs-contador">
                    {solicitudesPendientes}
                  </span>
                )}
              </button>
            )
          })}
        </section>

        {tab === 'compras' && (
          <>
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
                  placeholder="Buscar por N.º de compra, proveedor o CUIT"
                  aria-label="Buscar compras"
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
                {puedeCrear && (
                  <button
                    type="button"
                    className="boton-comercial-primario"
                    onClick={() => setModalAbierto(true)}
                  >
                    <IconPlus size={18} />
                    Nueva compra
                  </button>
                )}
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
              <div className="filtros-tabs-grupo">
                <button
                  type="button"
                  className={`filtro-destacado ${porRecibir ? 'activo' : ''}`}
                  onClick={() => cambiarEntrega('por_recibir')}
                  title="Compras registradas que todavía no repusieron stock."
                >
                  Por recibir
                </button>
                <button
                  type="button"
                  className={`filtro-destacado ${enCamino ? 'activo' : ''}`}
                  onClick={() => cambiarEntrega('EC')}
                  title="Compras que todavía están en camino y no movieron stock."
                >
                  En camino
                </button>
              </div>
            </section>

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
              Pago: Pendiente (sin pago total) · Parcial (pago parcial) · Pagada
              (pago total) · Anulada. Recepción: Por recibir, En camino o
              Recibida. El stock se mueve recién al recibir.
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
                      <th>Compra</th>
                      <th
                        aria-sort={
                          orden === 'fecha_compra'
                            ? 'ascending'
                            : orden === '-fecha_compra'
                              ? 'descending'
                              : 'none'
                        }
                      >
                        <button
                          type="button"
                          className="encabezado-orden"
                          onClick={() => alternarOrden('fecha_compra')}
                        >
                          Fecha {iconoOrden('fecha_compra')}
                        </button>
                      </th>
                      <th>Proveedor</th>
                      <th>Caja / Sección</th>
                      <th
                        className="numero"
                        aria-sort={
                          orden === 'monto_compra'
                            ? 'ascending'
                            : orden === '-monto_compra'
                              ? 'descending'
                              : 'none'
                        }
                      >
                        <button
                          type="button"
                          className="encabezado-orden"
                          onClick={() => alternarOrden('monto_compra')}
                        >
                          Monto {iconoOrden('monto_compra')}
                        </button>
                      </th>
                      <th>Pago</th>
                      <th>Recepción</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && !rangoInvalido && (
                      <tr>
                        <td colSpan="8" className="comercial-vacio">
                          Cargando compras…
                        </td>
                      </tr>
                    )}

                    {!cargando &&
                      !rangoInvalido &&
                      !error &&
                      datos.results.length === 0 && (
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
                            <strong>{formatearMoneda(compra.monto_compra)}</strong>
                          </td>
                          <td>
                            <span className={claseEstado(compra.estado)}>
                              {compra.estado_detalle}
                            </span>
                            {compra.estado !== 'AN' &&
                              saldoCompra(compra) > 0 && (
                                <small>
                                  Saldo {formatearMoneda(saldoCompra(compra))}
                                </small>
                              )}
                          </td>
                          <td>
                            <span className={claseEntrega(compra)}>
                              {etiquetaEntrega(compra)}
                            </span>
                            {compra.estado_entrega === 'EC' &&
                              compra.fecha_estimada_llegada && (
                                <small>
                                  Llega {formatearFecha(compra.fecha_estimada_llegada)}
                                </small>
                              )}
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
                              {compra.solicitud_pendiente && (
                                <span className="estado-badge estado-pe">
                                  Solicitud pendiente
                                </span>
                              )}
                              {!puedeGestionar &&
                                !compra.solicitud_pendiente &&
                                compra.estado !== 'AN' &&
                                saldoCompra(compra) > 0 && (
                                  <button
                                    type="button"
                                    className="boton-icono"
                                    onClick={() => solicitarPago(compra)}
                                    title="Solicitar el pago de la compra"
                                  >
                                    <IconClipboardList size={17} />
                                  </button>
                                )}
                              {!puedeGestionar &&
                                !compra.solicitud_pendiente &&
                                compra.estado !== 'AN' &&
                                !compra.recibida && (
                                  <button
                                    type="button"
                                    className="boton-icono"
                                    onClick={() =>
                                      solicitarAnulacion(compra)
                                    }
                                    title="Solicitar la anulación de la compra"
                                  >
                                    <IconBan size={17} />
                                  </button>
                                )}
                              {puedeGestionar &&
                                compra.estado !== 'AN' &&
                                !compra.solicitud_pendiente &&
                                saldoCompra(compra) > 0 && (
                                  <button
                                    type="button"
                                    className="boton-icono"
                                    onClick={() => abrirPago(compra)}
                                    title="Registrar pago"
                                  >
                                    <IconCash size={17} />
                                  </button>
                                )}
                              {puedeOperar &&
                                compra.estado !== 'AN' &&
                                !compra.recibida &&
                                compra.estado_entrega !== 'EC' && (
                                  <button
                                    type="button"
                                    className="boton-icono"
                                    onClick={() => marcarEnCamino(compra)}
                                    title="Marcar en camino"
                                  >
                                    <IconTruck size={17} />
                                  </button>
                                )}
                              {puedeOperar &&
                                compra.estado !== 'AN' &&
                                !compra.recibida && (
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
                    disabled={!datos.previous || actualizando}
                    onClick={() => irAPagina(pagina - 1)}
                  >
                    Anterior
                  </button>
                  <span>Página {pagina}</span>
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    disabled={!datos.next || actualizando}
                    onClick={() => irAPagina(pagina + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === 'solicitudes' && (
          <section className="comercial-panel">
            <div className="comercial-panel-cabecera">
              <h2>Solicitudes de pago y anulación</h2>
              <p className="comercial-nota">
                Las resuelve administración (AD/GE). Mientras hay una solicitud
                pendiente, la compra no se puede volver a solicitar, pagar ni
                anular.
              </p>
            </div>

            {cargandoSolicitudes ? (
              <p className="comercial-nota">Cargando solicitudes…</p>
            ) : solicitudes.length === 0 ? (
              <p className="comercial-nota">
                No hay solicitudes registradas.
              </p>
            ) : (
              <div className="comercial-tabla-scroll">
                <table className="tabla-comercial tabla-lineas">
                  <thead>
                    <tr>
                      <th>Solicitud</th>
                      <th>Compra</th>
                      <th>Tipo</th>
                      <th>Solicitante</th>
                      <th>Motivo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.map((solicitud) => (
                      <tr key={solicitud.id}>
                        <td>#{solicitud.id}</td>
                        <td>
                          <strong>#{solicitud.compra}</strong>
                          <small>
                            {solicitud.compra_detalle?.proveedor}
                          </small>
                        </td>
                        <td>{solicitud.tipo_detalle}</td>
                        <td>
                          {solicitud.solicitante_detalle?.nombre || '—'}
                        </td>
                        <td>{solicitud.motivo}</td>
                        <td>
                          <span className={claseEstado(solicitud.estado)}>
                            {solicitud.estado_detalle}
                          </span>
                          {solicitud.estado === 'PE' && (
                            <small>
                              {solicitud.dias_esperando} día
                              {solicitud.dias_esperando === 1 ? '' : 's'}{' '}
                              esperando
                            </small>
                          )}
                          {solicitud.estado === 'RS' && (
                            <small>
                              por {solicitud.resuelto_por_detalle?.nombre} ·{' '}
                              {formatearFechaHora(solicitud.fecha_resolucion)}
                            </small>
                          )}
                          {solicitud.estado === 'RJ' && (
                            <small>{solicitud.motivo_rechazo}</small>
                          )}
                        </td>
                        <td>
                          <div className="acciones-fila">
                            {solicitud.estado === 'PE' && puedeGestionar && (
                              <>
                                <button
                                  type="button"
                                  className="boton-icono"
                                  onClick={() =>
                                    abrirPagoSolicitud(solicitud)
                                  }
                                  disabled={resolviendo}
                                  title="Pagar la compra"
                                >
                                  <IconCash size={17} />
                                </button>
                                {solicitud.tipo === 'AN' && (
                                  <button
                                    type="button"
                                    className="boton-icono boton-icono-exito"
                                    onClick={() =>
                                      resolverSolicitud(
                                        solicitud,
                                        'ANULAR',
                                      )
                                    }
                                    disabled={resolviendo}
                                    title="Anular la compra"
                                  >
                                    <IconCheck size={17} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="boton-icono"
                                  onClick={() =>
                                    rechazarSolicitud(solicitud)
                                  }
                                  disabled={resolviendo}
                                  title="Rechazar la solicitud"
                                >
                                  <IconX size={17} />
                                </button>
                              </>
                            )}
                            {solicitud.estado === 'PE' && !puedeGestionar && (
                              <small>Esperando a AD/GE</small>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {modalAbierto && (
        <FormularioCompra
          key={sucursalActiva || 'todas'}
          sucursalActiva={sucursalActiva}
          puedeGestionar={puedeGestionar}
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
                <span>Pago</span>
                <span className={claseEstado(detalle.estado)}>
                  {detalle.estado_detalle}
                </span>
              </div>
              <div>
                <span>Recepción</span>
                <span className={claseEntrega(detalle)}>
                  {etiquetaEntrega(detalle)}
                </span>
              </div>
              {detalle.fecha_estimada_llegada && (
                <div>
                  <span>Llegada estimada</span>
                  <strong>
                    {formatearFecha(detalle.fecha_estimada_llegada)}
                  </strong>
                </div>
              )}
            </div>

            {detalle.estado === 'AN' && detalle.motivo_cancelacion && (
              <p className="comercial-nota">
                <strong>Motivo de anulación:</strong>{' '}
                {detalle.motivo_cancelacion}
              </p>
            )}

            {detalle.solicitud_pendiente && (
              <p className="comercial-nota">
                <strong>
                  Solicitud #{detalle.solicitud_pendiente.id} pendiente (
                  {detalle.solicitud_pendiente.tipo_detalle}).
                </strong>{' '}
                Hasta que administración la resuelva, la compra no se puede
                pagar ni anular.
              </p>
            )}

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

            {detalle.estado !== 'AN' && (
              <div className="comercial-total">
                <span>Saldo pendiente</span>
                <strong>{formatearMoneda(saldoCompra(detalle))}</strong>
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
              {puedeGestionar &&
                !detalle.recibida &&
                detalle.estado !== 'AN' &&
                !detalle.solicitud_pendiente &&
                totalPagado(detalle) === 0 && (
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    onClick={() => anularCompra(detalle)}
                  >
                    <IconBan size={18} />
                    Anular compra
                  </button>
                )}
              {puedeGestionar &&
                detalle.estado !== 'AN' &&
                !detalle.solicitud_pendiente &&
                saldoCompra(detalle) > 0 && (
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    onClick={() => {
                      const compra = detalle
                      setDetalle(null)
                      abrirPago(compra)
                    }}
                  >
                    <IconCash size={18} />
                    Registrar pago
                  </button>
                )}
              {!puedeGestionar &&
                !detalle.solicitud_pendiente &&
                detalle.estado !== 'AN' &&
                saldoCompra(detalle) > 0 && (
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    onClick={() => solicitarPago(detalle)}
                  >
                    <IconClipboardList size={18} />
                    Solicitar pago
                  </button>
                )}
              {!puedeGestionar &&
                !detalle.solicitud_pendiente &&
                detalle.estado !== 'AN' &&
                !detalle.recibida && (
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    onClick={() => solicitarAnulacion(detalle)}
                  >
                    <IconBan size={18} />
                    Solicitar anulación
                  </button>
                )}
              {puedeOperar &&
                detalle.estado !== 'AN' &&
                !detalle.recibida &&
                detalle.estado_entrega !== 'EC' && (
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    onClick={() => {
                      const compra = detalle
                      setDetalle(null)
                      marcarEnCamino(compra)
                    }}
                  >
                    <IconTruck size={18} />
                    Marcar en camino
                  </button>
                )}
              {puedeOperar &&
                detalle.estado !== 'AN' &&
                !detalle.recibida && (
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

      {pago && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal comercial-modal-medio">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconCash size={24} />
                {pagoSolicitud
                  ? `Resolver solicitud #${pagoSolicitud.id} · Compra #${pago.id}`
                  : `Registrar pago · Compra #${pago.id}`}
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={cerrarPago}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <p className="cobro-cliente">
              <IconTruckDelivery size={18} />
              {pago.proveedor_detalle || 'Sin proveedor'}
            </p>

            <div className="cobro-resumen">
              <div>
                <span>Total</span>
                <strong>{formatearMoneda(pago.monto_compra)}</strong>
              </div>
              <div>
                <span>Pagado</span>
                <strong>{formatearMoneda(totalPagado(pago))}</strong>
              </div>
              <div>
                <span>Saldo</span>
                <strong>{formatearMoneda(saldoPago)}</strong>
              </div>
            </div>

            <p className="cobro-nota">
              Podés combinar varios métodos de pago. La compra queda Pagada
              cuando los pagos cubren el total.
            </p>

            <div className="cobro-pagos-lista">
              {pagosPago.map((item, indice) => (
                <div className="cobro-pago-fila" key={item.id}>
                  <label className="campo-comercial">
                    <span>Método {indice + 1}</span>
                    <select
                      className={!item.metodo ? 'input-error' : ''}
                      value={item.metodo}
                      onChange={(evento) =>
                        actualizarPago(
                          item.id,
                          'metodo',
                          evento.target.value,
                        )
                      }
                    >
                      <option value="">Seleccioná un método</option>
                      {metodos.map((metodo) => (
                        <option key={metodo.id} value={metodo.id}>
                          {metodo.metodo_pago}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="campo-comercial">
                    <span>Monto</span>
                    <input
                      type="number"
                      className={
                        !(Number(item.monto) > 0) ? 'input-error' : ''
                      }
                      min="0.01"
                      step="0.01"
                      value={item.monto}
                      onChange={(evento) =>
                        actualizarPago(
                          item.id,
                          'monto',
                          evento.target.value,
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="boton-quitar-pago"
                    onClick={() => quitarPago(item.id)}
                    disabled={pagosPago.length === 1}
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
            {excedeSaldoPago && (
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
                <strong>{formatearMoneda(totalPago)}</strong>
              </div>
              <div>
                <span>Saldo después</span>
                <strong
                  className={
                    excedeSaldoPago
                      ? 'cobro-saldo-excedido'
                      : saldoPago - totalPago <= 0
                        ? 'cobro-saldo-cubierto'
                        : ''
                  }
                >
                  {formatearMoneda(Math.max(0, saldoPago - totalPago))}
                </strong>
              </div>
            </div>

            {excedeSaldoPago && (
              <p className="comercial-error">
                Los pagos superan el saldo de{' '}
                {formatearMoneda(saldoPago)}.
              </p>
            )}

            {metodos.length === 0 && (
              <p className="comercial-error">
                No hay métodos de pago activos. Configuralos antes de pagar.
              </p>
            )}

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={cerrarPago}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={registrarPago}
                disabled={
                  pagando ||
                  metodos.length === 0 ||
                  pagosIncompletos ||
                  excedeSaldoPago
                }
              >
                {pagando ? (
                  <>
                    <IconLoader2 className="icono-girando" size={18} />
                    Registrando…
                  </>
                ) : (
                  'Registrar pago'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
