import Swal from 'sweetalert2'
import { formatearFechaHora, formatearMoneda } from './formato'

function escapar(valor) {
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

export function imprimirComprobante({
  titulo,
  numero,
  fecha,
  entidadEtiqueta,
  entidad,
  referencia,
  estado,
  items = [],
  total,
  pagado,
  saldo,
  pagos = [],
  nota = '',
}) {
  const ventana = window.open('', '_blank', 'width=900,height=700')
  if (!ventana) {
    Swal.fire({
      icon: 'error',
      title: 'Ventana bloqueada',
      text: 'Permití las ventanas emergentes para imprimir el comprobante.',
      confirmButtonColor: '#4a9da8',
    })
    return
  }

  const filas = items
    .map(
      (item) => `
        <tr>
          <td>${escapar(item.codigo)}</td>
          <td>${escapar(item.nombre)}</td>
          <td class="numero">${escapar(item.cantidad)}</td>
          <td class="numero">${formatearMoneda(item.precio)}</td>
          <td class="numero">${formatearMoneda(item.subtotal)}</td>
        </tr>`,
    )
    .join('')
  const filasPagos = pagos
    .map(
      (pago) => `
        <tr>
          <td>${escapar(pago.metodo)}</td>
          <td class="numero">${formatearMoneda(pago.monto)}</td>
        </tr>`,
    )
    .join('')

  ventana.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapar(titulo)} - Corralón Fer-Cons</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f2a30; margin: 2rem; }
    header { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 3px solid #4a9da8; padding-bottom: 1rem; }
    h1 { margin: 0; font-size: 1.5rem; }
    h2 { margin: 0; font-size: 1.1rem; }
    .marca { color: #4a9da8; font-size: 1rem; font-weight: bold; }
    .datos { display: grid; grid-template-columns: 1fr 1fr; gap: .35rem 2rem; margin: 1.25rem 0; font-size: .9rem; }
    .datos p { margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border-bottom: 1px solid #d7e5e7; padding: .5rem; text-align: left; font-size: .9rem; }
    th { background: #dff0f3; font-size: .75rem; text-transform: uppercase; }
    .numero { text-align: right; }
    .totales { margin-top: 1rem; margin-left: auto; width: 45%; font-size: .9rem; }
    .totales div { display: flex; justify-content: space-between; padding: .25rem 0; }
    .totales .final { border-top: 2px solid #4a9da8; margin-top: .35rem; padding-top: .5rem; font-size: 1.05rem; font-weight: bold; }
    .nota { margin-top: 1.25rem; font-size: .85rem; }
    footer { margin-top: 2rem; border-top: 1px solid #d7e5e7; padding-top: .75rem; font-size: .75rem; color: #557; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="marca">CORRALÓN FER-CONS</div>
      <p>Gestión de materiales de construcción</p>
      <h2>${escapar(titulo)} #${escapar(numero)}</h2>
    </div>
    <div>
      <p>${escapar(formatearFechaHora(fecha))}</p>
      <p><strong>${escapar(estado)}</strong></p>
    </div>
  </header>
  <div class="datos">
    <p><strong>${escapar(entidadEtiqueta)}:</strong> ${escapar(entidad)}</p>
    <p><strong>Referencia:</strong> ${escapar(referencia)}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Producto</th>
        <th class="numero">Cantidad</th>
        <th class="numero">Precio</th>
        <th class="numero">Subtotal</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  ${
    filasPagos
      ? `<h2 style="margin-top:1.25rem">Pagos</h2>
         <table><thead><tr><th>Método</th><th class="numero">Monto</th></tr></thead>
         <tbody>${filasPagos}</tbody></table>`
      : ''
  }
  <div class="totales">
    <div><span>Total</span><strong>${formatearMoneda(total)}</strong></div>
    <div><span>Pagado</span><strong>${formatearMoneda(pagado)}</strong></div>
    <div class="final"><span>Saldo</span><strong>${formatearMoneda(saldo)}</strong></div>
  </div>
  ${nota ? `<p class="nota">${escapar(nota)}</p>` : ''}
  <footer>
    Comprobante interno — no válido como factura. Corralón Fer-Cons.
  </footer>
</body>
</html>`)
  ventana.document.close()
  ventana.focus()
  ventana.setTimeout(() => ventana.print(), 400)
}
