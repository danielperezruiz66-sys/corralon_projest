import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconAdjustments,
  IconArrowsExchange,
  IconBox,
  IconBuildingWarehouse,
  IconDownload,
  IconEye,
  IconHistory,
  IconLoader2,
  IconPackage,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import CampoSelectorBuscable from '../components/common/CampoSelectorBuscable.jsx'
import FiltrosFecha from '../components/comercial/FiltrosFecha.jsx'
import FormularioAjusteStock from '../components/inventario/FormularioAjusteStock.jsx'
import FormularioCargaStock from '../components/inventario/FormularioCargaStock.jsx'
import FormularioCatalogo from '../components/inventario/FormularioCatalogo.jsx'
import FormularioDeposito from '../components/inventario/FormularioDeposito.jsx'
import FormularioProducto from '../components/inventario/FormularioProducto.jsx'
import FormularioStock from '../components/inventario/FormularioStock.jsx'
import FormularioTransferencia from '../components/inventario/FormularioTransferencia.jsx'
import { useAuth } from '../context/auth-context'
import { useSucursal } from '../context/sucursal-context'
import useDebounce from '../hooks/useDebounce'
import { cantidadCsv, descargarCsv, numeroCsv } from '../utils/csv'
import {
  formatearFechaHora,
  formatearMoneda,
  formatearNumero,
} from '../utils/formato'
import '../styles/Comercial.css'
import '../styles/Inventario.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

const TABS = [
  { id: 'productos', etiqueta: 'Productos', icono: IconPackage },
  { id: 'stock', etiqueta: 'Stock', icono: IconBox },
  { id: 'movimientos', etiqueta: 'Movimientos', icono: IconHistory },
  {
    id: 'transferencias',
    etiqueta: 'Transferencias',
    icono: IconArrowsExchange,
  },
  { id: 'depositos', etiqueta: 'Depósitos', icono: IconBuildingWarehouse },
  { id: 'catalogos', etiqueta: 'Catálogos', icono: IconTag },
]

const TIPOS_MOVIMIENTO = [
  { id: '', etiqueta: 'Todos' },
  { id: 'VE', etiqueta: 'Ventas' },
  { id: 'CA', etiqueta: 'Cancelaciones' },
  { id: 'CO', etiqueta: 'Compras' },
  { id: 'AJ', etiqueta: 'Ajustes' },
  { id: 'TR', etiqueta: 'Transferencias' },
]

function claseAlerta(alerta) {
  return `inventario-alerta ${String(alerta || '').toLowerCase()}`
}

export default function Inventario() {
  const { puedeEscribir } = useAuth()
  const { sucursalActiva } = useSucursal()
  const puedeProducto = puedeEscribir(['GE'])
  const puedeStock = puedeEscribir(['GE', 'ED'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'productos')
  const [texto, setTexto] = useState(() => searchParams.get('search') || '')
  const [pagina, setPagina] = useState(
    () => Number(searchParams.get('page')) || 1,
  )
  const [categoria, setCategoria] = useState('')
  const [marca, setMarca] = useState('')
  const [unidad, setUnidad] = useState('')
  const [alerta, setAlerta] = useState(
    () => searchParams.get('alerta') || '',
  )
  const [producto, setProducto] = useState(() => {
    const valor =
      searchParams.get('producto') ||
      searchParams.get('producto_id') ||
      ''
    return /^\d+$/.test(valor) ? valor : ''
  })
  const [tipo, setTipo] = useState('')
  const [estadoTransferencia, setEstadoTransferencia] = useState('')
  const [fechas, setFechas] = useState({
    fecha: '',
    desde: '',
    hasta: '',
  })
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [refresco, setRefresco] = useState(0)

  const [sucursales, setSucursales] = useState([])
  const [categorias, setCategorias] = useState([])
  const [marcas, setMarcas] = useState([])
  const [unidades, setUnidades] = useState([])
  const [depositos, setDepositos] = useState([])
  const [productoFiltrado, setProductoFiltrado] = useState(null)

  const [productoEditando, setProductoEditando] = useState(null)
  const [depositoEditando, setDepositoEditando] = useState(null)
  const [catalogoEditando, setCatalogoEditando] = useState(null)
  const [stockConfig, setStockConfig] = useState(null)
  const [stockAjuste, setStockAjuste] = useState(null)
  const [transferenciaAbierta, setTransferenciaAbierta] = useState(false)
  const [cargaStockAbierta, setCargaStockAbierta] = useState(false)
  const [productoTransferencia, setProductoTransferencia] = useState('')
  const [productoTransferenciaDetalle, setProductoTransferenciaDetalle] =
    useState(null)
  const [depositoTransferencia, setDepositoTransferencia] = useState('')
  const [transferenciaDestacada, setTransferenciaDestacada] = useState(null)
  const destacadoTimer = useRef(null)
  const [detalleProducto, setDetalleProducto] = useState(null)
  const [detalleProductoData, setDetalleProductoData] = useState(null)
  const [detalleStock, setDetalleStock] = useState(null)
  const [detalleStockData, setDetalleStockData] = useState(null)

  const busqueda = useDebounce(texto.trim(), 350)
  const buscando = texto.trim() !== busqueda || actualizando
  const rangoInvalido = Boolean(
    fechas.desde && fechas.hasta && fechas.desde > fechas.hasta,
  )
  const filtroScrolleado = useRef('')
  const nombreProductoFiltrado =
    productoFiltrado &&
    String(productoFiltrado.id) === String(producto)
      ? productoFiltrado.nombre
      : producto
        ? `Producto #${producto}`
        : ''

  useEffect(() => {
    let vigente = true
    Promise.all([
      pedirTodas('/sucursales/'),
      pedirTodas('/categorias/'),
      pedirTodas('/marcas/'),
      pedirTodas('/unidades/'),
      pedirTodas('/depositos/'),
    ])
      .then(([sucursalesData, categoriasData, marcasData, unidadesData, depositosData]) => {
        if (!vigente) {
          return
        }
        setSucursales(sucursalesData)
        setCategorias(categoriasData)
        setMarcas(marcasData)
        setUnidades(unidadesData)
        setDepositos(depositosData)
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
    if (!producto) {
      return undefined
    }
    let vigente = true
    pedir(`/productos/${producto}/`)
      .then((data) => {
        if (vigente) {
          setProductoFiltrado({
            id: Number(producto),
            nombre: data.nombre,
          })
        }
      })
      .catch(() => {
        if (vigente) {
          setProductoFiltrado(null)
        }
      })
    return () => {
      vigente = false
    }
  }, [producto])

  useEffect(() => {
    const parametros = new URLSearchParams()
    if (tab !== 'productos') {
      parametros.set('tab', tab)
    }
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (tab === 'stock') {
      if (alerta) {
        parametros.set('alerta', alerta)
      }
      if (producto) {
        parametros.set('producto', String(producto))
      }
    }
    if (pagina > 1) {
      parametros.set('page', String(pagina))
    }
    setSearchParams(parametros, { replace: true })
  }, [tab, busqueda, pagina, alerta, producto, setSearchParams])

  useEffect(() => {
    if (tab === 'catalogos') {
      return undefined
    }
    if (tab === 'movimientos' && rangoInvalido) {
      return undefined
    }

    let vigente = true
    const controlador = new AbortController()
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }
    if (sucursalActiva) {
      parametros.set('sucursal', sucursalActiva)
    }

    let ruta = '/productos/'
    if (tab === 'productos') {
      if (categoria) parametros.set('categoria', categoria)
      if (marca) parametros.set('marca', marca)
      if (unidad) parametros.set('unidad', unidad)
    } else if (tab === 'stock') {
      ruta = '/stocks/'
      if (alerta) parametros.set('alerta', alerta)
      if (producto) parametros.set('producto', producto)
    } else if (tab === 'movimientos') {
      ruta = '/movimientos-stock/'
      if (tipo) parametros.set('tipo', tipo)
      if (fechas.fecha) parametros.set('fecha', fechas.fecha)
      if (fechas.desde) parametros.set('fecha_desde', fechas.desde)
      if (fechas.hasta) parametros.set('fecha_hasta', fechas.hasta)
    } else if (tab === 'transferencias') {
      ruta = '/transferencias-stock/'
      if (estadoTransferencia) {
        parametros.set('estado', estadoTransferencia)
      }
    } else if (tab === 'depositos') {
      ruta = '/depositos/'
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
  }, [
    tab,
    pagina,
    busqueda,
    sucursalActiva,
    categoria,
    marca,
    unidad,
    alerta,
    producto,
    tipo,
    estadoTransferencia,
    fechas,
    refresco,
    rangoInvalido,
  ])

  useEffect(() => {
    if (
      tab !== 'stock' ||
      cargando ||
      actualizando ||
      (!alerta && !producto)
    ) {
      return undefined
    }

    const clave = `${alerta}|${producto}`
    if (filtroScrolleado.current === clave) {
      return undefined
    }

    const fila = producto
      ? document.querySelector(`[data-stock-producto="${producto}"]`)
      : null
    const destino = fila || document.getElementById('inventario-panel')
    if (!destino) {
      return undefined
    }

    filtroScrolleado.current = clave
    destino.scrollIntoView({
      behavior: 'smooth',
      block: producto ? 'center' : 'start',
    })
  }, [tab, alerta, producto, cargando, actualizando, datos])

  useEffect(() => {
    return () => {
      if (destacadoTimer.current) {
        window.clearTimeout(destacadoTimer.current)
      }
    }
  }, [])

  function cambiarTab(nuevoTab) {
    setTab(nuevoTab)
    setPagina(1)
    setTexto('')
    setCategoria('')
    setMarca('')
    setUnidad('')
    setAlerta('')
    setProducto('')
    filtroScrolleado.current = ''
    setTipo('')
    setEstadoTransferencia('')
    setFechas({ fecha: '', desde: '', hasta: '' })
    setError('')
    setCargando(true)
  }

  function limpiarTexto() {
    setTexto('')
    setPagina(1)
    setError('')
  }

  function cambiarFiltro(setter, valor) {
    setter(valor)
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function cambiarAlerta(valor) {
    setAlerta(valor)
    setProducto('')
    filtroScrolleado.current = ''
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function limpiarFiltrosStock() {
    setAlerta('')
    setProducto('')
    filtroScrolleado.current = ''
    setPagina(1)
    setError('')
    setActualizando(true)
  }

  function cambiarFechas(nuevas) {
    setFechas(nuevas)
    setPagina(1)
    setError('')
  }

  function irAPagina(nueva) {
    setPagina(nueva)
    setError('')
    setActualizando(true)
  }

  function refrescarListado() {
    setRefresco((valor) => valor + 1)
    setActualizando(true)
  }

  function destacarTransferencia(id) {
    if (!id) {
      return
    }
    setTransferenciaDestacada(Number(id))
    if (destacadoTimer.current) {
      window.clearTimeout(destacadoTimer.current)
    }
    destacadoTimer.current = window.setTimeout(() => {
      setTransferenciaDestacada(null)
    }, 3000)
  }

  function guardadoProducto(_, esEdicion) {
    Swal.fire({
      icon: 'success',
      title: esEdicion ? 'Producto actualizado' : 'Producto creado',
      timer: 1500,
      showConfirmButton: false,
    })
    setProductoEditando(null)
    refrescarListado()
  }

  function catalogoCreado(tipo, item) {
    if (tipo === 'categorias') {
      setCategorias((previos) => [...previos, item])
    } else if (tipo === 'marcas') {
      setMarcas((previos) => [...previos, item])
    } else if (tipo === 'unidades') {
      setUnidades((previos) => [...previos, item])
    }
  }

  function guardadoDeposito(_, esEdicion) {
    Swal.fire({
      icon: 'success',
      title: esEdicion ? 'Depósito actualizado' : 'Depósito creado',
      timer: 1500,
      showConfirmButton: false,
    })
    setDepositoEditando(null)
    pedirTodas('/depositos/')
      .then(setDepositos)
      .catch(() => {})
    refrescarListado()
  }

  async function guardadoCatalogo() {
    setCatalogoEditando(null)
    try {
      const [categoriasData, marcasData, unidadesData] = await Promise.all([
        pedirTodas('/categorias/'),
        pedirTodas('/marcas/'),
        pedirTodas('/unidades/'),
      ])
      setCategorias(categoriasData)
      setMarcas(marcasData)
      setUnidades(unidadesData)
    } catch (e) {
      setError(e.message)
    }
  }

  async function eliminarCatalogo(tipoCatalogo, item) {
    const config = {
      categorias: { ruta: '/categorias/', campo: 'categorias' },
      marcas: { ruta: '/marcas/', campo: 'marcas' },
      unidades: { ruta: '/unidades/', campo: 'unidades' },
    }[tipoCatalogo]
    const resultado = await Swal.fire({
      title: '¿Eliminar?',
      text: item[config.campo],
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) {
      return
    }
    try {
      await pedir(`${config.ruta}${item.id}/`, { method: 'DELETE' })
      await guardadoCatalogo()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function eliminarDeposito(item) {
    const resultado = await Swal.fire({
      title: `¿Eliminar ${item.nombre}?`,
      text: 'Solo se puede eliminar si no tiene stock asociado.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) {
      return
    }
    try {
      await pedir(`/depositos/${item.id}/`, { method: 'DELETE' })
      setDepositos((actuales) =>
        actuales.filter((deposito) => deposito.id !== item.id),
      )
      refrescarListado()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function abrirDetalleProducto(producto) {
    setDetalleProducto(producto)
    setDetalleProductoData({ cargando: true, stock: [], costos: [], movimientos: [] })
    try {
      const [stock, costos, movimientos] = await Promise.all([
        pedirTodas(`/stocks/?producto=${producto.id}`),
        pedirTodas(`/productos-proveedores/?producto=${producto.id}`),
        pedir(`/movimientos-stock/?producto=${producto.id}&page=1`),
      ])
      setDetalleProductoData({
        cargando: false,
        stock,
        costos,
        movimientos: movimientos.results || [],
      })
    } catch (e) {
      setDetalleProductoData({
        cargando: false,
        stock: [],
        costos: [],
        movimientos: [],
        error: e.message,
      })
    }
  }

  async function abrirDetalleStock(stock) {
    setDetalleStock(stock)
    setDetalleStockData({ cargando: true, lotes: [], movimientos: [] })
    try {
      const [lotes, movimientos] = await Promise.all([
        pedirTodas(`/detalles-stock/?stock=${stock.id}`),
        pedir(`/movimientos-stock/?stock=${stock.id}&page=1`),
      ])
      setDetalleStockData({
        cargando: false,
        lotes,
        movimientos: movimientos.results || [],
      })
    } catch (e) {
      setDetalleStockData({
        cargando: false,
        lotes: [],
        movimientos: [],
        error: e.message,
      })
    }
  }

  function guardadoStock() {
    setStockConfig(null)
    setStockAjuste(null)
    Swal.fire({
      icon: 'success',
      title: 'Stock actualizado',
      timer: 1500,
      showConfirmButton: false,
    })
    refrescarListado()
  }

  function guardadoCargaStock() {
    setCargaStockAbierta(false)
    setTab('stock')
    setPagina(1)
    Swal.fire({
      icon: 'success',
      title: 'Stock cargado',
      text: 'Las cantidades se sumaron al stock de la sucursal.',
      timer: 1800,
      showConfirmButton: false,
    })
    refrescarListado()
  }

  function abrirTransferencia(producto = '', deposito = '', detalle = null) {
    setProductoTransferencia(producto ? String(producto) : '')
    setProductoTransferenciaDetalle(detalle)
    setDepositoTransferencia(deposito ? String(deposito) : '')
    setTransferenciaAbierta(true)
  }

  function guardadoTransferencia(creada) {
    setTransferenciaAbierta(false)
    setTab('transferencias')
    setEstadoTransferencia('ET')
    setPagina(1)
    setTexto('')
    setError('')
    setCargando(true)
    setActualizando(true)
    destacarTransferencia(creada?.id)
    Swal.fire({
      icon: 'success',
      title: 'Transferencia creada',
      text: 'Quedó en tránsito hasta que se confirme la recepción.',
      timer: 1800,
      showConfirmButton: false,
    })
    refrescarListado()
  }

  async function recibirTransferencia(transferencia) {
    const resultado = await Swal.fire({
      title: '¿Confirmar recepción?',
      text: 'El stock ingresará en el depósito de destino.',
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
      const actualizada = await pedir(
        `/transferencias-stock/${transferencia.id}/recibir/`,
        {
          method: 'POST',
        },
      )
      if (estadoTransferencia === 'ET') {
        setEstadoTransferencia(actualizada.estado)
        setPagina(1)
      }
      destacarTransferencia(actualizada.id)
      Swal.fire({
        icon: 'success',
        title: 'Transferencia recibida',
        timer: 1500,
        showConfirmButton: false,
      })
      refrescarListado()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo recibir',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function cancelarTransferencia(transferencia) {
    const resultado = await Swal.fire({
      title: '¿Cancelar transferencia?',
      text: 'El stock volverá al depósito de origen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
    })
    if (!resultado.isConfirmed) {
      return
    }
    try {
      const actualizada = await pedir(
        `/transferencias-stock/${transferencia.id}/cancelar/`,
        {
          method: 'POST',
        },
      )
      if (estadoTransferencia === 'ET') {
        setEstadoTransferencia(actualizada.estado)
        setPagina(1)
      }
      destacarTransferencia(actualizada.id)
      Swal.fire({
        icon: 'success',
        title: 'Transferencia cancelada',
        timer: 1500,
        showConfirmButton: false,
      })
      refrescarListado()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cancelar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  async function exportar() {
    setExportando(true)
    try {
      const parametros = new URLSearchParams()
      if (busqueda) parametros.set('search', busqueda)
      if (sucursalActiva) parametros.set('sucursal', sucursalActiva)

      let encabezados = []
      let filas = []

      if (tab === 'productos') {
        if (categoria) parametros.set('categoria', categoria)
        if (marca) parametros.set('marca', marca)
        if (unidad) parametros.set('unidad', unidad)
        const todos = await pedirTodas(`/productos/?${parametros}`)
        encabezados = [
          'Código',
          'Producto',
          'Categoría',
          'Marca',
          'Unidad',
          'Precio venta',
          'Costo máximo',
          'Margen',
          'Sucursales',
          'Descripción',
        ]
        filas = todos.map((item) => [
          item.codigo,
          item.nombre,
          item.categoria_detalle,
          item.marca_detalle,
          item.unidad_detalle,
          numeroCsv(item.precio_unidad),
          item.costo_max ? numeroCsv(item.costo_max) : '',
          item.margen ? numeroCsv(item.margen) : '',
          (item.sucursales_detalle || []).join(' / '),
          item.descripcion || '',
        ])
      } else if (tab === 'stock') {
        if (alerta) parametros.set('alerta', alerta)
        const todos = await pedirTodas(`/stocks/?${parametros}`)
        encabezados = [
          'Producto',
          'Sucursal',
          'Cantidad',
          'Mínimo',
          'Negativo máximo',
          'Alerta',
        ]
        filas = todos.map((item) => [
          item.producto_detalle,
          item.sucursal_detalle,
          cantidadCsv(item.cantidad),
          cantidadCsv(item.cant_min),
          cantidadCsv(item.cant_negativa_max),
          item.alerta,
        ])
      } else if (tab === 'movimientos') {
        if (tipo) parametros.set('tipo', tipo)
        if (fechas.fecha) parametros.set('fecha', fechas.fecha)
        if (fechas.desde) parametros.set('fecha_desde', fechas.desde)
        if (fechas.hasta) parametros.set('fecha_hasta', fechas.hasta)
        const todos = await pedirTodas(`/movimientos-stock/?${parametros}`)
        encabezados = ['Fecha', 'Producto', 'Depósito', 'Tipo', 'Cantidad', 'Referencia']
        filas = todos.map((item) => [
          formatearFechaHora(item.fecha),
          item.stock_detalle,
          item.detalle_stock_detalle || '',
          item.tipo_detalle,
          cantidadCsv(item.cantidad),
          item.referencia || '',
        ])
      } else if (tab === 'transferencias') {
        if (estadoTransferencia) {
          parametros.set('estado', estadoTransferencia)
        }
        const todos = await pedirTodas(`/transferencias-stock/?${parametros}`)
        encabezados = [
          'Producto',
          'Depósito origen',
          'Sucursal origen',
          'Depósito destino',
          'Sucursal destino',
          'Cantidad',
          'Lote',
          'Estado',
          'Fecha',
          'Motivo',
        ]
        filas = todos.map((item) => [
          item.producto_detalle,
          item.deposito_origen_detalle,
          item.sucursal_origen_detalle,
          item.deposito_destino_detalle,
          item.sucursal_destino_detalle,
          cantidadCsv(item.cantidad),
          item.lote || '',
          item.estado_detalle,
          formatearFechaHora(item.fecha_creacion),
          item.motivo || '',
        ])
      } else if (tab === 'depositos') {
        const todos = await pedirTodas(`/depositos/?${parametros}`)
        encabezados = ['Depósito', 'Sucursal', 'Predeterminado', 'Descripción']
        filas = todos.map((item) => [
          item.nombre,
          item.sucursal_detalle || '',
          item.es_predeterminado ? 'Sí' : 'No',
          item.descripcion || '',
        ])
      }

      if (filas.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No hay datos para exportar con los filtros actuales.',
          confirmButtonColor: '#4a9da8',
        })
        return
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

  const mostrarBotonExportar = tab !== 'catalogos'
  const mostrarNuevoProducto = tab === 'productos' && puedeProducto
  const mostrarNuevoDeposito = tab === 'depositos' && puedeStock
  const mostrarNuevaTransferencia =
    tab === 'transferencias' && puedeStock
  const mostrarCargaStock = tab === 'stock' && puedeStock

  return (
    <>
      <Encabezado
        titulo="Inventario"
        subtitulo="Productos, stock, movimientos y depósitos"
      />

      <div className="comercial inventario">
        {tab !== 'catalogos' && (
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
                placeholder="Buscar producto, código, categoría o marca"
                aria-label="Buscar en inventario"
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
              {mostrarBotonExportar && (
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={exportar}
                  disabled={
                    exportando || (tab === 'movimientos' && rangoInvalido)
                  }
                >
                  <IconDownload size={18} />
                  {exportando ? 'Exportando…' : 'Exportar CSV'}
                </button>
              )}
              {mostrarCargaStock && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => setCargaStockAbierta(true)}
                >
                  <IconBox size={18} />
                  Cargar stock
                </button>
              )}
              {mostrarNuevoProducto && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => setProductoEditando({})}
                >
                  <IconPlus size={18} />
                  Nuevo producto
                </button>
              )}
              {mostrarNuevoDeposito && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => setDepositoEditando({})}
                >
                  <IconPlus size={18} />
                  Nuevo depósito
                </button>
              )}
              {mostrarNuevaTransferencia && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => abrirTransferencia()}
                >
                  <IconPlus size={18} />
                  Nueva transferencia
                </button>
              )}
            </div>
          </section>
        )}

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

        {tab === 'productos' && (
          <section className="inventario-filtros">
            <CampoSelectorBuscable
              etiqueta="Categoría"
              valor={categoria}
              onCambiar={(valor) => cambiarFiltro(setCategoria, valor)}
              opciones={categorias}
              textoOpcion={(item) => item.categorias}
              placeholder="Todas"
            />
            <CampoSelectorBuscable
              etiqueta="Marca"
              valor={marca}
              onCambiar={(valor) => cambiarFiltro(setMarca, valor)}
              opciones={marcas}
              textoOpcion={(item) => item.marcas}
              placeholder="Todas"
            />
            <CampoSelectorBuscable
              etiqueta="Unidad"
              valor={unidad}
              onCambiar={(valor) => cambiarFiltro(setUnidad, valor)}
              opciones={unidades}
              textoOpcion={(item) => item.unidades}
              placeholder="Todas"
            />
          </section>
        )}

        {tab === 'stock' && (
          <section className="inventario-filtros">
            <label className="campo-comercial">
              <span>Alerta</span>
              <select
                value={alerta}
                onChange={(evento) => cambiarAlerta(evento.target.value)}
              >
                <option value="">Todas</option>
                <option value="ok">OK</option>
                <option value="minimo">Mínimo</option>
                <option value="negativo">Negativo</option>
              </select>
            </label>
          </section>
        )}

        {tab === 'stock' && (alerta || producto) && (
          <div className="filtro-origen">
            <span>
              Filtro del dashboard:{' '}
              <strong>
                {alerta === 'negativo'
                  ? 'stock negativo'
                  : alerta === 'minimo'
                    ? 'bajo el mínimo'
                    : 'stock'}
              </strong>
              {producto && (
                <>
                  {' '}
                  · Producto: <strong>{nombreProductoFiltrado}</strong>
                </>
              )}
            </span>
            <button type="button" onClick={limpiarFiltrosStock}>
              <IconX size={15} />
              Quitar filtro
            </button>
          </div>
        )}

        {tab === 'movimientos' && (
          <>
            <section className="inventario-filtros">
              <label className="campo-comercial">
                <span>Tipo</span>
                <select
                  value={tipo}
                  onChange={(evento) =>
                    cambiarFiltro(setTipo, evento.target.value)
                  }
                >
                  {TIPOS_MOVIMIENTO.map((item) => (
                    <option key={item.id || 'todos'} value={item.id}>
                      {item.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
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
          </>
        )}

        {tab === 'transferencias' && (
          <section className="inventario-filtros">
            <label className="campo-comercial">
              <span>Estado</span>
              <select
                value={estadoTransferencia}
                onChange={(evento) =>
                  cambiarFiltro(setEstadoTransferencia, evento.target.value)
                }
              >
                <option value="">Todos</option>
                <option value="ET">En tránsito</option>
                <option value="RE">Recibidas</option>
                <option value="CA">Canceladas</option>
              </select>
            </label>
          </section>
        )}

        {error && <p className="comercial-error">{error}</p>}

        {tab !== 'catalogos' && (
          <section
            id="inventario-panel"
            className={`comercial-panel ${
              actualizando ? 'panel-actualizando' : ''
            }`}
          >
            <div className="comercial-tabla-scroll">
              {tab === 'productos' && (
                <table className="tabla-comercial">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Marca</th>
                      <th>Unidad</th>
                      <th className="numero">Precio</th>
                      <th className="numero">Costo</th>
                      <th className="numero">Margen</th>
                      <th>Sucursales</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && (
                      <tr>
                        <td colSpan="10" className="comercial-vacio">
                          Cargando productos…
                        </td>
                      </tr>
                    )}
                    {!cargando && datos.results.length === 0 && (
                      <tr>
                        <td colSpan="10" className="comercial-vacio">
                          No se encontraron productos.
                        </td>
                      </tr>
                    )}
                    {datos.results.map((item) => (
                      <tr key={item.id}>
                        <td className="mono">{item.codigo}</td>
                        <td>
                          <strong>{item.nombre}</strong>
                        </td>
                        <td>{item.categoria_detalle}</td>
                        <td>{item.marca_detalle}</td>
                        <td>{item.unidad_detalle}</td>
                        <td className="numero">
                          {formatearMoneda(item.precio_unidad)}
                        </td>
                        <td className="numero">
                          {item.costo_max
                            ? formatearMoneda(item.costo_max)
                            : '—'}
                        </td>
                        <td className="numero">
                          {item.margen ? formatearMoneda(item.margen) : '—'}
                        </td>
                        <td className="texto-chico">
                          {(item.sucursales_detalle || []).join(' / ') || '—'}
                        </td>
                        <td>
                          <div className="acciones-fila">
                            <button
                              type="button"
                              className="boton-icono"
                              onClick={() => abrirDetalleProducto(item)}
                              title="Ver ficha"
                            >
                              <IconEye size={17} />
                            </button>
                            {puedeProducto && (
                              <button
                                type="button"
                                className="boton-icono"
                                onClick={() => setProductoEditando(item)}
                                title="Editar producto"
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
              )}

              {tab === 'stock' && (
                <table className="tabla-comercial">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Sucursal</th>
                      <th className="numero">Cantidad</th>
                      <th className="numero">Mínimo</th>
                      <th className="numero">Negativo máx.</th>
                      <th>Alerta</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && (
                      <tr>
                        <td colSpan="7" className="comercial-vacio">
                          Cargando stock…
                        </td>
                      </tr>
                    )}
                    {!cargando && datos.results.length === 0 && (
                      <tr>
                        <td colSpan="7" className="comercial-vacio">
                          No se encontraron registros de stock.
                        </td>
                      </tr>
                    )}
                    {datos.results.map((item) => (
                      <tr
                        key={item.id}
                        data-stock-producto={item.producto_id}
                        className={
                          producto &&
                          String(item.producto_id) === String(producto)
                            ? 'fila-destacada'
                            : undefined
                        }
                      >
                        <td>
                          <strong>{item.producto_detalle}</strong>
                        </td>
                        <td>{item.sucursal_detalle}</td>
                        <td className="numero">
                          {formatearNumero(item.cantidad)}
                        </td>
                        <td className="numero">
                          {formatearNumero(item.cant_min)}
                        </td>
                        <td className="numero">
                          {formatearNumero(item.cant_negativa_max)}
                        </td>
                        <td>
                          <span className={claseAlerta(item.alerta)}>
                            {item.alerta}
                          </span>
                        </td>
                        <td>
                          <div className="acciones-fila">
                            <button
                              type="button"
                              className="boton-icono"
                              onClick={() => abrirDetalleStock(item)}
                              title="Ver lotes y movimientos"
                            >
                              <IconEye size={17} />
                            </button>
                            {puedeStock && (
                              <button
                                type="button"
                                className="boton-icono"
                                onClick={() => setStockConfig(item)}
                                title="Configurar mínimo"
                              >
                                <IconAdjustments size={17} />
                              </button>
                            )}
                            {puedeStock && (
                              <button
                                type="button"
                                className="boton-icono boton-icono-exito"
                                onClick={() => setStockAjuste(item)}
                                title="Ajustar stock"
                              >
                                <IconBox size={17} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'movimientos' && (
                <table className="tabla-comercial">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Depósito</th>
                      <th>Tipo</th>
                      <th className="numero">Cantidad</th>
                      <th>Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && (
                      <tr>
                        <td colSpan="6" className="comercial-vacio">
                          Cargando movimientos…
                        </td>
                      </tr>
                    )}
                    {!cargando && datos.results.length === 0 && (
                      <tr>
                        <td colSpan="6" className="comercial-vacio">
                          No se encontraron movimientos.
                        </td>
                      </tr>
                    )}
                    {datos.results.map((item) => (
                      <tr key={item.id}>
                        <td>{formatearFechaHora(item.fecha)}</td>
                        <td>
                          <strong>{item.stock_detalle}</strong>
                        </td>
                        <td>{item.detalle_stock_detalle || '—'}</td>
                        <td>{item.tipo_detalle}</td>
                        <td
                          className={`numero ${
                            Number(item.cantidad) < 0
                              ? 'inventario-negativo'
                              : 'inventario-positivo'
                          }`}
                        >
                          {Number(item.cantidad) > 0 ? '+' : ''}
                          {formatearNumero(item.cantidad)}
                        </td>
                        <td className="texto-chico">
                          {item.referencia || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'transferencias' && (
                <table className="tabla-comercial">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Origen</th>
                      <th>Destino</th>
                      <th className="numero">Cantidad</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && (
                      <tr>
                        <td colSpan="7" className="comercial-vacio">
                          Cargando transferencias…
                        </td>
                      </tr>
                    )}
                    {!cargando && datos.results.length === 0 && (
                      <tr>
                        <td colSpan="7" className="comercial-vacio">
                          No se encontraron transferencias.
                        </td>
                      </tr>
                    )}
                    {datos.results.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          transferenciaDestacada === item.id
                            ? 'fila-destacada'
                            : undefined
                        }
                      >
                        <td>
                          <strong>{item.producto_detalle}</strong>
                          {item.lote && <small>Lote {item.lote}</small>}
                        </td>
                        <td>
                          {item.deposito_origen_detalle}
                          <small>{item.sucursal_origen_detalle}</small>
                        </td>
                        <td>
                          {item.deposito_destino_detalle}
                          <small>{item.sucursal_destino_detalle}</small>
                        </td>
                        <td className="numero">
                          {formatearNumero(item.cantidad)}
                        </td>
                        <td>
                          <span
                            className={`inventario-alerta ${
                              item.estado === 'RE'
                                ? 'ok'
                                : item.estado === 'ET'
                                  ? 'minimo'
                                  : 'negativo'
                            }`}
                          >
                            {item.estado_detalle}
                          </span>
                        </td>
                        <td>{formatearFechaHora(item.fecha_creacion)}</td>
                        <td>
                          {puedeStock && item.estado === 'ET' && (
                            <div className="acciones-fila">
                              <button
                                type="button"
                                className="boton-icono boton-icono-exito"
                                onClick={() => recibirTransferencia(item)}
                                title="Confirmar recepción"
                              >
                                <IconBox size={17} />
                              </button>
                              <button
                                type="button"
                                className="boton-icono boton-icono-peligro"
                                onClick={() => cancelarTransferencia(item)}
                                title="Cancelar transferencia"
                              >
                                <IconTrash size={17} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'depositos' && (
                <table className="tabla-comercial">
                  <thead>
                    <tr>
                      <th>Depósito</th>
                      <th>Sucursal</th>
                      <th>Predeterminado</th>
                      <th>Descripción</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && (
                      <tr>
                        <td colSpan="5" className="comercial-vacio">
                          Cargando depósitos…
                        </td>
                      </tr>
                    )}
                    {!cargando && datos.results.length === 0 && (
                      <tr>
                        <td colSpan="5" className="comercial-vacio">
                          No se encontraron depósitos.
                        </td>
                      </tr>
                    )}
                    {datos.results.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.nombre}</strong>
                        </td>
                        <td>{item.sucursal_detalle || '—'}</td>
                        <td>
                          {item.es_predeterminado ? (
                            <span className="inventario-alerta ok">
                              Predeterminado
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{item.descripcion || '—'}</td>
                        <td>
                          <div className="acciones-fila">
                            {puedeStock && (
                              <button
                                type="button"
                                className="boton-icono"
                                onClick={() => setDepositoEditando(item)}
                                title="Editar depósito"
                              >
                                <IconPencil size={17} />
                              </button>
                            )}
                            {puedeStock && (
                              <button
                                type="button"
                                className="boton-icono boton-icono-peligro"
                                onClick={() => eliminarDeposito(item)}
                                title="Eliminar depósito"
                              >
                                <IconTrash size={17} />
                              </button>
                            )}
                          </div>
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
        )}

        {tab === 'catalogos' && (
          <div className="inventario-catalogos">
            <PanelCatalogo
              titulo="Categorías"
              tipo="categorias"
              campo="categorias"
              items={categorias}
              puedeEditar={puedeProducto}
              onNuevo={() => setCatalogoEditando({ tipo: 'categorias', item: null })}
              onEditar={(item) =>
                setCatalogoEditando({ tipo: 'categorias', item })
              }
              onEliminar={(item) => eliminarCatalogo('categorias', item)}
            />
            <PanelCatalogo
              titulo="Marcas"
              tipo="marcas"
              campo="marcas"
              items={marcas}
              puedeEditar={puedeProducto}
              onNuevo={() => setCatalogoEditando({ tipo: 'marcas', item: null })}
              onEditar={(item) =>
                setCatalogoEditando({ tipo: 'marcas', item })
              }
              onEliminar={(item) => eliminarCatalogo('marcas', item)}
            />
            <PanelCatalogo
              titulo="Unidades"
              tipo="unidades"
              campo="unidades"
              items={unidades}
              puedeEditar={puedeProducto}
              onNuevo={() => setCatalogoEditando({ tipo: 'unidades', item: null })}
              onEditar={(item) =>
                setCatalogoEditando({ tipo: 'unidades', item })
              }
              onEliminar={(item) => eliminarCatalogo('unidades', item)}
            />
          </div>
        )}
      </div>

      {productoEditando !== null && (
        <FormularioProducto
          key={sucursalActiva || 'todas'}
          producto={productoEditando}
          categorias={categorias}
          marcas={marcas}
          unidades={unidades}
          sucursales={sucursales}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setProductoEditando(null)}
          onGuardado={guardadoProducto}
          onCatalogoCreado={catalogoCreado}
        />
      )}

      {depositoEditando !== null && (
        <FormularioDeposito
          key={sucursalActiva || 'todas'}
          deposito={depositoEditando}
          sucursales={sucursales}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setDepositoEditando(null)}
          onGuardado={guardadoDeposito}
        />
      )}

      {catalogoEditando && (
        <FormularioCatalogo
          tipo={catalogoEditando.tipo}
          item={catalogoEditando.item}
          onCerrar={() => setCatalogoEditando(null)}
          onGuardado={guardadoCatalogo}
        />
      )}

      {stockConfig && (
        <FormularioStock
          stock={stockConfig}
          onCerrar={() => setStockConfig(null)}
          onGuardado={guardadoStock}
        />
      )}

      {stockAjuste && (
        <FormularioAjusteStock
          stock={stockAjuste}
          depositos={depositos.filter(
            (item) => Number(item.sucursal) === Number(stockAjuste.sucursal),
          )}
          onCerrar={() => setStockAjuste(null)}
          onGuardado={guardadoStock}
        />
      )}

      {transferenciaAbierta && (
        <FormularioTransferencia
          depositos={depositos}
          productoInicial={productoTransferencia}
          productoInicialDetalle={productoTransferenciaDetalle}
          depositoOrigenInicial={depositoTransferencia}
          onCerrar={() => setTransferenciaAbierta(false)}
          onGuardado={guardadoTransferencia}
        />
      )}

      {cargaStockAbierta && (
        <FormularioCargaStock
          sucursales={sucursales}
          depositos={depositos}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setCargaStockAbierta(false)}
          onGuardado={guardadoCargaStock}
        />
      )}

      {detalleProducto && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal inventario-modal-ancho">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconPackage size={24} />
                {detalleProducto.codigo} · {detalleProducto.nombre}
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={() => setDetalleProducto(null)}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="detalle-cabecera">
              <div>
                <span>Categoría</span>
                <strong>{detalleProducto.categoria_detalle}</strong>
              </div>
              <div>
                <span>Marca</span>
                <strong>{detalleProducto.marca_detalle}</strong>
              </div>
              <div>
                <span>Unidad</span>
                <strong>{detalleProducto.unidad_detalle}</strong>
              </div>
              <div>
                <span>Precio de venta</span>
                <strong>{formatearMoneda(detalleProducto.precio_unidad)}</strong>
              </div>
              <div>
                <span>Costo máximo</span>
                <strong>
                  {detalleProducto.costo_max
                    ? formatearMoneda(detalleProducto.costo_max)
                    : '—'}
                </strong>
              </div>
              <div>
                <span>Margen</span>
                <strong>
                  {detalleProducto.margen
                    ? formatearMoneda(detalleProducto.margen)
                    : '—'}
                </strong>
              </div>
            </div>

            {detalleProducto.descripcion && (
              <p className="comercial-nota">{detalleProducto.descripcion}</p>
            )}

            {detalleProductoData?.cargando ? (
              <p className="comercial-nota">
                <IconLoader2 className="icono-girando" size={18} /> Cargando
                stock, costos y movimientos…
              </p>
            ) : (
              <>
                <h3 className="inventario-subtitulo">Stock por sucursal</h3>
                <div className="comercial-tabla-scroll">
                  <table className="tabla-comercial tabla-lineas">
                    <thead>
                      <tr>
                        <th>Sucursal</th>
                        <th className="numero">Cantidad</th>
                        <th className="numero">Mínimo</th>
                        <th>Alerta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleProductoData?.stock || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.sucursal_detalle}</td>
                          <td className="numero">
                            {formatearNumero(item.cantidad)}
                          </td>
                          <td className="numero">
                            {formatearNumero(item.cant_min)}
                          </td>
                          <td>
                            <span className={claseAlerta(item.alerta)}>
                              {item.alerta}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(detalleProductoData?.stock || []).length === 0 && (
                        <tr>
                          <td colSpan="4" className="comercial-vacio">
                            Sin registros de stock.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="inventario-subtitulo">Costos por proveedor</h3>
                <div className="comercial-tabla-scroll">
                  <table className="tabla-comercial tabla-lineas">
                    <thead>
                      <tr>
                        <th>Proveedor</th>
                        <th>Código proveedor</th>
                        <th className="numero">Costo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleProductoData?.costos || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.proveedor_detalle}</td>
                          <td>{item.codigo_producto_proveedor || '—'}</td>
                          <td className="numero">
                            {formatearMoneda(item.precio_lista)}
                          </td>
                          <td>{item.estado ? 'Activo' : 'Inactivo'}</td>
                        </tr>
                      ))}
                      {(detalleProductoData?.costos || []).length === 0 && (
                        <tr>
                          <td colSpan="4" className="comercial-vacio">
                            Sin costos de proveedores cargados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="inventario-subtitulo">Últimos movimientos</h3>
                <div className="comercial-tabla-scroll">
                  <table className="tabla-comercial tabla-lineas">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th className="numero">Cantidad</th>
                        <th>Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleProductoData?.movimientos || []).map((item) => (
                        <tr key={item.id}>
                          <td>{formatearFechaHora(item.fecha)}</td>
                          <td>{item.tipo_detalle}</td>
                          <td className="numero">
                            {Number(item.cantidad) > 0 ? '+' : ''}
                            {formatearNumero(item.cantidad)}
                          </td>
                          <td>{item.referencia || '—'}</td>
                        </tr>
                      ))}
                      {(detalleProductoData?.movimientos || []).length === 0 && (
                        <tr>
                          <td colSpan="4" className="comercial-vacio">
                            Sin movimientos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => setDetalleProducto(null)}
              >
                Cerrar
              </button>
              {puedeProducto && (
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={() => {
                    const producto = detalleProducto
                    setDetalleProducto(null)
                    setProductoEditando(producto)
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

      {detalleStock && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal inventario-modal-ancho">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconBox size={24} />
                {detalleStock.producto_detalle}
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={() => setDetalleStock(null)}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="detalle-cabecera">
              <div>
                <span>Sucursal</span>
                <strong>{detalleStock.sucursal_detalle}</strong>
              </div>
              <div>
                <span>Stock</span>
                <strong>{formatearNumero(detalleStock.cantidad)}</strong>
              </div>
              <div>
                <span>Mínimo</span>
                <strong>{formatearNumero(detalleStock.cant_min)}</strong>
              </div>
              <div>
                <span>Negativo máximo</span>
                <strong>
                  {formatearNumero(detalleStock.cant_negativa_max)}
                </strong>
              </div>
            </div>

            {detalleStockData?.cargando ? (
              <p className="comercial-nota">
                <IconLoader2 className="icono-girando" size={18} /> Cargando
                lotes y movimientos…
              </p>
            ) : (
              <>
                <h3 className="inventario-subtitulo">Lotes por depósito</h3>
                <div className="comercial-tabla-scroll">
                  <table className="tabla-comercial tabla-lineas">
                    <thead>
                      <tr>
                        <th>Depósito</th>
                        <th>Lote</th>
                        <th className="numero">Cantidad</th>
                        <th>Ingreso</th>
                        <th>Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleStockData?.lotes || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.deposito_detalle}</td>
                          <td>{item.lote || '—'}</td>
                          <td className="numero">
                            {formatearNumero(item.cantidad)}
                          </td>
                          <td>{formatearFechaHora(item.fecha_ingreso)}</td>
                          <td>{item.fecha_venc || '—'}</td>
                        </tr>
                      ))}
                      {(detalleStockData?.lotes || []).length === 0 && (
                        <tr>
                          <td colSpan="5" className="comercial-vacio">
                            Sin lotes registrados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="inventario-subtitulo">Últimos movimientos</h3>
                <div className="comercial-tabla-scroll">
                  <table className="tabla-comercial tabla-lineas">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th className="numero">Cantidad</th>
                        <th>Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleStockData?.movimientos || []).map((item) => (
                        <tr key={item.id}>
                          <td>{formatearFechaHora(item.fecha)}</td>
                          <td>{item.tipo_detalle}</td>
                          <td className="numero">
                            {Number(item.cantidad) > 0 ? '+' : ''}
                            {formatearNumero(item.cantidad)}
                          </td>
                          <td>{item.referencia || '—'}</td>
                        </tr>
                      ))}
                      {(detalleStockData?.movimientos || []).length === 0 && (
                        <tr>
                          <td colSpan="4" className="comercial-vacio">
                            Sin movimientos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="comercial-modal-acciones">
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => setDetalleStock(null)}
              >
                Cerrar
              </button>
              {puedeStock && (
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={() => {
                    const stock = detalleStock
                    setDetalleStock(null)
                    setStockConfig(stock)
                  }}
                >
                  <IconAdjustments size={18} />
                  Configurar
                </button>
              )}
              {puedeStock && (
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={() => {
                    const stock = detalleStock
                    setDetalleStock(null)
                    abrirTransferencia(stock.producto, '', {
                      id: stock.producto,
                      nombre: stock.producto_detalle,
                    })
                  }}
                >
                  <IconArrowsExchange size={18} />
                  Transferir
                </button>
              )}
              {puedeStock && (
                <button
                  type="button"
                  className="boton-comercial-primario"
                  onClick={() => {
                    const stock = detalleStock
                    setDetalleStock(null)
                    setStockAjuste(stock)
                  }}
                >
                  <IconBox size={18} />
                  Ajustar stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PanelCatalogo({
  titulo,
  tipo,
  campo,
  items,
  puedeEditar,
  onNuevo,
  onEditar,
  onEliminar,
}) {
  return (
    <section className="inventario-catalogo-panel">
      <div className="inventario-catalogo-cabecera">
        <h3>{titulo}</h3>
        {puedeEditar && (
          <button
            type="button"
            className="boton-comercial-secundario"
            onClick={onNuevo}
          >
            <IconPlus size={16} />
            Nuevo
          </button>
        )}
      </div>
      <div className="inventario-catalogo-lista">
        {items.length === 0 && (
          <p className="comercial-nota">No hay registros.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="inventario-catalogo-item">
            <span>{item[campo]}</span>
            {puedeEditar && (
              <div className="acciones-fila">
                <button
                  type="button"
                  className="boton-icono"
                  onClick={() => onEditar(item)}
                  title={`Editar ${tipo}`}
                >
                  <IconPencil size={15} />
                </button>
                <button
                  type="button"
                  className="boton-icono boton-icono-peligro"
                  onClick={() => onEliminar(item)}
                  title={`Eliminar ${tipo}`}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
