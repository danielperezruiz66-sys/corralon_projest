import { IconShoppingCart, IconX } from '@tabler/icons-react'
import { claseEstado, nombreCliente, saldoVenta } from '../../utils/comercial'
import { formatearFechaHora, formatearMoneda } from '../../utils/formato'

export default function DetalleVenta({
  venta,
  puedeCobrar,
  onCerrar,
  onConfirmar,
  onCobrar,
}) {
  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconShoppingCart size={24} />
            Venta #{venta.id}
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
            <span>Cliente</span>
            <strong>{nombreCliente(venta)}</strong>
          </div>
          <div>
            <span>Fecha</span>
            <strong>{formatearFechaHora(venta.fecha_venta)}</strong>
          </div>
          <div>
            <span>Caja / Sección</span>
            <strong>{venta.seccion_caja_detalle || '—'}</strong>
          </div>
          <div>
            <span>Estado</span>
            <span className={claseEstado(venta.estado)}>
              {venta.estado_detalle}
            </span>
          </div>
        </div>

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
              {venta.detalles.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.producto_detalle}</strong>
                  </td>
                  <td className="numero">{item.cantidad_venta}</td>
                  <td className="numero">
                    {formatearMoneda(item.precio_venta)}
                  </td>
                  <td className="numero">{formatearMoneda(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="comercial-total">
          <span>Total</span>
          <strong>{formatearMoneda(venta.monto_venta)}</strong>
        </div>

        {venta.pagos?.length > 0 && (
          <div className="cobro-pagos">
            <span>Pagos registrados</span>
            {venta.pagos.map((pago) => (
              <div key={pago.id}>
                <span>{pago.metodo_pago_detalle}</span>
                <strong>{formatearMoneda(pago.monto_pagado)}</strong>
              </div>
            ))}
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
          {puedeCobrar &&
            venta.estado === 'PE' &&
            saldoVenta(venta) <= 0 && (
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={() => onConfirmar(venta)}
              >
                Confirmar venta
              </button>
            )}
          {puedeCobrar && venta.estado === 'PE' && saldoVenta(venta) > 0 && (
            <button
              type="button"
              className="boton-comercial-primario"
              onClick={() => onCobrar(venta)}
            >
              Cobrar venta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
