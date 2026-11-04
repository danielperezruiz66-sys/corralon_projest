import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCash,
  IconChartBar,
  IconClock,
  IconCurrencyDollar,
  IconLoader2,
  IconPackage,
  IconReceipt,
  IconRefresh,
  IconShoppingCart,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import { useAuth } from '../context/auth-context'
import { modulosDelMenu } from '../data/menuConfig.js'
import {
  etiquetaDia,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  formatearMoneda,
  formatearNumero,
} from '../utils/formato'
import '../styles/Inicio.css'

const PERIODOS = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: '7d', etiqueta: '7 días' },
  { id: 'mes', etiqueta: 'Mes' },
]

const ETIQUETAS_PERIODO = {
  hoy: 'Ventas de hoy',
  '7d': 'Ventas de 7 días',
  mes: 'Ventas del mes',
}

const ETIQUETAS_COMPARACION = {
  hoy: 'vs. ayer',
  '7d': 'vs. 7 días anteriores',
  mes: 'vs. mismo período anterior',
}

const DATOS_VACIOS = {
  filtros: { periodo: 'hoy', sucursal: null, sucursales: [] },
  ventas: {
    hoy: { cantidad: 0, monto: '0', ticket_promedio: '0' },
    mes: { cantidad: 0, monto: '0', ticket_promedio: '0' },
    periodo: {
      cantidad: 0,
      monto: '0',
      ticket_promedio: '0',
      comparacion: { monto_anterior: '0', variacion_porcentaje: null },
    },
    pendientes: {
      cantidad: 0,
      monto: '0',
      ticket_promedio: '0',
      por_vencer: 0,
      minutos_restantes: null,
    },
  },
  compras: {
    pendientes_recepcion: 0,
    mes: { cantidad: 0, monto: '0', ticket_promedio: '0' },
  },
  catalogo: { productos: 0 },
  stock: { bajo: 0, negativo: 0 },
  caja: { abiertas: 0 },
  equipo: { empleados_activos: 0, proveedores_activos: 0 },
  alertas: {
    ventas_por_vencer: 0,
    minutos_restantes: null,
    stock_negativo: 0,
    stock_bajo: 0,
    compras_por_recibir: 0,
    cajas_abiertas: 0,
  },
  serie_etiqueta: 'Últimos 7 días',
  ventas_por_dia: [],
  ventas_recientes: [],
  stock_critico: [],
  compras_por_recibir: [],
  cajas_abiertas: [],
}

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
  const clase =
    numero > 0 ? 'positiva' : numero < 0 ? 'negativa' : 'neutra'
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
  const { user, puedeVer } = useAuth()
  const [datos, setDatos] = useState(DATOS_VACIOS)
  const [periodo, setPeriodo] = useState('hoy')
  const [sucursal, setSucursal] = useState('')
  const [refresco, setRefresco] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [tieneDatos, setTieneDatos] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    const parametros = new URLSearchParams({ periodo })
    if (sucursal) {
      parametros.set('sucursal', sucursal)
    }

    pedir(`/dashboard/?${parametros.toString()}`)
      .then((respuesta) => {
        if (vigente) {
          setDatos(respuesta)
          setError('')
          setTieneDatos(true)
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
  }, [periodo, sucursal, refresco])

  const cambiarPeriodo = (nuevo) => {
    if (nuevo === periodo) {
      return
    }
    setPeriodo(nuevo)
    setActualizando(true)
    setError('')
  }

  const cambiarSucursal = (evento) => {
    setSucursal(evento.target.value)
    setActualizando(true)
    setError('')
  }

  const refrescar = () => {
    setActualizando(true)
    setError('')
    setRefresco((valor) => valor + 1)
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
          <button type="button" className="boton-reintentar" onClick={refrescar}>
            <IconRefresh size={18} />
            Reintentar
          </button>
        </div>
      </>
    )
  }

  const { ventas, compras, catalogo, stock, caja, equipo, alertas } = datos
  const maximo = Math.max(
    ...datos.ventas_por_dia.map((dia) => Number(dia.monto) || 0),
    1,
  )
  const totalSerie = datos.ventas_por_dia.reduce(
    (total, dia) => total + (Number(dia.monto) || 0),
    0,
  )
  const esSerieMensual = datos.ventas_por_dia.length > 10
  const montoInicialCajas = datos.cajas_abiertas.reduce(
    (total, item) => total + (Number(item.monto_inicial) || 0),
    0,
  )

  const alertasActivas = [
    alertas.ventas_por_vencer > 0 && {
      id: 'vencer',
      tono: 'peligro',
      icono: IconClock,
      titulo: `${alertas.ventas_por_vencer} venta${
        alertas.ventas_por_vencer === 1 ? '' : 's'
      } por vencer`,
      detalle:
        alertas.minutos_restantes !== null
          ? `Próxima en ${alertas.minutos_restantes} min`
          : 'Revisar ventas pendientes',
      to: '/ventas',
    },
    alertas.stock_negativo > 0 && {
      id: 'negativo',
      tono: 'peligro',
      icono: IconAlertTriangle,
      titulo: `${alertas.stock_negativo} producto${
        alertas.stock_negativo === 1 ? '' : 's'
      } con stock negativo`,
      detalle: 'Revisar reposición urgente',
      to: '/productos',
    },
    alertas.stock_bajo > 0 && {
      id: 'bajo',
      tono: 'aviso',
      icono: IconPackage,
      titulo: `${alertas.stock_bajo} producto${
        alertas.stock_bajo === 1 ? '' : 's'
      } bajo el mínimo`,
      detalle: 'Programar compra',
      to: '/productos',
    },
    alertas.compras_por_recibir > 0 && {
      id: 'compras',
      tono: 'aviso',
      icono: IconTruckDelivery,
      titulo: `${alertas.compras_por_recibir} compra${
        alertas.compras_por_recibir === 1 ? '' : 's'
      } sin recibir`,
      detalle: 'Pendientes de recepción',
      to: '/compras',
    },
    alertas.cajas_abiertas > 0 && {
      id: 'cajas',
      tono: 'info',
      icono: IconCash,
      titulo: `${alertas.cajas_abiertas} caja${
        alertas.cajas_abiertas === 1 ? '' : 's'
      } abierta${alertas.cajas_abiertas === 1 ? '' : 's'}`,
      detalle: 'Secciones en curso',
      to: '/caja',
    },
  ].filter(Boolean)

  const accesos = modulosDelMenu.filter(
    (modulo) =>
      !['/', '/perfil', '/actividad', '/facturacion'].includes(modulo.path) &&
      puedeVer(modulo),
  )

  return (
    <>
      <Encabezado
        titulo={`¡Hola, ${nombre}!`}
        subtitulo={`Rol: ${user?.rol} · ¿Qué necesitás gestionar hoy?`}
      />

      <div className="dashboard">
        <section className="dashboard-controles">
          <label className="control-grupo">
            <span className="control-etiqueta">Sucursal</span>
            <select
              className="control-select"
              value={sucursal}
              onChange={cambiarSucursal}
            >
              <option value="">Todas las sucursales</option>
              {datos.filtros.sucursales.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="control-grupo">
            <span className="control-etiqueta">Período</span>
            <div className="segmento">
              {PERIODOS.map((opcion) => (
                <button
                  key={opcion.id}
                  type="button"
                  className={periodo === opcion.id ? 'activo' : ''}
                  onClick={() => cambiarPeriodo(opcion.id)}
                >
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="boton-refrescar"
            onClick={refrescar}
            disabled={actualizando}
          >
            <IconRefresh
              size={18}
              className={actualizando ? 'icono-girando' : ''}
            />
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </section>

        {error && tieneDatos && (
          <div className="dashboard-error-inline">
            <span>{error}</span>
            <button type="button" onClick={refrescar}>
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

        <section className="dashboard-kpis">
          <TarjetaKpi
            icono={IconCurrencyDollar}
            etiqueta={ETIQUETAS_PERIODO[periodo]}
            valor={formatearMoneda(ventas.periodo.monto)}
            detalle={
              <>
                <span>
                  {ventas.periodo.cantidad} venta
                  {ventas.periodo.cantidad === 1 ? '' : 's'} ·{' '}
                  {formatearMoneda(ventas.periodo.ticket_promedio)} ticket
                </span>
                <Comparacion
                  valor={ventas.periodo.comparacion.variacion_porcentaje}
                  etiqueta={ETIQUETAS_COMPARACION[periodo]}
                />
              </>
            }
          />
          <TarjetaKpi
            icono={IconReceipt}
            etiqueta="Ticket promedio"
            valor={formatearMoneda(ventas.periodo.ticket_promedio)}
            detalle={<span>Promedio por venta en el período</span>}
          />
          <TarjetaKpi
            icono={IconChartBar}
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
            icono={IconClock}
            etiqueta="Pendientes de confirmar"
            valor={formatearNumero(ventas.pendientes.cantidad)}
            detalle={
              <>
                <span>{formatearMoneda(ventas.pendientes.monto)} en juego</span>
                {ventas.pendientes.por_vencer > 0 && (
                  <span className="kpi-alerta-texto">
                    {ventas.pendientes.por_vencer} por vencer
                    {ventas.pendientes.minutos_restantes !== null
                      ? ` · ${ventas.pendientes.minutos_restantes} min`
                      : ''}
                  </span>
                )}
              </>
            }
            tono={ventas.pendientes.cantidad > 0 ? 'kpi-aviso' : ''}
          />
          <TarjetaKpi
            icono={IconCash}
            etiqueta="Cajas abiertas"
            valor={formatearNumero(caja.abiertas)}
            detalle={
              <span>
                {caja.abiertas > 0
                  ? `${formatearMoneda(montoInicialCajas)} inicial`
                  : 'Sin secciones abiertas'}
              </span>
            }
            tono={caja.abiertas === 0 ? 'kpi-neutro' : ''}
          />
          <TarjetaKpi
            icono={IconTruckDelivery}
            etiqueta="Compras por recibir"
            valor={formatearNumero(compras.pendientes_recepcion)}
            detalle={
              <span>
                {formatearMoneda(compras.mes.monto)} comprado este mes
              </span>
            }
            tono={compras.pendientes_recepcion > 0 ? 'kpi-aviso' : ''}
          />
        </section>

        <section className="dashboard-grid">
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
                No hay ventas registradas en el período seleccionado.
              </p>
            ) : (
              <div
                className={`grafico-barras ${
                  esSerieMensual ? 'grafico-barras-mes' : ''
                }`}
              >
                {datos.ventas_por_dia.map((dia) => {
                  const monto = Number(dia.monto) || 0
                  const alto = monto > 0 ? Math.max((monto / maximo) * 100, 6) : 2
                  return (
                    <div className="grafico-columna" key={dia.fecha}>
                      <div className="grafico-barra-caja">
                        <div
                          className={`grafico-barra ${monto > 0 ? '' : 'grafico-barra-vacia'}`}
                          style={{ height: `${alto}%` }}
                          title={`${dia.fecha}: ${formatearMoneda(monto)} · ${dia.cantidad} ventas`}
                        />
                      </div>
                      <span className="grafico-etiqueta">
                        {esSerieMensual ? dia.fecha.slice(8, 10) : etiquetaDia(dia.fecha)}
                      </span>
                      <span className="grafico-cantidad">{dia.cantidad}</span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="dashboard-mini">
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
              <div className="mini-dato">
                <IconTruckDelivery size={20} />
                <span>
                  <strong>{formatearNumero(compras.pendientes_recepcion)}</strong>
                  Compras por recibir
                </span>
              </div>
              <div className="mini-dato">
                <IconUsers size={20} />
                <span>
                  <strong>{formatearNumero(equipo.empleados_activos)}</strong>
                  Empleados activos
                </span>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-cabecera">
              <h2 className="panel-titulo">
                <IconCash size={24} />
                Cajas abiertas
              </h2>
              <Link to="/caja" className="panel-enlace">
                Ver Caja
              </Link>
            </div>

            {datos.cajas_abiertas.length === 0 ? (
              <p className="panel-vacio">No hay cajas con secciones abiertas.</p>
            ) : (
              <ul className="caja-lista">
                {datos.cajas_abiertas.map((item) => (
                  <li className="caja-item" key={item.id}>
                    <div className="caja-item-info">
                      <strong>{item.caja}</strong>
                      <small>
                        {item.sucursal} · {item.empleado}
                      </small>
                    </div>
                    <div className="caja-item-horario">
                      <span>{formatearHora(item.fecha_hora_apertura)}</span>
                      <small>{formatearMoneda(item.monto_inicial)} inicial</small>
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
        </section>

        <section className="dashboard-grid dashboard-grid-inferior">
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
              <p className="panel-vacio">Todavía no hay ventas registradas.</p>
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

          <article className="panel">
            <div className="panel-cabecera">
              <h2 className="panel-titulo">
                <IconAlertTriangle size={24} />
                Stock crítico
              </h2>
              <Link to="/productos" className="panel-enlace">
                Ver stock
              </Link>
            </div>

            {datos.stock_critico.length === 0 ? (
              <p className="panel-vacio">
                No hay productos por debajo del mínimo. El stock está al día.
              </p>
            ) : (
              <ul className="stock-lista">
                {datos.stock_critico.map((item) => (
                  <li className="stock-item" key={item.id}>
                    <div>
                      <strong>{item.producto}</strong>
                      <small>{item.sucursal}</small>
                    </div>
                    <div className="stock-cantidades">
                      <span className="stock-cantidad">
                        {formatearNumero(item.cantidad)}
                      </span>
                      <small>mín. {formatearNumero(item.cant_min)}</small>
                    </div>
                    <span
                      className={`badge ${
                        item.alerta === 'NEGATIVO'
                          ? 'badge-peligro'
                          : 'badge-aviso'
                      }`}
                    >
                      {item.alerta === 'NEGATIVO' ? 'Negativo' : 'Mínimo'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {stock.negativo > 0 && (
              <p className="panel-alerta">
                Hay {stock.negativo} registro
                {stock.negativo === 1 ? '' : 's'} con stock negativo.
              </p>
            )}
          </article>
        </section>

        <section className="dashboard-grid dashboard-grid-inferior">
          <article className="panel">
            <div className="panel-cabecera">
              <h2 className="panel-titulo">
                <IconTruckDelivery size={24} />
                Compras por recibir
              </h2>
              <Link to="/compras" className="panel-enlace">
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
                  <li className="compra-item" key={item.id}>
                    <div className="compra-info">
                      <strong>{item.proveedor}</strong>
                      <small>
                        {formatearFecha(item.fecha_compra)} ·{' '}
                        {item.dias_esperando} día
                        {item.dias_esperando === 1 ? '' : 's'} esperando
                      </small>
                    </div>
                    <div className="compra-monto">
                      <strong>{formatearMoneda(item.monto)}</strong>
                      <span className="badge badge-pe">Pendiente</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel">
            <div className="panel-cabecera">
              <h2 className="panel-titulo">Accesos rápidos</h2>
            </div>

            <div className="accesos-rapidos">
              {accesos.map((modulo) => {
                const Icono = modulo.icono
                return (
                  <Link to={modulo.path} className="acceso-rapido" key={modulo.path}>
                    <span className="acceso-icono">
                      <Icono size={24} />
                    </span>
                    <span className="acceso-texto">
                      <strong>{modulo.name}</strong>
                      <small>{modulo.detalle}</small>
                    </span>
                    <IconArrowUpRight size={18} className="acceso-flecha" />
                  </Link>
                )
              })}
            </div>

            <div className="dashboard-resumen">
              <p>
                Compras del mes:{' '}
                <strong>{formatearMoneda(compras.mes.monto)}</strong>
              </p>
              <p>
                Proveedores activos:{' '}
                <strong>{formatearNumero(equipo.proveedores_activos)}</strong>
              </p>
            </div>
          </article>
        </section>
      </div>
    </>
  )
}
