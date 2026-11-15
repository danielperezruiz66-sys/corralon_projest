import { useEffect, useState } from 'react'
import {
  IconFileText,
  IconLoader2,
  IconLock,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import { useAuth } from '../context/auth-context'
import { formatearFechaHora } from '../utils/formato'
import '../styles/Comercial.css'
import '../styles/Placeholder.css'

export default function Facturacion() {
  const { puedeEscribir } = useAuth()
  const puedeVerEmisor = puedeEscribir(['AD', 'GE'])
  const [facturas, setFacturas] = useState([])
  const [empresa, setEmpresa] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    const cargaFacturas = pedirTodas('/facturas/')
      .then((datos) => {
        if (vigente) {
          setFacturas(datos)
        }
      })
      .catch(() => {
        if (vigente) {
          setFacturas([])
        }
      })

    const cargaEmpresa = puedeVerEmisor
      ? pedir('/empresas/')
          .then((respuesta) => {
            const lista = respuesta.results ?? respuesta
            if (vigente) {
              setEmpresa(Array.isArray(lista) ? lista[0] ?? null : null)
            }
          })
          .catch(() => {
            if (vigente) {
              setEmpresa(null)
            }
          })
      : Promise.resolve()

    Promise.all([cargaFacturas, cargaEmpresa]).finally(() => {
      if (vigente) {
        setCargando(false)
      }
    })

    return () => {
      vigente = false
    }
  }, [puedeVerEmisor])

  return (
    <>
      <Encabezado
        titulo="Facturación"
        subtitulo="Comprobantes electrónicos"
      />

      <div className="placeholder-contenido facturacion-contenido">
        <article className="facturacion-panel">
          <span className="facturacion-icono facturacion-icono-bloqueado">
            <IconLock size={34} stroke={1.5} />
          </span>
          <h2>Emitir comprobante</h2>
          <p>
            La emisión de comprobantes electrónicos queda a la espera de las
            credenciales de ARCA: CUIT del emisor, certificado digital y punto
            de venta habilitado.
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

        <article className="facturacion-panel">
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
            <div className="comercial-tabla-scroll">
              <table className="tabla-comercial tabla-lineas">
                <thead>
                  <tr>
                    <th>Comprobante</th>
                    <th>Venta</th>
                    <th>Tipo</th>
                    <th>Fecha de emisión</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((factura) => (
                    <tr key={factura.id}>
                      <td>#{factura.id}</td>
                      <td>#{factura.venta}</td>
                      <td>{factura.tipo_detalle}</td>
                      <td>{formatearFechaHora(factura.fecha_emision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {puedeVerEmisor && (
          <article className="facturacion-panel">
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
              Esta información se completa con los datos de ARCA y es la que
              se usa para firmar los comprobantes. Solo la ve administración.
            </p>
          </article>
        )}
      </div>
    </>
  )
}
