import {
  IconBan,
  IconCash,
  IconTruck,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react'
import {
  claseEntrega,
  claseEstado,
  etiquetaEntrega,
  saldoCompra,
  totalPagado,
} from '../../utils/comercial'
import {
  formatearFecha,
  formatearFechaHora,
  formatearMoneda,
} from '../../utils/formato'

export default function DetalleCompra({
  compra,
  puedeGestionar,
  onCerrar,
  onAnular,
  onPagar,
  onEnCamino,
  onRecibir,
}) {
  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconTruckDelivery size={24} />
            Compra #{compra.id}
          </h2>
          <button
            type="button"
            className="comercial-modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="detalle-cabecera">
          <div>
            <span>Proveedor</span>
            <strong>{compra.proveedor_detalle || 'Sin proveedor'}</strong>
          </div>
          <div>
            <span>Fecha</span>
            <strong>{formatearFechaHora(compra.fecha_compra)}</strong>
          </div>
          <div>
            <span>Caja / Sección</span>
            <strong>{compra.seccion_caja_detalle || '—'}</strong>
          </div>
          <div>
            <span>Pago</span>
            <span className={claseEstado(compra.estado)}>
              {compra.estado_detalle}
            </span>
          </div>
          <div>
            <span>Recepción</span>
            <span className={claseEntrega(compra)}>
              {etiquetaEntrega(compra)}
            </span>
          </div>
          {compra.fecha_estimada_llegada && (
            <div>
              <span>Llegada estimada</span>
              <strong>
                {formatearFecha(compra.fecha_estimada_llegada)}
              </strong>
            </div>
          )}
        </div>

        {compra.estado === 'AN' && compra.motivo_cancelacion && (
          <p className="comercial-nota">
            <strong>Motivo de anulación:</strong>{' '}
            {compra.motivo_cancelacion}
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
              {compra.detalles.map((item) => (
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
          <strong>{formatearMoneda(compra.monto_compra)}</strong>
        </div>

        {compra.pagos?.length > 0 && (
          <div className="cobro-pagos">
            <span>Pagos registrados</span>
            {compra.pagos.map((pago) => (
              <div key={pago.id}>
                <span>{pago.metodo_pago_detalle}</span>
                <strong>{formatearMoneda(pago.monto_pagado)}</strong>
              </div>
            ))}
          </div>
        )}

        {compra.estado !== 'AN' && (
          <div className="comercial-total">
            <span>Saldo pendiente</span>
            <strong>{formatearMoneda(saldoCompra(compra))}</strong>
          </div>
        )}

        <div className="comercial-modal-acciones">
          <button
            type="button"
            className="boton-comercial-secundario"
            onClick={onCerrar}
          >
            Cerrar
          </button>
          {puedeGestionar &&
            !compra.recibida &&
            compra.estado !== 'AN' &&
            totalPagado(compra) === 0 && (
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => onAnular(compra)}
              >
                <IconBan size={18} />
                Anular compra
              </button>
            )}
          {puedeGestionar &&
            compra.estado !== 'AN' &&
            saldoCompra(compra) > 0 && (
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => onPagar(compra)}
              >
                <IconCash size={18} />
                Registrar pago
              </button>
            )}
          {puedeGestionar &&
            compra.estado !== 'AN' &&
            !compra.recibida &&
            compra.estado_entrega !== 'EC' && (
              <button
                type="button"
                className="boton-comercial-secundario"
                onClick={() => onEnCamino(compra)}
              >
                <IconTruck size={18} />
                Marcar en camino
              </button>
            )}
          {puedeGestionar &&
            compra.estado !== 'AN' &&
            !compra.recibida && (
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={() => onRecibir(compra)}
              >
                Recibir compra
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
