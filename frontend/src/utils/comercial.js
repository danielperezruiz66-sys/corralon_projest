let siguientePagoId = 1

export function nuevoPago(metodo = '', monto = '') {
  siguientePagoId += 1
  return { id: siguientePagoId, metodo, monto }
}

export function montoPago(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : 0
}

export function claseEstado(estado) {
  return `estado-badge estado-${estado.toLowerCase()}`
}

export function nombreCliente(venta) {
  return venta.cliente_detalle || venta.cliente_venta || 'Consumidor final'
}

export function claseEntrega(compra) {
  if (compra.estado === 'AN') {
    return 'estado-badge estado-an'
  }
  if (compra.estado_entrega === 'RE') {
    return 'estado-badge estado-recibida'
  }
  if (compra.estado_entrega === 'EC') {
    return 'estado-badge estado-ec'
  }
  return 'estado-badge estado-pe'
}

export function etiquetaEntrega(compra) {
  if (compra.estado === 'AN') {
    return 'Anulada'
  }
  return compra.estado_entrega_detalle || 'Por recibir'
}

export function totalPagado(documento) {
  return (documento.pagos ?? []).reduce(
    (total, pago) => total + Number(pago.monto_pagado),
    0,
  )
}

export function saldoVenta(venta) {
  return Math.max(0, Number(venta.monto_venta) - totalPagado(venta))
}

export function saldoCompra(compra) {
  return Math.max(0, Number(compra.monto_compra) - totalPagado(compra))
}
