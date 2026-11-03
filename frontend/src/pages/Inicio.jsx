import { useCallback, useEffect, useState } from 'react'
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
  formatearFechaHora,
  formatearMoneda,
  formatearNumero,
} from '../utils/formato'
import '../styles/Inicio.css'

const DATOS_VACIOS = {
  ventas: {
    hoy: { cantidad: 0, monto: '0' },
    mes: { cantidad: 0, monto: '0' },
    pendientes: { cantidad: 0, monto: '0' },
  },
  compras: {
    pendientes_recepcion: 0,
    mes: { cantidad: 0, monto: '0' },
  },
  catalogo: { productos: 0 },
  stock: { bajo: 0, negativo: 0 },
  caja: { abiertas: 0 },
  equipo: { empleados_activos: 0, proveedores_activos: 0 },
  ventas_por_dia: [],
  ventas_recientes: [],
  stock_critico: [],
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
        {detalle && <p className="kpi-detalle">{detalle}</p>}
      </div>
    </article>
  )
}

function EstadoVenta({ estado, etiqueta }) {
  return <span className={`badge badge-${estado.toLowerCase()}`}>{etiqueta}</span>
}

export default function Inicio() {
  const { user, puedeVer } = useAuth()
  const [datos, setDatos] = useState(DATOS_VACIOS)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      const respuesta = await pedir('/dashboard/')
      setDatos(respuesta)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    pedir('/dashboard/')
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
  }, [])

  const nombre = user?.nombre?.split(' ')[0] ?? ''
  const accesos = modulosDelMenu.filter(
    (modulo) =>
      !['/', '/perfil', '/actividad', '/facturacion'].includes(modulo.path) &&
      puedeVer(modulo),
  )

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

  if (error) {
    return (
      <>
        <Encabezado titulo={`¡Hola, ${nombre}!`} subtitulo="Resumen del sistema" />
        <div className="dashboard-estado">
          <IconAlertTriangle size={36} />
          <p>No pudimos cargar el dashboard.</p>
          <small>{error}</small>
          <button
            type="button"
            className="boton-reintentar"
            onClick={() => {
              setCargando(true)
              setError('')
              cargar()
            }}
          >
            <IconRefresh size={18} />
            Reintentar
          </button>
        </div>
      </>
    )
  }

  const { ventas, compras, catalogo, stock, caja, equipo } = datos
  const maximo = Math.max(
    ...datos.ventas_por_dia.map((dia) => Number(dia.monto) || 0),
    1,
  )
  const totalSemana = datos.ventas_por_dia.reduce(
    (total, dia) => total + (Number(dia.monto) || 0),
    0,
  )

  return (
    <>
      <Encabezado
        titulo={`¡Hola, ${nombre}!`}
        subtitulo={`Rol: ${user?.rol} · ¿Qué necesitás gestionar hoy?`}
      />

      <div className="dashboard">
        <section className="dashboard-kpis">
          <TarjetaKpi
            icono={IconCurrencyDollar}
            etiqueta="Ventas de hoy"
            valor={formatearMoneda(ventas.hoy.monto)}
            detalle={`${ventas.hoy.cantidad} operación${
              ventas.hoy.cantidad === 1 ? '' : 'es'
            }`}
          />
          <TarjetaKpi
            icono={IconChartBar}
            etiqueta="Ventas del mes"
            valor={formatearMoneda(ventas.mes.monto)}
            detalle={`${ventas.mes.cantidad} venta${
              ventas.mes.cantidad === 1 ? '' : 's'
            } registradas`}
          />
          <TarjetaKpi
            icono={IconClock}
            etiqueta="Pendientes de confirmar"
            valor={formatearNumero(ventas.pendientes.cantidad)}
            detalle={`${formatearMoneda(ventas.pendientes.monto)} en juego`}
            tono={ventas.pendientes.cantidad > 0 ? 'kpi-aviso' : ''}
          />
          <TarjetaKpi
            icono={IconCash}
            etiqueta="Cajas abiertas"
            valor={formatearNumero(caja.abiertas)}
            detalle={
              caja.abiertas > 0
                ? 'Secciones de caja en curso'
                : 'No hay cajas abiertas'
            }
            tono={caja.abiertas === 0 ? 'kpi-neutro' : ''}
          />
        </section>

        <section className="dashboard-grid">
          <article className="panel panel-grafico">
            <div className="panel-cabecera">
              <h2 className="panel-titulo">
                <IconChartBar size={24} />
                Ventas de los últimos 7 días
              </h2>
              <span className="panel-nota">Montos en ARS</span>
            </div>

            {totalSemana === 0 ? (
              <p className="panel-vacio">
                No hay ventas registradas en los últimos 7 días.
              </p>
            ) : (
              <div className="grafico-barras">
                {datos.ventas_por_dia.map((dia) => {
                  const monto = Number(dia.monto) || 0
                  const alto = monto > 0 ? Math.max((monto / maximo) * 100, 6) : 2
                  return (
                    <div className="grafico-columna" key={dia.fecha}>
                      <div className="grafico-barra-caja">
                        <div
                          className={`grafico-barra ${monto > 0 ? '' : 'grafico-barra-vacia'}`}
                          style={{ height: `${alto}%` }}
                          title={`${dia.fecha}: ${formatearMoneda(monto)}`}
                        />
                      </div>
                      <span className="grafico-etiqueta">{etiquetaDia(dia.fecha)}</span>
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
                  <li
                    className="stock-item"
                    key={`${item.producto}-${item.sucursal}`}
                  >
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
