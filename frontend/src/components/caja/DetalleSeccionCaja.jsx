import Swal from 'sweetalert2'
import {
  IconCheck,
  IconCash,
  IconPrinter,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { formatearFechaHora, formatearMoneda } from '../../utils/formato'

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => {
    const mapa = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return mapa[caracter]
  })
}

function fechaHoraActual() {
  return new Date().toLocaleString('es-AR')
}

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

  function imprimirArqueo() {
    const ventana = window.open('', '_blank', 'width=900,height=700')
    if (!ventana) {
      Swal.fire({
        icon: 'error',
        title: 'Ventana bloqueada',
        text: 'Permití las ventanas emergentes para imprimir el arqueo.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    const filas = seccion.detalles_cierre
      .map(
        (detalle) => `
          <tr>
            <td>${escaparHtml(detalle.metodo_pago_detalle)}</td>
            <td class="numero">${escaparHtml(formatearMoneda(detalle.monto_sistema))}</td>
            <td class="numero">${escaparHtml(formatearMoneda(detalle.monto_real))}</td>
            <td class="numero">${escaparHtml(formatearMoneda(detalle.diferencia))}</td>
          </tr>`,
      )
      .join('')

    const observaciones = [seccion.observaciones_apertura, seccion.observaciones]
      .filter((nota) => nota && nota.trim() !== '')
      .map(
        (nota) =>
          `<p class="datos"><strong>Observaciones:</strong> ${escaparHtml(nota)}</p>`,
      )
      .join('')

    ventana.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Arqueo - Seccion #${escaparHtml(seccion.id)} - Corralon Fer-Cons</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f2a30; margin: 2.5rem; }
    header { display: flex; justify-content: space-between; border-bottom: 3px solid #4a9da8; padding-bottom: 1rem; }
    h1 { margin: 0; font-size: 1.6rem; }
    .marca { color: #4a9da8; font-size: 1.1rem; font-weight: bold; }
    .datos { margin: 0.6rem 0; font-size: 0.95rem; }
    .datos p { margin: 0.15rem 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border-bottom: 1px solid #d7e5e7; padding: 0.55rem; text-align: left; }
    th { background: #dff0f3; font-size: 0.8rem; text-transform: uppercase; }
    .numero { text-align: right; }
    .total { margin-top: 1.2rem; text-align: right; font-size: 1.1rem; font-weight: bold; }
    footer { margin-top: 2rem; border-top: 1px solid #d7e5e7; padding-top: 0.8rem; font-size: 0.8rem; color: #557; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="marca">CORRALÓN FER-CONS</div>
      <p>Gestión de materiales de construcción</p>
    </div>
    <div>
      <h1>ARQUEO DE CAJA</h1>
      <p>Sección #${escaparHtml(seccion.id)}</p>
    </div>
  </header>
  <div class="datos">
    <p><strong>Caja física:</strong> ${escaparHtml(seccion.caja_detalle)}</p>
    <p><strong>Sucursal:</strong> ${escaparHtml(seccion.sucursal_detalle)}</p>
    <p><strong>Empleado:</strong> ${escaparHtml(seccion.empleado_detalle)} · <strong>Abierta por:</strong> ${escaparHtml(seccion.abierta_por ?? '—')}</p>
    <p><strong>Apertura:</strong> ${escaparHtml(formatearFechaHora(seccion.fecha_hora_apertura))} · <strong>Cierre:</strong> ${escaparHtml(formatearFechaHora(seccion.fecha_hora_cierre))}</p>
    <p><strong>Monto inicial:</strong> ${escaparHtml(formatearMoneda(seccion.monto_inicial))} · <strong>Monto final:</strong> ${escaparHtml(formatearMoneda(seccion.monto_final))}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Método</th>
        <th class="numero">Teórico</th>
        <th class="numero">Contado</th>
        <th class="numero">Diferencia</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="numero">${escaparHtml(formatearMoneda(totalSistema))}</td>
        <td class="numero">${escaparHtml(formatearMoneda(totalReal))}</td>
        <td class="numero">${escaparHtml(formatearMoneda(totalDiferencia))}</td>
      </tr>
    </tfoot>
  </table>
  ${observaciones}
  <footer>
    Documento generado por el sistema para control interno.
    ${escaparHtml(fechaHoraActual())}
  </footer>
</body>
</html>`)
    ventana.document.close()
    ventana.focus()
    ventana.setTimeout(() => ventana.print(), 400)
  }

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
            <span>Abierta por</span>
            <strong>{seccion.abierta_por ?? '—'}</strong>
          </div>
          {seccion.motivo_apertura && (
            <div>
              <span>Motivo de apertura</span>
              <strong>{seccion.motivo_apertura}</strong>
            </div>
          )}
          {seccion.observaciones_apertura && (
            <div>
              <span>Observación de apertura</span>
              <strong>{seccion.observaciones_apertura}</strong>
            </div>
          )}
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
          {(seccion.estado === 'CE' || seccion.estado === 'AU') && (
            <button
              type="button"
              className="boton-comercial-secundario"
              onClick={imprimirArqueo}
            >
              <IconPrinter size={17} />
              Imprimir arqueo
            </button>
          )}
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
