export default function Facturacion() {
  return (
    <div className="tarjeta mantenimiento">
      <span className="mantenimiento-icono" aria-hidden="true">
        🔒
      </span>
      <h2>Sección en mantenimiento</h2>
      <p>
        La facturación electrónica todavía no está disponible. Estamos
        esperando las credenciales de ARCA (CUIT, certificado y punto de venta)
        para habilitar la emisión de comprobantes.
      </p>
      <p className="texto-suave">
        Mientras tanto podés consultar las facturas existentes desde la API,
        pero no emitir nuevas.
      </p>
    </div>
  )
}
