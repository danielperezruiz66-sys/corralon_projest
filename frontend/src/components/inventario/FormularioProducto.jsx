import { useCallback, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { IconLoader2, IconPackage, IconX } from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import { formatearMoneda } from '../../utils/formato'
import {
  validarCodigo,
  validarNumero,
  validarTexto,
} from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'
import FormularioProveedor from '../proveedores/FormularioProveedor.jsx'
import FormularioCatalogo from './FormularioCatalogo.jsx'

export default function FormularioProducto({
  producto = null,
  categorias = [],
  marcas = [],
  unidades = [],
  sucursales = [],
  sucursalActiva = '',
  onCerrar,
  onGuardado,
  onCatalogoCreado,
}) {
  const esEdicion = Boolean(producto?.id)
  const [codigo, setCodigo] = useState(producto?.codigo || '')
  const [nombre, setNombre] = useState(producto?.nombre || '')
  const [categoria, setCategoria] = useState(
    producto?.categoria ? String(producto.categoria) : '',
  )
  const [marca, setMarca] = useState(
    producto?.marca ? String(producto.marca) : '',
  )
  const [unidad, setUnidad] = useState(
    producto?.unidad ? String(producto.unidad) : '',
  )
  const [precio, setPrecio] = useState(producto?.precio_unidad || '')
  const [proveedor, setProveedor] = useState('')
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null)
  const [precioCosto, setPrecioCosto] = useState('')
  const [codigoProveedor, setCodigoProveedor] = useState('')
  const [catalogoRapido, setCatalogoRapido] = useState(null)
  const [proveedorRapido, setProveedorRapido] = useState(false)
  const [descripcion, setDescripcion] = useState(producto?.descripcion || '')
  const [seleccionadas, setSeleccionadas] = useState(() => {
    if (producto?.sucursales_activas) {
      return producto.sucursales_activas.map(Number)
    }
    if (sucursalActiva) {
      return [Number(sucursalActiva)]
    }
    return sucursales.map((item) => item.id)
  })
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

  useEffect(() => {
    if (!esEdicion || !producto?.id) {
      return undefined
    }
    let vigente = true
    pedirTodas(`/productos-proveedores/?producto=${producto.id}&estado=true`)
      .then((datos) => {
        if (!vigente) {
          return
        }
        const asociacion = datos[0]
        if (asociacion) {
          setProveedor(
            (actual) => actual || String(asociacion.proveedor),
          )
          setProveedorSeleccionado(
            (actual) =>
              actual || {
                id: asociacion.proveedor,
                razon_social: asociacion.proveedor_detalle,
                nombre: asociacion.proveedor_detalle,
                cuit: asociacion.proveedor_cuit,
              },
          )
          setPrecioCosto(
            (actual) => actual || String(asociacion.precio_lista),
          )
          setCodigoProveedor(
            (actual) =>
              actual || asociacion.codigo_producto_proveedor || '',
          )
        }
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [esEdicion, producto?.id])

  function alternarSucursal(id) {
    setSeleccionadas((actuales) =>
      actuales.includes(id)
        ? actuales.filter((item) => item !== id)
        : [...actuales, id],
    )
  }

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    const errorCodigo = validarCodigo(codigo)
    if (errorCodigo) {
      nuevos.codigo = errorCodigo
    }
    const errorNombre = validarTexto(nombre, 'El nombre', {
      min: 2,
      max: 80,
    })
    if (errorNombre) {
      nuevos.nombre = errorNombre
    }
    if (!categoria) {
      nuevos.categoria = 'Seleccioná una categoría.'
    }
    if (!marca) {
      nuevos.marca = 'Seleccioná una marca.'
    }
    if (!unidad) {
      nuevos.unidad = 'Seleccioná una unidad.'
    }
    const errorPrecio = validarNumero(precio, {
      etiqueta: 'El precio de venta',
      mayorQueCero: true,
      decimales: 2,
    })
    if (errorPrecio) {
      nuevos.precio = errorPrecio
    }
    if (
      !proveedor ||
      !proveedorSeleccionado ||
      String(proveedorSeleccionado.id) !== String(proveedor)
    ) {
      nuevos.proveedor = 'Seleccioná un proveedor activo.'
    }
    const errorCosto = validarNumero(precioCosto, {
      etiqueta: 'El precio de costo',
      mayorQueCero: true,
      decimales: 2,
    })
    if (errorCosto) {
      nuevos.precioCosto = errorCosto
    } else if (
      !errorPrecio &&
      Number(precioCosto) >= Number(precio)
    ) {
      nuevos.precioCosto = `El costo debe ser menor al precio de venta (${formatearMoneda(
        precio,
      )}).`
    }
    if (seleccionadas.length === 0) {
      nuevos.sucursales = 'Seleccioná al menos una sucursal.'
    }

    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErrores({})
    setGuardando(true)
    try {
      const guardado = await pedir(
        esEdicion ? `/productos/${producto.id}/` : '/productos/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            categoria: Number(categoria),
            marca: Number(marca),
            unidad: Number(unidad),
            precio_unidad: Number(precio).toFixed(2),
            descripcion: descripcion.trim() || null,
            sucursales: seleccionadas,
            proveedor: Number(proveedor),
            precio_lista: Number(precioCosto).toFixed(2),
            codigo_producto_proveedor: codigoProveedor.trim() || null,
          }),
        },
      )
      onGuardado?.(guardado, esEdicion)
    } catch (e) {
      if (e.campos) {
        const mapa = {
          precio_unidad: 'precio',
          precio_lista: 'precioCosto',
        }
        const nuevos = {}
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          nuevos[mapa[campo] || campo] = mensaje
        })
        setErrores(nuevos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar el producto',
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
            {esEdicion ? 'Editar producto' : 'Nuevo producto'}
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

        {esEdicion && producto?.costo_max && (
          <p className="comercial-nota">
            Costo máximo registrado: {formatearMoneda(producto.costo_max)}.
            El precio de venta debe ser mayor.
          </p>
        )}

        <form onSubmit={guardar} className="comercial-grid" noValidate>
          <label className="campo-comercial">
            <span>Código *</span>
            <input
              type="text"
              className={errores.codigo ? 'input-error' : ''}
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
            />
            <MensajeError>{errores.codigo}</MensajeError>
          </label>

          <label className="campo-comercial">
            <span>Nombre *</span>
            <input
              type="text"
              className={errores.nombre ? 'input-error' : ''}
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
            />
            <MensajeError>{errores.nombre}</MensajeError>
          </label>

          <CampoSelectorBuscable
            etiqueta="Categoría *"
            valor={categoria}
            onCambiar={setCategoria}
            opciones={categorias}
            textoOpcion={(item) => item.categorias}
            placeholder="Buscar categoría"
            onCrear={() => setCatalogoRapido('categorias')}
            tituloCrear="Nueva categoría"
            error={Boolean(errores.categoria)}
            mensajeError={errores.categoria}
          />

          <CampoSelectorBuscable
            etiqueta="Marca *"
            valor={marca}
            onCambiar={setMarca}
            opciones={marcas}
            textoOpcion={(item) => item.marcas}
            placeholder="Buscar marca"
            onCrear={() => setCatalogoRapido('marcas')}
            tituloCrear="Nueva marca"
            error={Boolean(errores.marca)}
            mensajeError={errores.marca}
          />

          <CampoSelectorBuscable
            etiqueta="Unidad *"
            valor={unidad}
            onCambiar={setUnidad}
            opciones={unidades}
            textoOpcion={(item) => item.unidades}
            placeholder="Buscar unidad"
            onCrear={() => setCatalogoRapido('unidades')}
            tituloCrear="Nueva unidad"
            error={Boolean(errores.unidad)}
            mensajeError={errores.unidad}
          />

          <label className="campo-comercial">
            <span>Precio de venta *</span>
            <input
              type="number"
              className={errores.precio ? 'input-error' : ''}
              min="0.01"
              step="0.01"
              value={precio}
              onChange={(evento) => setPrecio(evento.target.value)}
            />
            <MensajeError>{errores.precio}</MensajeError>
          </label>

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

          <label className="campo-comercial">
            <span>Precio de costo *</span>
            <input
              type="number"
              className={errores.precioCosto ? 'input-error' : ''}
              min="0.01"
              step="0.01"
              value={precioCosto}
              onChange={(evento) => setPrecioCosto(evento.target.value)}
            />
            <MensajeError>{errores.precioCosto}</MensajeError>
            {Number(precio) > 0 && (
              <small className="campo-ayuda">
                Debe ser menor al precio de venta (
                {formatearMoneda(precio)}).
              </small>
            )}
          </label>

          <label className="campo-comercial">
            <span>Código del proveedor</span>
            <input
              type="text"
              value={codigoProveedor}
              onChange={(evento) => setCodigoProveedor(evento.target.value)}
            />
          </label>

          {esEdicion && (
            <p className="comercial-nota ancho-completo">
              Se edita el costo del proveedor seleccionado. Los demás costos se
              administran desde Proveedores.
            </p>
          )}

          <label className="campo-comercial ancho-completo">
            <span>Descripción</span>
            <input
              type="text"
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
          </label>

          <div className="campo-comercial ancho-completo">
            <span>Sucursales activas *</span>
            <div className="inventario-sucursales">
              {sucursales.map((sucursal) => (
                <label key={sucursal.id} className="campo-checkbox">
                  <input
                    type="checkbox"
                    checked={seleccionadas.includes(sucursal.id)}
                    onChange={() => alternarSucursal(sucursal.id)}
                  />
                  <span>{sucursal.nombre}</span>
                </label>
              ))}
            </div>
            <MensajeError>{errores.sucursales}</MensajeError>
          </div>

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
                'Guardar producto'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>

      {catalogoRapido && (
        <FormularioCatalogo
          tipo={catalogoRapido}
          onCerrar={() => setCatalogoRapido(null)}
          onGuardado={(nuevo) => {
            onCatalogoCreado?.(catalogoRapido, nuevo)
            if (catalogoRapido === 'categorias') {
              setCategoria(String(nuevo.id))
            } else if (catalogoRapido === 'marcas') {
              setMarca(String(nuevo.id))
            } else if (catalogoRapido === 'unidades') {
              setUnidad(String(nuevo.id))
            }
            setCatalogoRapido(null)
          }}
        />
      )}

      {proveedorRapido && (
        <FormularioProveedor
          sucursales={sucursales}
          sucursalActiva={sucursalActiva}
          onCerrar={() => setProveedorRapido(false)}
          onGuardado={(nuevo) => {
            setProveedor(String(nuevo.id))
            setProveedorSeleccionado(nuevo)
            setProveedorRapido(false)
          }}
        />
      )}
    </>
  )
}
