import { useCallback, useState } from 'react'
import Swal from 'sweetalert2'
import { IconLoader2, IconPackage, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { formatearMoneda } from '../../utils/formato'
import { validarNumero } from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'
import FormularioProveedor from './FormularioProveedor.jsx'

export default function FormularioProductoProveedor({
  asociacion = null,
  sucursales = [],
  sucursalActiva = '',
  onCerrar,
  onGuardado,
}) {
  const esEdicion = Boolean(asociacion?.id)
  const [proveedor, setProveedor] = useState(
    asociacion?.proveedor ? String(asociacion.proveedor) : '',
  )
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(
    asociacion?.proveedor
      ? {
          id: asociacion.proveedor,
          razon_social: asociacion.proveedor_detalle,
          nombre: asociacion.proveedor_detalle,
          cuit: asociacion.proveedor_cuit,
        }
      : null,
  )
  const [proveedorRapido, setProveedorRapido] = useState(false)
  const [producto, setProducto] = useState(
    asociacion?.producto ? String(asociacion.producto) : '',
  )
  const [productoSeleccionado, setProductoSeleccionado] = useState(
    asociacion?.producto
      ? {
          id: asociacion.producto,
          nombre: asociacion.producto_detalle,
          codigo: asociacion.producto_codigo,
          categoria_detalle: asociacion.producto_categoria_detalle,
          unidad_detalle: asociacion.producto_unidad_detalle,
          precio_unidad: asociacion.producto_precio_unidad,
        }
      : null,
  )
  const [codigo, setCodigo] = useState(
    asociacion?.codigo_producto_proveedor || '',
  )
  const [precio, setPrecio] = useState(asociacion?.precio_lista || '')
  const [estado, setEstado] = useState(asociacion?.estado ?? true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  const buscarProveedores = useCallback(async (texto) => {
    const respuesta = await pedir(
      `/proveedores/?search=${encodeURIComponent(
        texto,
      )}&estado_prov=true&page=1`,
    )
    return respuesta.results || []
  }, [])

  const buscarProductos = useCallback(async (texto) => {
    const respuesta = await pedir(
      `/productos/?search=${encodeURIComponent(texto)}&page=1`,
    )
    return respuesta.results || []
  }, [])

  function proveedorCreado(nuevo) {
    setProveedor(String(nuevo.id))
    setProveedorSeleccionado(nuevo)
    setProveedorRapido(false)
  }

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (!proveedor || !proveedorSeleccionado) {
      nuevos.proveedor = 'Seleccioná un proveedor activo.'
    }
    if (!producto || !productoSeleccionado) {
      nuevos.producto = 'Seleccioná un producto.'
    }
    const errorPrecio = validarNumero(precio, {
      etiqueta: 'El precio de costo',
      mayorQueCero: true,
      decimales: 2,
    })
    if (errorPrecio) {
      nuevos.precio = errorPrecio
    } else if (
      productoSeleccionado &&
      Number(precio) >= Number(productoSeleccionado.precio_unidad)
    ) {
      nuevos.precio = `El costo debe ser menor al precio de venta (${formatearMoneda(
        productoSeleccionado.precio_unidad,
      )}).`
    }
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErrores({})
    const precioNumero = Number(precio)
    setGuardando(true)
    try {
      const guardado = await pedir(
        esEdicion
          ? `/productos-proveedores/${asociacion.id}/`
          : '/productos-proveedores/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({
            proveedor: Number(proveedor),
            producto: Number(producto),
            codigo_producto_proveedor: codigo.trim() || null,
            precio_lista: precioNumero.toFixed(2),
            estado,
          }),
        },
      )
      onGuardado?.(guardado, esEdicion)
    } catch (e) {
      if (e.campos) {
        setErrores(e.campos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
        <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconPackage size={24} />
            {esEdicion ? 'Editar costo' : 'Asociar producto y costo'}
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

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <CampoSelectorBuscable
            etiqueta="Proveedor *"
            valor={proveedor}
            onCambiar={(valor, opcion) => {
              setProveedor(valor)
              setProveedorSeleccionado(opcion || null)
            }}
            opciones={[]}
            opcionSeleccionada={proveedorSeleccionado}
            onBuscar={buscarProveedores}
            textoOpcion={(item) => item.razon_social || item.nombre}
            textoSecundario={(item) =>
              item.cuit ? `CUIT ${item.cuit}` : ''
            }
            placeholder="Buscar por nombre o CUIT"
            onCrear={() => setProveedorRapido(true)}
            tituloCrear="Nuevo proveedor"
            error={Boolean(errores.proveedor)}
            mensajeError={errores.proveedor}
          />

          <CampoSelectorBuscable
            etiqueta="Producto *"
            valor={producto}
            onCambiar={(valor, opcion) => {
              setProducto(valor)
              setProductoSeleccionado(opcion || null)
            }}
            opciones={[]}
            opcionSeleccionada={productoSeleccionado}
            onBuscar={buscarProductos}
            textoOpcion={(item) => item.nombre}
            textoSecundario={(item) =>
              `${item.codigo} · ${item.categoria_detalle}`
            }
            placeholder="Buscar por código o nombre"
            error={Boolean(errores.producto)}
            mensajeError={errores.producto}
          />

          <label className="campo-comercial">
            <span>Código del proveedor</span>
            <input
              type="text"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
            />
          </label>

          <label className="campo-comercial">
            <span>Precio de costo *</span>
            <input
              type="number"
              className={errores.precio ? 'input-error' : ''}
              min="0.01"
              step="0.01"
              value={precio}
              onChange={(evento) => setPrecio(evento.target.value)}
            />
            <MensajeError>{errores.precio}</MensajeError>
            {productoSeleccionado && (
              <small className="campo-ayuda">
                Venta: {formatearMoneda(productoSeleccionado.precio_unidad)}
              </small>
            )}
          </label>

          <label className="campo-checkbox ancho-completo">
            <input
              type="checkbox"
              checked={estado}
              onChange={(evento) => setEstado(evento.target.checked)}
            />
            <span>Costo activo</span>
          </label>

          <div className="comercial-modal-acciones ancho-completo">
            <button
              type="button"
              className="boton-comercial-secundario"
              onClick={onCerrar}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="boton-comercial-primario"
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Guardando…
                </>
              ) : (
                'Guardar costo'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>

      {proveedorRapido && (
        <FormularioProveedor
          sucursales={sucursales}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setProveedorRapido(false)}
          onGuardado={proveedorCreado}
        />
      )}
    </>
  )
}
