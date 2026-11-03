import { IconLock } from '@tabler/icons-react'
import Encabezado from '../components/Encabezado.jsx'
import '../styles/Placeholder.css'

export default function Facturacion() {
  return (
    <>
      <Encabezado
        titulo="Facturación"
        subtitulo="Comprobantes electrónicos"
      />
      <div className="placeholder-contenido">
        <article className="placeholder-panel placeholder-mantenimiento">
          <span className="placeholder-icono">
            <IconLock size={40} stroke={1.5} />
          </span>
          <h2>Sección en mantenimiento</h2>
          <p>
            La facturación electrónica todavía no está disponible. Estamos
            esperando las credenciales de ARCA (CUIT, certificado y punto de
            venta) para habilitar la emisión de comprobantes.
          </p>
          <p className="placeholder-nota">
            Mientras tanto se pueden consultar las facturas existentes desde la
            API, pero no emitir nuevas.
          </p>
        </article>
      </div>
    </>
  )
}
