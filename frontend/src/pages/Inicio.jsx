import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconCalendar,
  IconCash,
  IconChartBar,
  IconClock,
  IconCurrencyDollar,
  IconFileText,
  IconLoader2,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconShoppingCart,
  IconTruckDelivery,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import { useAuth } from '../context/auth-context'
import {
  etiquetaDia,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  formatearMoneda,
  formatearNumero,
} from '../utils/formato'
import '../styles/Inicio.css'

const DATOS_VACIOS = {
  vista: 'lectura',
  codigos: [],
  bloques: {
    ventas: false,
    alertas_ventas: false,
    compras: false,
    stock: false,
    caja: false,
    equipo: false,
    actividad: false,
    ventas_por_sucursal: false,
    formas_pago: false,
    diferencias_caja: false,
  },
  filtros: { periodo: 'hoy', sucursal: null, sucursales: [] },
  ventas: {
    hoy: { cantidad: 0, monto: '0', ticket_promedio: '0' },
    semana: {
      cantidad: 0,
      monto: '0',
      ticket_promedio: '0',
      comparacion: { monto_anterior: '0', variacion_porcentaje: null },
    },
    ultimos_7_dias: {
      cantidad: 0,
      monto: '0',
      ticket_promedio: '0',
      comparacion: { monto_anterior: '0', variacion_porcentaje: null },
    },
    mes: { cantidad: 0, monto: '0', ticket_promedio: '0' },
    pendientes: {
      cantidad: 0,
      monto: '0',
      ticket_promedio: '0',
      saldo_pendiente: '0',
      por_vencer: 0,
      vencidas: 0,
      minutos_restantes: null,
    },
    parciales: {
      cantidad: 0,
      monto: '0',
      ticket_promedio: '0',
      saldo_pendiente: '0',
    },
  },
  compras: {
    pendientes_recepcion: 0,
    mes: { cantidad: 0, monto: '0', ticket_promedio: '0' },
  },
  catalogo: { productos: 0 },
  stock: { bajo: 0, negativo: 0, critico: 0 },
  caja: { abiertas: 0, pausadas: 0, en_curso: 0 },
  equipo: { empleados_activos: 0, proveedores_activos: 0 },
  alertas: {
    ventas_por_vencer: 0,
    ventas_vencidas: 0,
    minutos_restantes: null,
    stock_negativo: 0,
    stock_bajo: 0,
    stock_critico: 0,
    compras_por_recibir: 0,
    cajas_abiertas: 0,
    cajas_pausadas: 0,
    cajas_en_curso: 0,
  },
  serie_etiqueta: 'Últimos 7 días',
  ventas_por_dia: [],
  ventas_recientes: [],
  ventas_por_vencer: [],
  stock_critico: [],
  compras_por_recibir: [],
  cajas_abiertas: [],
}

function normalizarDashboard(recibido) {
  const datos = recibido ?? {}
  const ventas = datos.ventas ?? {}
  return {
    ...DATOS_VACIOS,
    ...datos,
    bloques: { ...DATOS_VACIOS.bloques, ...(datos.bloques ?? {}) },
    ventas: {
      ...DATOS_VACIOS.ventas,
      ...ventas,
      hoy: { ...DATOS_VACIOS.ventas.hoy, ...(ventas.hoy ?? {}) },
      semana: { ...DATOS_VACIOS.ventas.semana, ...(ventas.semana ?? {}) },
      ultimos_7_dias: {
        ...DATOS_VACIOS.ventas.ultimos_7_dias,
        ...(ventas.ultimos_7_dias ?? {}),
      },
      mes: { ...DATOS_VACIOS.ventas.mes, ...(ventas.mes ?? {}) },
      pendientes: {
        ...DATOS_VACIOS.ventas.pendientes,
        ...(ventas.pendientes ?? {}),
      },
      parciales: {
        ...DATOS_VACIOS.ventas.parciales,
        ...(ventas.parciales ?? {}),
      },
    },
    compras: {
      ...DATOS_VACIOS.compras,
      ...(datos.compras ?? {}),
      mes: {
        ...DATOS_VACIOS.compras.mes,
        ...(datos.compras?.mes ?? {}),
      },
    },
    catalogo: { ...DATOS_VACIOS.catalogo, ...(datos.catalogo ?? {}) },
    stock: { ...DATOS_VACIOS.stock, ...(datos.stock ?? {}) },
    caja: { ...DATOS_VACIOS.caja, ...(datos.caja ?? {}) },
    equipo: { ...DATOS_VACIOS.equipo, ...(datos.equipo ?? {}) },
    alertas: { ...DATOS_VACIOS.alertas, ...(datos.alertas ?? {}) },
    ventas_por_dia: datos.ventas_por_dia ?? DATOS_VACIOS.ventas_por_dia,
    ventas_recientes:
      datos.ventas_recientes ?? DATOS_VACIOS.ventas_recientes,
    ventas_por_vencer:
      datos.ventas_por_vencer ?? DATOS_VACIOS.ventas_por_vencer,
    stock_critico: datos.stock_critico ?? DATOS_VACIOS.stock_critico,
    compras_por_recibir:
      datos.compras_por_recibir ?? DATOS_VACIOS.compras_por_recibir,
    cajas_abiertas: datos.cajas_abiertas ?? DATOS_VACIOS.cajas_abiertas,
  }
}

// Cache en memoria del ultimo dashboard: al volver desde otro modulo se
// muestra al instante y la actualizacion sigue en segundo plano.
let cacheDashboard = null

function TarjetaKpi({ icono: Icono, etiqueta, valor, detalle, tono = '' }) {
  return (
    <article className={`kpi-tarjeta ${tono}`}>
      <span className="kpi-icono">
        <Icono size={26} stroke={1.75} />
      </span>
      <div className="kpi-contenido">
        <p className="kpi-etiqueta">{etiqueta}</p>
        <p className="kpi-valor">{valor}</p>
        {detalle && <div className="kpi-detalle">{detalle}</div>}
      </div>
    </article>
  )
}

function Comparacion({ valor, etiqueta }) {
  if (valor === null || valor === undefined) {
    return (
      <span className="kpi-comparacion kpi-comparacion-neutra">
        Sin comparación <small>{etiqueta}</small>
      </span>
    )
  }

  const numero = Number(valor)
  const clase = numero > 0 ? 'positiva' : numero < 0 ? 'negativa' : 'neutra'
  const simbolo = numero > 0 ? '▲' : numero < 0 ? '▼' : '='

  return (
    <span className={`kpi-comparacion kpi-comparacion-${clase}`}>
      {simbolo} {Math.abs(numero).toFixed(1)}% <small>{etiqueta}</small>
    </span>
  )
}

function EstadoVenta({ estado, etiqueta }) {
  return <span className={`badge badge-${estado.toLowerCase()}`}>{etiqueta}</span>
}

export default function Inicio() {
  const { user } = useAuth()
  const location = useLocation()
  const claveCache = `${user?.id ?? ''}`
  const cacheInicial =
    cacheDashboard && cacheDashboard.clave === claveCache
      ? cacheDashboard
      : null
  const [datos, setDatos] = useState(cacheInicial?.datos ?? DATOS_VACIOS)
  const [cargando, setCargando] = useState(!cacheInicial)
  const [actualizando, setActualizando] = useState(Boolean(cacheInicial))
  const [tieneDatos, setTieneDatos] = useState(Boolean(cacheInicial))
  const [ultimaActualizacion, setUltimaActualizacion] = useState(
    cacheInicial?.actualizado ?? null,
  )
  const [error, setError] = useState('')
  const solicitudRef = useRef(false)

  const consultar = useCallback(() => pedir('/dashboard/'), [])

  const aplicarRespuesta = useCallback(
    (respuesta) => {
      const normalizado = normalizarDashboard(respuesta)
      const ahora = new Date()
      setDatos(normalizado)
      setError('')
      setTieneDatos(true)
      setUltimaActualizacion(ahora)
      cacheDashboard = {
        clave: claveCache,
        datos: normalizado,
        actualizado: ahora,
      }
    },
    [claveCache],
  )

  const cargar = useCallback(async () => {
    if (solicitudRef.current) {
      return
    }

    solicitudRef.current = true
    try {
      const respuesta = await consultar()
      aplicarRespuesta(respuesta)
    } catch (e) {
      setError(e.message)
    } finally {
      solicitudRef.current = false
      setCargando(false)
      setActualizando(false)
    }
  }, [consultar, aplicarRespuesta])

  useEffect(() => {
    let vigente = true

    consultar()
      .then((respuesta) => {
        if (vigente) {
          aplicarRespuesta(respuesta)
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
          setActualizando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [consultar, aplicarRespuesta])

  useEffect(() => {
    if (cargando || !location.hash) {
      return
    }
    const destino = document.getElementById(location.hash.slice(1))
    if (destino) {
      destino.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [cargando, location.hash])

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActualizando(true)
        cargar()
      }
    }, 15000)

    const alEnfocar = () => {
      setActualizando(true)
      cargar()
    }

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        setActualizando(true)
        cargar()
      }
    }

    window.addEventListener('focus', alEnfocar)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      clearInterval(intervalo)
      window.removeEventListener('focus', alEnfocar)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [cargar])

  const reintentar = () => {
    setActualizando(true)
    setError('')
    cargar()
  }

  const nombreBase = user?.nombre?.split(' ')[0] ?? ''
  const nombre = nombreBase
    ? nombreBase.charAt(0).toUpperCase() + nombreBase.slice(1)
    : ''

  if (cargando) {
    return (
      <>
        <Encabezado
          titulo={`¡Hola, ${nombre}!`}
          subtitulo="Estamos preparando el resumen del sistema…"
        />
        <div className="dashboard-estado">
          <IconLoader2 className="icono-girando" size={34} />
          <p>Cargando indicadores…</p>
        </div>
      </>
    )
  }

  if (error && !tieneDatos) {
    return (
      <>
        <Encabezado titulo={`¡Hola, ${nombre}!`} subtitulo="Resumen del sistema" />
        <div className="dashboard-estado">
          <IconAlertTriangle size={36} />
          <p>No pudimos cargar el dashboard.</p>
          <small>{error}</small>
          <button type="button" className="boton-reintentar" onClick={reintentar}>
            <IconRefresh size={18} />
            Reintentar
          </button>
        </div>
      </>
    )
  }

  const { ventas, catalogo, stock, equipo, alertas } = datos
  const bloques = datos.bloques ?? DATOS_VACIOS.bloques
  const maximo = Math.max(
    ...datos.ventas_por_dia.map((dia) => Number(dia.monto) || 0),
    1,
  )
  const totalSerie = datos.ventas_por_dia.reduce(
    (total, dia) => total + (Number(dia.monto) || 0),
    0,
  )
  const esSerieMensual = datos.ventas_por_dia.length > 10

  const alertasActivas = [
    bloques.alertas_ventas && alertas.ventas_vencidas > 0 && {
      id: 'vencidas',
      tono: 'peligro',
      icono: IconClock,
      titulo: `${alertas.ventas_vencidas} venta${
        alertas.ventas_vencidas === 1 ? '' : 's'
      } vencida${
        alertas.ventas_vencidas === 1 ? '' : 's'
      } pendiente${alertas.ventas_vencidas === 1 ? '' : 's'} de anular`,
      detalle: 'La anulación es manual desde Ventas',
      to: '/ventas?alerta=vencida',
    },
    bloques.stock && alertas.stock_negativo > 0 && {
      id: 'negativo',
      tono: 'peligro',
      icono: IconAlertTriangle,
      titulo: `${alertas.stock_negativo} producto${
        alertas.stock_negativo === 1 ? '' : 's'
      } con stock negativo`,
      detalle: 'Ver en Stock crítico',
      to: '#stock-critico',
    },
    bloques.stock && alertas.stock_bajo > 0 && {
      id: 'bajo',
      tono: 'aviso',
      icono: IconPackage,
      titulo: `${alertas.stock_bajo} producto${
        alertas.stock_bajo === 1 ? '' : 's'
      } bajo el mínimo`,
      detalle: 'Ver en Stock crítico',
      to: '#stock-critico',
    },
    bloques.compras && alertas.compras_por_recibir > 0 && {
      id: 'compras',
      tono: 'aviso',
      icono: IconTruckDelivery,
      titulo: `${alertas.compras_por_recibir} compra${
        alertas.compras_por_recibir === 1 ? '' : 's'
      } sin recibir`,
      detalle: 'Ver en Compras por recibir',
      to: '#compras-por-recibir',
    },
  ].filter(Boolean)

  return (
    <>
      <Encabezado
        titulo={`¡Hola, ${nombre}!`}
        subtitulo={`Rol: ${user?.rol} · ¿Qué necesitás gestionar hoy?`}
      />

      <div className="dashboard">
        <section className="dashboard-controles">
          <div className="dashboard-acciones">
            {bloques.ventas && (
              <>
                <Link
                  to="/ventas?nueva=1"
                  className="boton-accion boton-accion-primario"
                >
                  <IconPlus size={18} />
                  Nueva venta
                </Link>
                <Link to="/clientes?nuevo=1" className="boton-accion">
                  <IconUserPlus size={18} />
                  Registrar cliente
                </Link>
                <Link to="/ventas?presupuesto=1" className="boton-accion">
                  <IconFileText size={18} />
                  Nuevo presupuesto
                </Link>
              </>
            )}
            {bloques.compras && (
              <>
                <Link to="/compras?nueva=1" className="boton-accion">
                  <IconPlus size={18} />
                  Nueva compra
                </Link>
              </>
            )}
          </div>

          <span className="dashboard-actualizado">
            {actualizando ? (
              <>
                <IconLoader2 className="icono-girando" size={16} />
                Actualizando…
              </>
            ) : (
              <>
                Actualizado{' '}
                {ultimaActualizacion
                  ? formatearHora(ultimaActualizacion.toISOString())
                  : '—'}
              </>
            )}
          </span>
        </section>

        {error && tieneDatos && (
          <div className="dashboard-error-inline">
            <span>{error}</span>
            <button type="button" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {alertasActivas.length > 0 && (
          <section className="alertas-barra">
            {alertasActivas.map((alerta) => {
              const Icono = alerta.icono
              return (
                <Link
                  to={alerta.to}
                  key={alerta.id}
                  className={`alerta-item alerta-${alerta.tono}`}
                >
                  <Icono size={22} />
                  <span className="alerta-texto">
                    <strong>{alerta.titulo}</strong>
                    <small>{alerta.detalle}</small>
                  </span>
                </Link>
              )
            })}
          </section>
        )}

        {bloques.ventas && (
          <section className="dashboard-kpis">
            {bloques.ventas && (
              <>
                <TarjetaKpi
                  icono={IconCurrencyDollar}
                  etiqueta="Ventas de hoy"
                  valor={formatearMoneda(ventas.hoy.monto)}
                  detalle={
                    <span>
                      {ventas.hoy.cantidad} venta
                      {ventas.hoy.cantidad === 1 ? '' : 's'} ·{' '}
                      {formatearMoneda(ventas.hoy.ticket_promedio)} ticket
                    </span>
                  }
                />
                <TarjetaKpi
                  icono={IconChartBar}
                  etiqueta="Ventas de los últimos 7 días"
                  valor={formatearMoneda(ventas.ultimos_7_dias.monto)}
                  detalle={
                    <>
                      <span>
                        {ventas.ultimos_7_dias.cantidad} venta
                        {ventas.ultimos_7_dias.cantidad === 1 ? '' : 's'} ·{' '}
                        {formatearMoneda(
                          ventas.ultimos_7_dias.ticket_promedio,
                        )}{' '}
                        ticket
                      </span>
                      <Comparacion
                        valor={
                          ventas.ultimos_7_dias.comparacion
                            .variacion_porcentaje
                        }
                        etiqueta="vs. 7 días anteriores"
                      />
                    </>
                  }
                />
                <TarjetaKpi
                  icono={IconCalendar}
                  etiqueta="Ventas del mes"
                  valor={formatearMoneda(ventas.mes.monto)}
                  detalle={
                    <span>
                      {ventas.mes.cantidad} venta
                      {ventas.mes.cantidad === 1 ? '' : 's'} ·{' '}
                      {formatearMoneda(ventas.mes.ticket_promedio)} ticket
                    </span>
                  }
                />
                <TarjetaKpi
                  icono={IconShoppingCart}
                  etiqueta="Parciales"
                  valor={formatearNumero(ventas.parciales.cantidad)}
                  detalle={
                    <span>
                      {formatearMoneda(ventas.parciales.saldo_pendiente)}{' '}
                      pendiente
                    </span>
                  }
                  tono={ventas.parciales.cantidad > 0 ? 'kpi-aviso' : ''}
                />
              </>
            )}
          </section>
        )}

        {(bloques.ventas || bloques.caja) && (
          <section
            className={`dashboard-grid ${
              bloques.ventas && bloques.caja ? '' : 'dashboard-grid-solo'
            }`}
          >
            {bloques.ventas && (
              <article className="panel panel-grafico">
                <div className="panel-cabecera">
                  <h2 className="panel-titulo">
                    <IconChartBar size={24} />
                    Evolución de ventas
                  </h2>
                  <span className="panel-nota">{datos.serie_etiqueta}</span>
                </div>

                {totalSerie === 0 ? (
                  <p className="panel-vacio">
                    No hay ventas registradas en los últimos 7 días.
                  </p>
                ) : (
                  <div
                    className={`grafico-barras ${
                      esSerieMensual ? 'grafico-barras-mes' : ''
                    }`}
                  >
                    {datos.ventas_por_dia.map((dia) => {
                      const monto = Number(dia.monto) || 0
                      const alto =
                        monto > 0 ? Math.max((monto / maximo) * 100, 6) : 2
                      return (
                        <div className="grafico-columna" key={dia.fecha}>
                          <div className="grafico-barra-caja">
                            <div
                              className={`grafico-barra ${
                                monto > 0 ? '' : 'grafico-barra-vacia'
                              }`}
                              style={{ height: `${alto}%` }}
                              title={`${dia.fecha}: ${formatearMoneda(
                                monto,
                              )} · ${dia.cantidad} ventas`}
                            />
                          </div>
                          <span className="grafico-etiqueta">
                            {esSerieMensual
                              ? dia.fecha.slice(8, 10)
                              : etiquetaDia(dia.fecha)}
                          </span>
                          <span className="grafico-cantidad">
                            {dia.cantidad}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )}

            {bloques.caja && (
              <article className="panel" id="cajas-abiertas">
                <div className="panel-cabecera">
                  <h2 className="panel-titulo">
                    <IconCash size={24} />
                    Cajas en curso
                  </h2>
                  <Link to="/caja?estado=AB" className="panel-enlace">
                    Ver Caja
                  </Link>
                </div>

                {datos.cajas_abiertas.length === 0 ? (
                  <p className="panel-vacio">
                    No hay cajas abiertas ni en pausa.
                  </p>
                ) : (
                  <ul className="caja-lista">
                    {datos.cajas_abiertas.map((item) => (
                      <li className="caja-item" key={item.id}>
                        <div className="caja-item-info">
                          <strong>{item.caja}</strong>
                          <small>
                            Sección #{item.id} · {item.empleado}
                          </small>
                          {item.estado === 'PA' && (
                            <span className="caja-item-pausa">En pausa</span>
                          )}
                        </div>
                        <div className="caja-item-horario">
                          <span>
                            {formatearHora(item.fecha_hora_apertura)}
                          </span>
                          <small>
                            {formatearMoneda(item.monto_inicial)} inicial
                          </small>
                        </div>
                        <div className="caja-item-ventas">
                          <strong>{formatearMoneda(item.ventas_monto)}</strong>
                          <small>
                            {item.ventas_cantidad} venta
                            {item.ventas_cantidad === 1 ? '' : 's'}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )}
          </section>
        )}

        {(bloques.stock || bloques.equipo) && (
          <section className="dashboard-mini">
            {bloques.stock && (
              <>
                <div className="mini-dato">
                  <IconPackage size={20} />
                  <span>
                    <strong>{formatearNumero(catalogo.productos)}</strong>
                    Productos
                  </span>
                </div>
                <div className="mini-dato">
                  <IconAlertTriangle size={20} />
                  <span>
                    <strong>{formatearNumero(stock.bajo)}</strong>
                    Stock bajo
                  </span>
                </div>
              </>
            )}
            {bloques.equipo && (
              <>
                <div className="mini-dato">
                  <IconUsers size={20} />
                  <span>
                    <strong>{formatearNumero(equipo.empleados_activos)}</strong>
                    Empleados activos
                  </span>
                </div>
                <div className="mini-dato">
                  <IconTruckDelivery size={20} />
                  <span>
                    <strong>
                      {formatearNumero(equipo.proveedores_activos)}
                    </strong>
                    Proveedores activos
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        {(bloques.ventas || bloques.stock) && (
          <section
            className={`dashboard-grid dashboard-grid-inferior ${
              bloques.ventas && bloques.stock ? '' : 'dashboard-grid-solo'
            }`}
          >
            {bloques.ventas && (
              <article className="panel">
                <div className="panel-cabecera">
                  <h2 className="panel-titulo">
                    <IconShoppingCart size={24} />
                    Últimas ventas
                  </h2>
                  <Link to="/ventas" className="panel-enlace">
                    Ver todas
                  </Link>
                </div>

                {datos.ventas_recientes.length === 0 ? (
                  <p className="panel-vacio">
                    Todavía no hay ventas registradas.
                  </p>
                ) : (
                  <div className="tabla-scroll">
                    <table className="tabla-mini">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Cliente</th>
                          <th className="alinear-derecha">Monto</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datos.ventas_recientes.map((venta) => (
                          <tr key={venta.id}>
                            <td className="texto-suave">
                              {formatearFechaHora(venta.fecha)}
                            </td>
                            <td>{venta.cliente}</td>
                            <td className="alinear-derecha">
                              {formatearMoneda(venta.monto)}
                            </td>
                            <td>
                              <EstadoVenta
                                estado={venta.estado}
                                etiqueta={venta.estado_detalle}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            )}

            {bloques.stock && (
              <article className="panel" id="stock-critico">
                <div className="panel-cabecera">
                  <h2 className="panel-titulo">
                    <IconAlertTriangle size={24} />
                    Stock crítico
                  </h2>
                  {stock.critico > 0 && (
                    <Link
                      to="/productos?tab=stock&alerta=critico"
                      className="panel-enlace"
                    >
                      Ver todos
                    </Link>
                  )}
                </div>

                {datos.stock_critico.length === 0 ? (
                  <p className="panel-vacio">
                    No hay productos críticos. El stock está al día.
                  </p>
                ) : (
                  <ul className="stock-lista">
                    {datos.stock_critico.map((item) => {
                      const esNegativo = item.alerta === 'NEGATIVO'
                      const sinStock =
                        item.sin_stock ?? Number(item.cantidad) === 0
                      return (
                        <li key={item.id}>
                          <div className="stock-item">
                            <div>
                              <strong>{item.producto}</strong>
                            </div>
                            <div className="stock-cantidades">
                              <span className="stock-cantidad">
                                {formatearNumero(item.cantidad)}
                              </span>
                              <small>
                                mín. {formatearNumero(item.cant_min)}
                              </small>
                            </div>
                            <span
                              className={`badge ${
                                esNegativo || sinStock
                                  ? 'badge-peligro'
                                  : 'badge-aviso'
                              }`}
                            >
                              {esNegativo
                                ? 'Negativo'
                                : sinStock
                                  ? 'Sin stock'
                                  : 'Mínimo'}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {stock.critico > datos.stock_critico.length && (
                  <p className="panel-nota panel-nota-pie">
                    Mostrando {datos.stock_critico.length} de {stock.critico}.
                  </p>
                )}

                {stock.negativo > 0 && (
                  <Link
                    to="/productos?tab=stock&alerta=negativo"
                    className="panel-alerta panel-alerta-enlace"
                  >
                    Hay {stock.negativo} registro
                    {stock.negativo === 1 ? '' : 's'} con stock negativo. Ver
                    en Inventario.
                  </Link>
                )}
              </article>
            )}
          </section>
        )}

        {bloques.compras && (
          <article className="panel" id="compras-por-recibir">
            <div className="panel-cabecera">
              <h2 className="panel-titulo">
                <IconTruckDelivery size={24} />
                Compras por recibir
              </h2>
              <Link to="/compras?por_recibir=1" className="panel-enlace">
                Ver compras
              </Link>
            </div>

            {datos.compras_por_recibir.length === 0 ? (
              <p className="panel-vacio">
                No hay compras pendientes de recepción.
              </p>
            ) : (
              <ul className="compra-lista">
                {datos.compras_por_recibir.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/compras?por_recibir=1&search=${item.id}`}
                      className="compra-item compra-item-enlace"
                      title={`Ver compra #${item.id}`}
                    >
                      <div className="compra-info">
                        <strong>{item.proveedor}</strong>
                        <small>
                          {formatearFecha(item.fecha_compra)} ·{' '}
                          {item.dias_esperando} día
                          {item.dias_esperando === 1 ? '' : 's'} esperando
                          {item.fecha_estimada_llegada
                            ? ` · llega ${formatearFecha(
                                item.fecha_estimada_llegada,
                              )}`
                            : ''}
                        </small>
                      </div>
                      <div className="compra-monto">
                        <strong>{formatearMoneda(item.monto)}</strong>
                        <span
                          className={`badge ${
                            item.estado_entrega === 'EC'
                              ? 'badge-aviso'
                              : 'badge-pe'
                          }`}
                        >
                          {item.estado_entrega_detalle ||
                            (item.estado_entrega === 'EC'
                              ? 'En camino'
                              : 'Por recibir')}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        )}
      </div>
    </>
  )
}
