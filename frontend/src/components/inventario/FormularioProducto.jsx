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
  const [duplicados, setDuplicados] = useState({})
  const [tocados, setTocados] = useState({})

  function calcularErrores() {
    const nuevos = {}
    const errorCodigo = validarCodigo(codigo)
    if (errorCodigo) {
      nuevos.codigo = `${errorCodigo} Ejemplo: CEM-50.`
    } else if (duplicados.codigo) {
      nuevos.codigo = duplicados.codigo
    }
    const errorNombre = validarTexto(nombre, 'El nombre', {
      min: 2,
      max: 80,
    })
    if (errorNombre) {
      nuevos.nombre = errorNombre
    } else if (duplicados.nombre) {
      nuevos.nombre = duplicados.nombre
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
      nuevos.proveedor =
        'Seleccioná un proveedor activo. Usá el botón + para crear uno nuevo.'
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
      )}). Subí el precio de venta o bajá el costo.`
    }
    if (seleccionadas.length === 0) {
      nuevos.sucursales = 'Seleccioná al menos una sucursal.'
    }
    return nuevos
  }

  const erroresCalculados = calcularErrores()
  const formularioValido = Object.keys(erroresCalculados).length === 0

  function marcarTocado(campo) {
    setTocados((previos) => ({ ...previos, [campo]: true }))
  }

  function mensaje(campo) {
    return errores[campo] || (tocados[campo] ? erroresCalculados[campo] : '')
  }

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

  useEffect(() => {
    let vigente = true
    const codigoLimpio = codigo.trim()
    const nombreLimpio = nombre.trim()

    const temporizador = window.setTimeout(async () => {
      if (!codigoLimpio && !nombreLimpio) {
        if (vigente) {
          setDuplicados({})
        }
        return
      }
      const tareas = []
      if (codigoLimpio) {
        tareas.push(
          pedir(
            `/productos/?search=${encodeURIComponent(
              codigoLimpio,
            )}&page=1`,
          )
            .then((datos) => ({ tipo: 'codigo', datos }))
            .catch(() => null),
        )
      }
      if (nombreLimpio && marca) {
        tareas.push(
          pedir(
            `/productos/?search=${encodeURIComponent(
              nombreLimpio,
            )}&marca=${marca}&page=1`,
          )
            .then((datos) => ({ tipo: 'nombre', datos }))
            .catch(() => null),
        )
      }

      const resultados = (await Promise.all(tareas)).filter(Boolean)
      if (!vigente) {
        return
      }
      const otros = (datos) =>
        (datos?.results || []).filter(
          (item) => !producto?.id || Number(item.id) !== Number(producto.id),
        )
      const codigoResultado = resultados.find(
        (item) => item.tipo === 'codigo',
      )
      const nombreResultado = resultados.find(
        (item) => item.tipo === 'nombre',
      )
      const codigoDuplicado = codigoResultado
        ? otros(codigoResultado.datos).some(
            (item) =>
              String(item.codigo || '').trim().toLowerCase() ===
              codigoLimpio.toLowerCase(),
          )
        : false
      const nombreDuplicado = nombreResultado
        ? otros(nombreResultado.datos).some(
            (item) =>
              Number(item.marca) === Number(marca) &&
              String(item.nombre || '').trim().toLowerCase() ===
                nombreLimpio.toLowerCase(),
          )
        : false

      setDuplicados({
        codigo: codigoDuplicado
          ? 'Ya existe un producto con ese código.'
          : '',
        nombre: nombreDuplicado
          ? 'Ya existe un producto con ese nombre para la marca seleccionada.'
          : '',
      })
    }, 450)

    return () => {
      vigente = false
      window.clearTimeout(temporizador)
    }
  }, [codigo, nombre, marca, producto?.id])

  function alternarSucursal(id) {
    marcarTocado('sucursales')
    setSeleccionadas((actuales) =>
      actuales.includes(id)
        ? actuales.filter((item) => item !== id)
        : [...actuales, id],
    )
  }

  async function guardar(evento) {
    evento.preventDefault()
    setTocados({
      codigo: true,
      nombre: true,
      categoria: true,
      marca: true,
      unidad: true,
      precio: true,
      proveedor: true,
      precioCosto: true,
      sucursales: true,
    })
    if (!formularioValido) {
      setErrores({})
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
              maxLength={20}
              className={mensaje('codigo') ? 'input-error' : ''}
              value={codigo}
              onChange={(evento) => {
                marcarTocado('codigo')
                setCodigo(evento.target.value)
              }}
            />
            <MensajeError>{mensaje('codigo')}</MensajeError>
          </label>

          <label className="campo-comercial">
            <span>Nombre *</span>
            <input
              type="text"
              maxLength={80}
              className={mensaje('nombre') ? 'input-error' : ''}
              value={nombre}
              onChange={(evento) => {
                marcarTocado('nombre')
                setNombre(evento.target.value)
              }}
            />
            <MensajeError>{mensaje('nombre')}</MensajeError>
          </label>

          <CampoSelectorBuscable
            etiqueta="Categoría *"
            valor={categoria}
            onCambiar={(valor) => {
              marcarTocado('categoria')
              setCategoria(valor)
            }}
            opciones={categorias}
            textoOpcion={(item) => item.categorias}
            placeholder="Buscar categoría"
            onCrear={() => setCatalogoRapido('categorias')}
            tituloCrear="Nueva categoría"
            error={Boolean(mensaje('categoria'))}
            mensajeError={mensaje('categoria')}
          />

          <CampoSelectorBuscable
            etiqueta="Marca *"
            valor={marca}
            onCambiar={(valor) => {
              marcarTocado('marca')
              setMarca(valor)
            }}
            opciones={marcas}
            textoOpcion={(item) => item.marcas}
            placeholder="Buscar marca"
            onCrear={() => setCatalogoRapido('marcas')}
            tituloCrear="Nueva marca"
            error={Boolean(mensaje('marca'))}
            mensajeError={mensaje('marca')}
          />

          <CampoSelectorBuscable
            etiqueta="Unidad *"
            valor={unidad}
            onCambiar={(valor) => {
              marcarTocado('unidad')
              setUnidad(valor)
            }}
            opciones={unidades}
            textoOpcion={(item) => item.unidades}
            textoSecundario={(item) =>
              item.permite_decimales ? 'Con decimales' : 'Entero'
            }
            placeholder="Buscar unidad"
            onCrear={() => setCatalogoRapido('unidades')}
            tituloCrear="Nueva unidad"
            error={Boolean(mensaje('unidad'))}
            mensajeError={mensaje('unidad')}
          />

          <label className="campo-comercial">
            <span>Precio de venta *</span>
            <input
              type="number"
              className={mensaje('precio') ? 'input-error' : ''}
              min="0.01"
              step="0.01"
              value={precio}
              onChange={(evento) => {
                marcarTocado('precio')
                setPrecio(evento.target.value)
              }}
            />
            <MensajeError>{mensaje('precio')}</MensajeError>
            <small className="campo-ayuda">
              Debe ser mayor que cero y superar el costo del proveedor.
            </small>
          </label>

          <CampoSelectorBuscable
            etiqueta="Proveedor *"
            valor={proveedor}
            onCambiar={(valor, opcion) => {
              marcarTocado('proveedor')
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
            onCrear={() => {
              marcarTocado('proveedor')
              setProveedorRapido(true)
            }}
            tituloCrear="Nuevo proveedor"
            error={Boolean(mensaje('proveedor'))}
            mensajeError={mensaje('proveedor')}
          />

          <label className="campo-comercial">
            <span>Precio de costo *</span>
            <input
              type="number"
              className={mensaje('precioCosto') ? 'input-error' : ''}
              min="0.01"
              step="0.01"
              value={precioCosto}
              onChange={(evento) => {
                marcarTocado('precioCosto')
                setPrecioCosto(evento.target.value)
              }}
            />
            <MensajeError>{mensaje('precioCosto')}</MensajeError>
            {Number(precio) > 0 && (
              <small className="campo-ayuda">
                Debe ser mayor que cero y menor al precio de venta (
                {formatearMoneda(precio)}).
              </small>
            )}
          </label>

          <label className="campo-comercial">
            <span>Código del proveedor</span>
            <input
              type="text"
              maxLength={30}
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
              maxLength={150}
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
            <MensajeError>{mensaje('sucursales')}</MensajeError>
            <small className="campo-ayuda">
              El producto se ofrece solo en las sucursales marcadas.
            </small>
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
              disabled={guardando || !formularioValido}
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
          existentes={
            catalogoRapido === 'categorias'
              ? categorias
              : catalogoRapido === 'marcas'
                ? marcas
                : unidades
          }
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
            marcarTocado('proveedor')
            setProveedorRapido(false)
          }}
        />
      )}
    </>
  )
}
