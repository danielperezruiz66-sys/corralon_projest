import { useCallback, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconBox,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { validarNumero, validarTexto } from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'

let siguienteFila = 0

function nuevaFila() {
  siguienteFila += 1
  return {
    id: siguienteFila,
    producto: '',
    productoObjeto: null,
    lote: '',
    fechaVenc: '',
    cantidad: '',
  }
}

function depositoPredeterminado(depositos, sucursal) {
  const opciones = depositos.filter(
    (item) => String(item.sucursal) === String(sucursal),
  )
  return (
    opciones.find((item) => item.es_predeterminado) ||
    opciones[0] ||
    null
  )
}

export default function FormularioCargaStock({
  sucursales = [],
  depositos = [],
  sucursalActiva = '',
  onCerrar,
  onGuardado,
}) {
  const sucursalInicial =
    sucursalActiva || (sucursales[0] ? String(sucursales[0].id) : '')
  const depositoInicial = depositoPredeterminado(
    depositos,
    sucursalInicial,
  )
  const [sucursal, setSucursal] = useState(sucursalInicial)
  const [deposito, setDeposito] = useState(
    depositoInicial ? String(depositoInicial.id) : '',
  )
  const [motivo, setMotivo] = useState('')
  const [filas, setFilas] = useState([nuevaFila()])
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')

  const depositosSucursal = depositos.filter(
    (item) => String(item.sucursal) === String(sucursal),
  )

  const buscarProductos = useCallback(
    async (texto) => {
      if (!sucursal) {
        return []
      }
      const parametros = new URLSearchParams({
        sucursal,
        search: texto,
        page: '1',
      })
      const respuesta = await pedir(
        `/productos/?${parametros.toString()}`,
      )
      return respuesta.results || []
    },
    [sucursal],
  )

  function cambiarSucursal(valor) {
    setSucursal(valor)
    const predeterminado = depositoPredeterminado(depositos, valor)
    setDeposito(predeterminado ? String(predeterminado.id) : '')
    setFilas([nuevaFila()])
    setErrores({})
    setErrorGeneral('')
  }

  function actualizarFila(id, campo, valor, objeto = null) {
    setFilas((previas) =>
      previas.map((fila) => {
        if (fila.id !== id) {
          return fila
        }
        const cambios = { [campo]: valor }
        if (campo === 'producto') {
          cambios.productoObjeto = objeto
        }
        return { ...fila, ...cambios }
      }),
    )
  }

  function agregarFila() {
    setFilas((previas) => [...previas, nuevaFila()])
  }

  function quitarFila(id) {
    setFilas((previas) =>
      previas.length === 1
        ? previas
        : previas.filter((fila) => fila.id !== id),
    )
  }

  function validar() {
    const nuevos = { filas: {} }
    if (!sucursal) {
      nuevos.sucursal = 'Seleccioná la sucursal.'
    }
    if (!deposito) {
      nuevos.deposito = 'Seleccioná el depósito.'
    } else if (!depositosSucursal.some((item) => String(item.id) === deposito)) {
      nuevos.deposito = 'El depósito debe pertenecer a la sucursal.'
    }
    const errorMotivo = validarTexto(motivo, 'El motivo', {
      min: 3,
      max: 90,
    })
    if (errorMotivo) {
      nuevos.motivo = errorMotivo
    }

    const usados = new Set()
    filas.forEach((fila) => {
      const erroresFila = {}
      if (!fila.producto) {
        erroresFila.producto = 'Seleccioná un producto.'
      } else if (usados.has(fila.producto)) {
        erroresFila.producto = 'No repitas el mismo producto.'
      } else {
        usados.add(fila.producto)
      }
      const errorLote = validarTexto(fila.lote, 'El lote', {
        min: 1,
        max: 30,
      })
      if (errorLote) {
        erroresFila.lote = errorLote
      }
      const errorCantidad = validarNumero(fila.cantidad, {
        etiqueta: 'La cantidad',
        mayorQueCero: true,
        decimales: 3,
      })
      if (errorCantidad) {
        erroresFila.cantidad = errorCantidad
      }
      if (fila.fechaVenc) {
        const fecha = new Date(`${fila.fechaVenc}T00:00:00`)
        if (Number.isNaN(fecha.getTime())) {
          erroresFila.fechaVenc = 'La fecha de vencimiento no es válida.'
        }
      }
      if (Object.keys(erroresFila).length > 0) {
        nuevos.filas[fila.id] = erroresFila
      }
    })

    const hayFilas = Object.keys(nuevos.filas).length > 0
    const hayErrores =
      hayFilas ||
      nuevos.sucursal ||
      nuevos.deposito ||
      nuevos.motivo
    setErrores(nuevos)
    if (hayErrores) {
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
    }
    return !hayErrores
  }

  async function guardar(evento) {
    evento.preventDefault()
    if (!validar()) {
      return
    }

    setGuardando(true)
    setErrorGeneral('')
    try {
      const respuesta = await pedir('/stocks/carga-masiva/', {
        method: 'POST',
        body: JSON.stringify({
          sucursal: Number(sucursal),
          deposito: Number(deposito),
          motivo: motivo.trim(),
          items: filas.map((fila) => ({
            producto: Number(fila.producto),
            cantidad: Number(fila.cantidad).toFixed(3),
            lote: fila.lote.trim(),
            fecha_venc: fila.fechaVenc || null,
          })),
        }),
      })
      onGuardado?.(respuesta)
    } catch (e) {
      const datos = e.datos || {}
      const erroresApi = {}
      const mapaCampos = { fecha_venc: 'fechaVenc' }
      const erroresItems = {}

      if (Array.isArray(datos.items)) {
        datos.items.forEach((detalle, indice) => {
          const fila = filas[indice]
          if (!fila || !detalle || typeof detalle !== 'object') {
            return
          }
          const deFila = {}
          Object.entries(detalle).forEach(([campo, mensaje]) => {
            deFila[mapaCampos[campo] || campo] = Array.isArray(mensaje)
              ? mensaje.join(' ')
              : String(mensaje)
          })
          if (Object.keys(deFila).length > 0) {
            erroresItems[fila.id] = deFila
          }
        })
      }

      if (e.campos) {
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          if (campo === 'items' && Array.isArray(datos.items)) {
            return
          }
          erroresApi[campo] = mensaje
        })
      } else if (datos.detail) {
        erroresApi.items = datos.detail
      }

      if (Object.keys(erroresItems).length > 0) {
        erroresApi.filas = erroresItems
      }

      if (Object.keys(erroresApi).length > 0) {
        setErrores(erroresApi)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }

      setErrorGeneral(e.message)
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cargar el stock',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal inventario-modal-ancho">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconBox size={24} />
            Carga de stock por sucursal
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

        <p className="comercial-nota">
          La carga suma cantidad al stock existente. El lote es obligatorio;
          la fecha de vencimiento es opcional.
        </p>

        <form onSubmit={guardar} noValidate>
          <div className="comercial-grid">
            <CampoSelectorBuscable
              etiqueta="Sucursal *"
              valor={sucursal}
              onCambiar={cambiarSucursal}
              opciones={sucursales}
              textoOpcion={(item) => item.nombre}
              placeholder="Buscar sucursal"
              error={Boolean(errores.sucursal)}
              mensajeError={errores.sucursal}
            />
            <CampoSelectorBuscable
              etiqueta="Depósito *"
              valor={deposito}
              onCambiar={setDeposito}
              opciones={depositosSucursal}
              textoOpcion={(item) => item.nombre}
              placeholder={
                depositosSucursal.length === 0
                  ? 'No hay depósitos en la sucursal'
                  : 'Buscar depósito'
              }
              error={Boolean(errores.deposito)}
              mensajeError={errores.deposito}
            />
            <label className="campo-comercial ancho-completo">
              <span>Motivo *</span>
              <input
                type="text"
                className={errores.motivo ? 'input-error' : ''}
                value={motivo}
                maxLength={90}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Ej. Carga inicial, reposición, conteo"
              />
              <MensajeError>{errores.motivo}</MensajeError>
            </label>
          </div>

          <div className="carga-stock-lista">
            {filas.map((fila) => {
              const erroresFila = errores.filas?.[fila.id] || {}
              return (
                <div className="carga-stock-fila" key={fila.id}>
                  <div className="carga-stock-producto">
                    <CampoSelectorBuscable
                      etiqueta="Producto *"
                      valor={fila.producto}
                      onCambiar={(valor, opcion) =>
                        actualizarFila(
                          fila.id,
                          'producto',
                          valor,
                          opcion,
                        )
                      }
                      opciones={[]}
                      opcionSeleccionada={fila.productoObjeto}
                      onBuscar={buscarProductos}
                      textoOpcion={(item) => item.nombre}
                      textoSecundario={(item) =>
                        `${item.codigo} · ${item.unidad_detalle}`
                      }
                      placeholder={
                        sucursal
                          ? 'Buscar por código o nombre'
                          : 'Elegí una sucursal'
                      }
                      deshabilitado={!sucursal}
                      error={Boolean(erroresFila.producto)}
                    />
                    <MensajeError>{erroresFila.producto}</MensajeError>
                  </div>
                  <label className="campo-comercial">
                    <span>Lote *</span>
                    <input
                      type="text"
                      className={erroresFila.lote ? 'input-error' : ''}
                      value={fila.lote}
                      maxLength={30}
                      onChange={(evento) =>
                        actualizarFila(
                          fila.id,
                          'lote',
                          evento.target.value,
                        )
                      }
                    />
                    <MensajeError>{erroresFila.lote}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Vencimiento</span>
                    <input
                      type="date"
                      className={
                        erroresFila.fechaVenc ? 'input-error' : ''
                      }
                      value={fila.fechaVenc}
                      onChange={(evento) =>
                        actualizarFila(
                          fila.id,
                          'fechaVenc',
                          evento.target.value,
                        )
                      }
                    />
                    <MensajeError>{erroresFila.fechaVenc}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Cantidad *</span>
                    <input
                      type="number"
                      className={
                        erroresFila.cantidad ? 'input-error' : ''
                      }
                      min="0.001"
                      step="0.001"
                      value={fila.cantidad}
                      onChange={(evento) =>
                        actualizarFila(
                          fila.id,
                          'cantidad',
                          evento.target.value,
                        )
                      }
                    />
                    <MensajeError>{erroresFila.cantidad}</MensajeError>
                  </label>
                  <div className="carga-stock-accion">
                    {filas.length > 1 && (
                      <button
                        type="button"
                        className="boton-icono boton-icono-peligro"
                        onClick={() => quitarFila(fila.id)}
                        title="Quitar producto"
                      >
                        <IconTrash size={17} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {errores.items && (
            <MensajeError>
              {typeof errores.items === 'string'
                ? errores.items
                : 'Revisá los productos de la carga.'}
            </MensajeError>
          )}

          <div className="carga-stock-pie">
            <button
              type="button"
              className="boton-comercial-secundario"
              onClick={agregarFila}
            >
              <IconPlus size={17} />
              Agregar producto
            </button>
            <span>
              {filas.length} producto{filas.length === 1 ? '' : 's'}
            </span>
          </div>

          {errorGeneral && (
            <p className="comercial-error">{errorGeneral}</p>
          )}

          <div className="comercial-modal-acciones">
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
                  Cargando…
                </>
              ) : (
                'Cargar stock'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
