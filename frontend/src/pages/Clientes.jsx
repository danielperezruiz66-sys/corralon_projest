import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconAddressBook,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import '../styles/Clientes.css'

const PAGINA_VACIA = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

function nombreCliente(cliente) {
  if (cliente.razon_social) {
    return cliente.razon_social
  }
  const nombre = [cliente.apellido, cliente.nombre].filter(Boolean).join(', ')
  return nombre || `Cliente #${cliente.id}`
}

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [datos, setDatos] = useState(PAGINA_VACIA)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [refresco, setRefresco] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(
    () => searchParams.get('nuevo') === '1',
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let vigente = true
    const parametros = new URLSearchParams({ page: String(pagina) })
    if (busqueda) {
      parametros.set('search', busqueda)
    }

    pedir(`/clientes/?${parametros.toString()}`)
      .then((respuesta) => {
        if (vigente) {
          setDatos(respuesta)
          setError('')
        }
      })
      .catch((e) => {
        if (vigente) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [pagina, busqueda, refresco])

  function buscar(evento) {
    evento.preventDefault()
    setCargando(true)
    setError('')
    setPagina(1)
    setBusqueda(texto.trim())
    setRefresco((valor) => valor + 1)
  }

  function limpiar() {
    setCargando(true)
    setError('')
    setTexto('')
    setBusqueda('')
    setPagina(1)
    setRefresco((valor) => valor + 1)
  }

  function irAPagina(nueva) {
    setCargando(true)
    setError('')
    setPagina(nueva)
  }

  function abrirModal() {
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    reset()
  }

  async function guardar(valores) {
    const limpio = Object.fromEntries(
      Object.entries(valores).map(([campo, valor]) => [
        campo,
        valor?.trim() ? valor.trim() : null,
      ]),
    )

    if (!limpio.razon_social && !limpio.nombre && !limpio.apellido) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Ingresá la razón social o al menos el nombre y apellido.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    try {
      await pedir('/clientes/', {
        method: 'POST',
        body: JSON.stringify(limpio),
      })
      Swal.fire({
        icon: 'success',
        title: 'Cliente registrado',
        timer: 1500,
        showConfirmButton: false,
      })
      cerrarModal()
      setRefresco((valor) => valor + 1)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  return (
    <>
      <Encabezado
        titulo="Clientes"
        subtitulo="Alta y consulta de clientes"
      />

      <div className="clientes">
        <section className="clientes-barra">
          <form className="clientes-busqueda" onSubmit={buscar}>
            <IconSearch size={20} />
            <input
              type="search"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Buscar por DNI, razón social, nombre o email"
              aria-label="Buscar clientes"
            />
            <button type="submit" className="boton-secundario">
              Buscar
            </button>
            {(texto || busqueda) && (
              <button type="button" className="boton-secundario" onClick={limpiar}>
                Limpiar
              </button>
            )}
          </form>

          <button type="button" className="boton-primario" onClick={abrirModal}>
            <IconPlus size={18} />
            Nuevo cliente
          </button>
        </section>

        {error && <p className="clientes-error">{error}</p>}

        <section className="clientes-panel">
          <div className="clientes-tabla-scroll">
            <table className="tabla-clientes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Condición IVA</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan="5" className="clientes-vacio">
                      Cargando clientes…
                    </td>
                  </tr>
                )}

                {!cargando && !error && datos.results.length === 0 && (
                  <tr>
                    <td colSpan="5" className="clientes-vacio">
                      No se encontraron clientes.
                    </td>
                  </tr>
                )}

                {!cargando &&
                  datos.results.map((cliente) => (
                    <tr key={cliente.id}>
                      <td>
                        <strong>{nombreCliente(cliente)}</strong>
                      </td>
                      <td>{cliente.dni || '—'}</td>
                      <td>{cliente.telefono || '—'}</td>
                      <td>{cliente.email || '—'}</td>
                      <td>{cliente.condicion_iva || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="clientes-paginacion">
            <span>
              {datos.count} cliente{datos.count === 1 ? '' : 's'}
            </span>
            <div>
              <button
                type="button"
                className="boton-secundario"
                disabled={!datos.previous || cargando}
                onClick={() => irAPagina(pagina - 1)}
              >
                Anterior
              </button>
              <span>Página {pagina}</span>
              <button
                type="button"
                className="boton-secundario"
                disabled={!datos.next || cargando}
                onClick={() => irAPagina(pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </div>

      {modalAbierto && (
        <div className="modal-fondo" role="dialog" aria-modal="true">
          <div className="modal-tarjeta">
            <div className="modal-cabecera">
              <h2>
                <IconAddressBook size={24} />
                Registrar cliente
              </h2>
              <button
                type="button"
                className="modal-cerrar"
                onClick={cerrarModal}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(guardar)} className="cliente-form">
              <div className="form-grid">
                <label className="campo-formulario ancho-completo">
                  <span>Razón social</span>
                  <input
                    type="text"
                    placeholder="Ej. Materiales del Sur SRL"
                    {...register('razon_social')}
                  />
                </label>

                <label className="campo-formulario">
                  <span>DNI / CUIT</span>
                  <input
                    type="text"
                    placeholder="Opcional"
                    {...register('dni')}
                  />
                </label>

                <label className="campo-formulario">
                  <span>Condición IVA</span>
                  <input
                    type="text"
                    placeholder="Ej. Responsable Inscripto"
                    {...register('condicion_iva')}
                  />
                </label>

                <label className="campo-formulario">
                  <span>Nombre</span>
                  <input type="text" {...register('nombre')} />
                  {errors.nombre && (
                    <small className="mensaje-error-campo">
                      {errors.nombre.message}
                    </small>
                  )}
                </label>

                <label className="campo-formulario">
                  <span>Apellido</span>
                  <input type="text" {...register('apellido')} />
                </label>

                <label className="campo-formulario">
                  <span>Teléfono</span>
                  <input type="tel" {...register('telefono')} />
                </label>

                <label className="campo-formulario">
                  <span>Email</span>
                  <input type="email" {...register('email')} />
                </label>

                <label className="campo-formulario ancho-completo">
                  <span>Dirección</span>
                  <input type="text" {...register('direccion')} />
                </label>
              </div>

              <div className="modal-acciones">
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="boton-primario"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <IconLoader2 className="icono-girando" size={18} />
                      Guardando…
                    </>
                  ) : (
                    'Guardar cliente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
