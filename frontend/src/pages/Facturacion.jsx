import { useCallback, useState } from 'react'
import {
  IconFileText,
  IconLoader2,
  IconLock,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import useCacheModulo from '../hooks/useCacheModulo'
import Encabezado from '../components/Encabezado.jsx'
import { useAuth } from '../context/auth-context'
import { formatearFechaHora } from '../utils/formato'
import '../styles/Comercial.css'
import '../styles/Placeholder.css'
import '../styles/Facturacion.css'

const COMPROBANTES_POR_PAGINA = 10

export default function Facturacion() {
  const { user, puedeEscribir } = useAuth()
  const puedeVerEmisor = puedeEscribir(['AD', 'GE'])
  const [paginaFacturas, setPaginaFacturas] = useState(1)

  const consultar = useCallback(async () => {
    const cargaFacturas = pedirTodas('/facturas/')
      .then((lista) => (Array.isArray(lista) ? lista : []))
      .catch(() => [])

    const cargaEmpresa = puedeVerEmisor
      ? pedir('/empresas/')
          .then((respuesta) => {
            const lista = respuesta.results ?? respuesta
            return Array.isArray(lista) ? lista[0] ?? null : null
          })
          .catch(() => null)
      : Promise.resolve(null)

    const [facturas, empresa] = await Promise.all([
      cargaFacturas,
      cargaEmpresa,
    ])
    return { facturas, empresa }
  }, [puedeVerEmisor])

  const { datos, cargando } = useCacheModulo({
    clave: `facturacion|${user?.id ?? ''}`,
    consultar,
    inicial: { facturas: [], empresa: null },
  })
  const facturas = datos.facturas ?? []
  const empresa = datos.empresa ?? null

  const totalPaginasFacturas = Math.max(
    1,
    Math.ceil(facturas.length / COMPROBANTES_POR_PAGINA),
  )
  const indiceInicioFacturas =
    (paginaFacturas - 1) * COMPROBANTES_POR_PAGINA
  const facturasVisibles = facturas.slice(
    indiceInicioFacturas,
    indiceInicioFacturas + COMPROBANTES_POR_PAGINA,
  )

  return (
    <>
      <Encabezado
        titulo="Facturación"
        subtitulo="Comprobantes electrónicos"
      />

      <div className="placeholder-contenido facturacion-contenido facturacion-modulo">
        {puedeVerEmisor && (
          <article className="facturacion-panel facturacion-panel-emisor">
            <span className="facturacion-icono">
              <IconRosetteDiscountCheck size={34} stroke={1.5} />
            </span>
            <h2>Datos de emisión</h2>
            {empresa ? (
              <div className="facturacion-datos">
                <div>
                  <span>CUIT</span>
                  <strong>{empresa.cuit || '—'}</strong>
                </div>
                <div>
                  <span>Razón social</span>
                  <strong>{empresa.razon_social || '—'}</strong>
                </div>
                <div>
                  <span>Condición IVA</span>
                  <strong>{empresa.condicion_iva || '—'}</strong>
                </div>
                <div>
                  <span>Punto de venta</span>
                  <strong>Sin configurar</strong>
                </div>
                <div>
                  <span>Certificado</span>
                  <strong>Sin configurar</strong>
                </div>
              </div>
            ) : (
              <p className="placeholder-nota">
                Todavía no hay datos del emisor cargados.
              </p>
            )}
            <p className="placeholder-nota">
              Esta información se completa con los datos de ARCA y es la que se
              usa para firmar los comprobantes. Solo la ve administración.
            </p>
          </article>
        )}

        <article className="facturacion-panel facturacion-panel-emision">
          <span className="facturacion-icono facturacion-icono-bloqueado">
            <IconLock size={34} stroke={1.5} />
          </span>
          <h2>Emitir comprobante</h2>
          <p>
            La emisión de comprobantes electrónicos queda a la espera de las
            credenciales de ARCA: CUIT del emisor, certificado digital y punto de
            venta habilitado.
          </p>
          <button
            type="button"
            className="boton-comercial-primario"
            disabled
            title="Faltan credenciales de ARCA"
          >
            <IconFileText size={18} />
            Emitir comprobante
          </button>
          <p className="placeholder-nota">
            Mientras tanto se pueden consultar los comprobantes ya emitidos que
            figuren en el listado de abajo.
          </p>
        </article>

        <article className="facturacion-panel facturacion-panel-listado">
          <span className="facturacion-icono">
            <IconFileText size={34} stroke={1.5} />
          </span>
          <h2>Comprobantes emitidos</h2>
          {cargando ? (
            <p className="facturacion-cargando">
              <IconLoader2 className="icono-girando" size={18} />
              Cargando comprobantes…
            </p>
          ) : facturas.length === 0 ? (
            <p className="placeholder-nota">
              Todavía no hay comprobantes emitidos.
            </p>
          ) : (
            <>
              <div className="comercial-tabla-scroll">
                <table className="tabla-comercial tabla-facturacion">
                  <thead>
                    <tr>
                      <th>Comprobante</th>
                      <th>Venta</th>
                      <th>Tipo</th>
                      <th>Fecha de emisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasVisibles.map((factura) => (
                      <tr key={factura.id}>
                        <td>#{factura.id}</td>
                        <td>#{factura.venta}</td>
                        <td>
                          <span className="facturacion-tipo">
                            {factura.tipo_detalle}
                          </span>
                        </td>
                        <td>{formatearFechaHora(factura.fecha_emision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="comercial-paginacion">
                <span>
                  {facturas.length} comprobante{facturas.length === 1 ? '' : 's'}
                </span>
                <div>
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    disabled={paginaFacturas === 1}
                    onClick={() =>
                      setPaginaFacturas((actual) => Math.max(1, actual - 1))
                    }
                  >
                    Anterior
                  </button>
                  <span>
                    Página {paginaFacturas} de {totalPaginasFacturas}
                  </span>
                  <button
                    type="button"
                    className="boton-comercial-secundario"
                    disabled={paginaFacturas === totalPaginasFacturas}
                    onClick={() =>
                      setPaginaFacturas((actual) =>
                        Math.min(totalPaginasFacturas, actual + 1),
                      )
                    }
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </article>
      </div>
    </>
  )
}
