import Swal from 'sweetalert2'
import { formatearMoneda } from './formato'

/** `true` cuando la API rechazo el par (producto, proveedor) por duplicado. */
export function esAsociacionDuplicada(error) {
  return error?.datos?.codigo === 'duplicado'
}

/**
 * Alerta comun para los flujos de Inventario y Proveedores.
 * Devuelve los datos de la asociacion existente si el usuario acepta
 * actualizarla en lugar de crear una fila nueva.
 */
export async function ofrecerActualizarDuplicado(
  error,
  { producto = '', proveedor = '' } = {},
) {
  const datos = error?.datos || {}
  const costo = formatearMoneda(datos.precio_lista_actual)
  const referencia = [producto, proveedor].filter(Boolean).join(' · ')
  const resultado = await Swal.fire({
    icon: 'warning',
    title: 'Proveedor ya asociado',
    text: `${
      referencia ? `${referencia}. ` : ''
    }El costo vigente es ${costo}. Podés actualizar esa asociación existente en lugar de duplicarla.`,
    showCancelButton: true,
    confirmButtonText: 'Actualizar costo existente',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#4a9da8',
  })
  if (!resultado.isConfirmed || !datos.asociacion_id) {
    return null
  }
  return {
    asociacionId: datos.asociacion_id,
    precioActual: datos.precio_lista_actual,
    productoId: datos.producto_id,
    proveedorId: datos.proveedor_id,
  }
}
