import Swal from 'sweetalert2'
import {
  IconCheck,
  IconCash,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { formatearFechaHora, formatearMoneda } from '../../utils/formato'

export default function DetalleSeccionCaja({
  seccion,
  puedeAuditar,
  onCerrar,
  onAuditado,
}) {
  const totalSistema = seccion.detalles_cierre.reduce(
    (acumulado, detalle) => acumulado + Number(detalle.monto_sistema),
    0,
  )
  const totalReal = seccion.detalles_cierre.reduce(
    (acumulado, detalle) => acumulado + Number(detalle.monto_real),
    0,
  )
  const totalDiferencia = totalReal - totalSistema

  async function auditar() {
    const resultado = await Swal.fire({
      title: `¿Auditar la seccion #${seccion.id}?`,
      text: 'El cierre queda marcado como auditado y no admite cambios.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, auditar',
      cancelButtonText: 'Volver',
    })
    if (!resultado.isConfirmed) {
      return
    }
    try {
      await pedir(`/secciones-caja/${seccion.id}/auditar/`, {
        method: 'POST',
      })
      Swal.fire({
        icon: 'success',
        title: 'Seccion auditada',
        timer: 1400,
        showConfirmButton: false,
      })
      onAuditado?.()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo auditar la seccion',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconCash size={24} />
            Seccion #{seccion.id}
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

        <div className="caja-detalle-grid">
          <div>
            <span>Caja fisica</span>
            <strong>{seccion.caja_detalle}</strong>
          </div>
          <div>
            <span>Sucursal</span>
            <strong>{seccion.sucursal_detalle}</strong>
          </div>
          <div>
            <span>Empleado</span>
            <strong>{seccion.empleado_detalle}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>{seccion.estado_detalle}</strong>
          </div>
          <div>
            <span>Apertura</span>
            <strong>{formatearFechaHora(seccion.fecha_hora_apertura)}</strong>
          </div>
          <div>
            <span>Cierre</span>
            <strong>{formatearFechaHora(seccion.fecha_hora_cierre)}</strong>
          </div>
          <div>
            <span>Monto inicial</span>
            <strong>{formatearMoneda(seccion.monto_inicial)}</strong>
          </div>
          <div>
            <span>Monto teorico</span>
            <strong>
              {seccion.monto_teorico === null
                ? '—'
                : formatearMoneda(seccion.monto_teorico)}
            </strong>
          </div>
          <div>
            <span>Monto final</span>
            <strong>
              {seccion.monto_final === null
                ? '—'
                : formatearMoneda(seccion.monto_final)}
            </strong>
          </div>
        </div>

        <div className="caja-detalle-bloque">
          <h3>Arqueo por metodo de pago</h3>
          {seccion.detalles_cierre.length === 0 ? (
            <p className="comercial-nota">Todavia no hay un cierre registrado.</p>
          ) : (
            <table className="caja-cierre-tabla">
              <thead>
                <tr>
                  <th>Metodo</th>
                  <th>Teorico</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {seccion.detalles_cierre.map((detalle) => (
                  <tr key={detalle.id}>
                    <td>{detalle.metodo_pago_detalle}</td>
                    <td className="mono">
                      {formatearMoneda(detalle.monto_sistema)}
                    </td>
                    <td className="mono">
                      {formatearMoneda(detalle.monto_real)}
                    </td>
                    <td
                      className={`mono ${
                        Number(detalle.diferencia) > 0
                          ? 'caja-diferencia-positiva'
                          : Number(detalle.diferencia) < 0
                            ? 'caja-diferencia-negativa'
                            : 'caja-diferencia-cero'
                      }`}
                    >
                      {formatearMoneda(detalle.diferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="mono">{formatearMoneda(totalSistema)}</td>
                  <td className="mono">{formatearMoneda(totalReal)}</td>
                  <td
                    className={`mono ${
                      totalDiferencia > 0
                        ? 'caja-diferencia-positiva'
                        : totalDiferencia < 0
                          ? 'caja-diferencia-negativa'
                          : 'caja-diferencia-cero'
                    }`}
                  >
                    {formatearMoneda(totalDiferencia)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {seccion.observaciones && (
          <div className="caja-detalle-bloque">
            <h3>Observaciones</h3>
            <p className="caja-observaciones">{seccion.observaciones}</p>
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
          {puedeAuditar && seccion.estado === 'CE' && (
            <button
              type="button"
              className="boton-comercial-primario"
              onClick={auditar}
            >
              <IconCheck size={18} />
              Auditar seccion
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
