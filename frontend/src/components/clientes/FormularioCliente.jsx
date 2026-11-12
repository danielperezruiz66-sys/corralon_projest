import { useForm } from 'react-hook-form'
import Swal from 'sweetalert2'
import {
  IconAddressBook,
  IconLoader2,
  IconPencil,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'
import {
  documentoNormalizado,
  validarDocumento,
  validarEmail,
  validarIngresosBrutos,
  validarNombre,
  validarRazonSocial,
  validarTelefono,
} from '../../utils/validaciones'
import '../../styles/Clientes.css'

const TIPOS_DOCUMENTO = [
  { valor: '', etiqueta: 'Sin especificar' },
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'CUIT', etiqueta: 'CUIT' },
  { valor: 'CUIL', etiqueta: 'CUIL' },
  { valor: 'PAS', etiqueta: 'Pasaporte' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const CONDICIONES_IVA = [
  { valor: 'CF', etiqueta: 'Consumidor Final' },
  { valor: 'RI', etiqueta: 'Responsable Inscripto' },
  { valor: 'MT', etiqueta: 'Monotributista' },
  { valor: 'EX', etiqueta: 'Exento' },
  { valor: 'NC', etiqueta: 'No Categorizado' },
]

export default function FormularioCliente({
  cliente = null,
  onCerrar,
  onCreado,
  onGuardado,
}) {
  const esEdicion = Boolean(cliente?.id)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      razon_social: cliente?.razon_social ?? '',
      tipo_documento: cliente?.tipo_documento ?? '',
      dni: cliente?.dni ?? '',
      condicion_iva: cliente?.condicion_iva ?? 'CF',
      ingresos_brutos: cliente?.ingresos_brutos ?? '',
      nombre: cliente?.nombre ?? '',
      apellido: cliente?.apellido ?? '',
      telefono: cliente?.telefono ?? '',
      email: cliente?.email ?? '',
      direccion: cliente?.direccion ?? '',
      notas: cliente?.notas ?? '',
      estado: cliente?.estado ?? true,
    },
  })

  function cerrar() {
    reset()
    onCerrar?.()
  }

  async function guardar(valores) {
    const limpio = Object.fromEntries(
      Object.entries(valores).map(([campo, valor]) => {
        if (typeof valor === 'boolean') {
          return [campo, valor]
        }
        if (typeof valor === 'string') {
          return [campo, valor.trim() ? valor.trim() : null]
        }
        return [campo, valor]
      }),
    )
    limpio.dni = documentoNormalizado(
      limpio.tipo_documento,
      limpio.dni,
    )

    const erroresManuales = []
    const marcar = (campo, mensaje) => {
      setError(campo, { type: 'manual', message: mensaje })
      erroresManuales.push(campo)
    }

    if (!limpio.razon_social && !(limpio.nombre && limpio.apellido)) {
      marcar(
        'razon_social',
        'Ingresá la razón social o el nombre y apellido completos.',
      )
    }
    if (!limpio.tipo_documento) {
      marcar('tipo_documento', 'Seleccioná el tipo de documento.')
    }
    if (!limpio.dni) {
      marcar('dni', 'Ingresá el DNI/CUIT.')
    }
    if (!limpio.telefono && !limpio.email) {
      marcar('telefono', 'Ingresá un teléfono o un email.')
      marcar('email', 'Ingresá un teléfono o un email.')
    }

    if (erroresManuales.length > 0) {
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    try {
      const guardado = await pedir(
        esEdicion ? `/clientes/${cliente.id}/` : '/clientes/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify(limpio),
        },
      )
      reset()
      if (onGuardado) {
        onGuardado(guardado, esEdicion)
      } else {
        onCreado?.(guardado)
      }
    } catch (e) {
      if (e.campos) {
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          setError(campo, { type: 'server', message: mensaje })
        })
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      Swal.fire({
        icon: 'error',
        title: esEdicion ? 'No se pudo actualizar' : 'No se pudo registrar',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    }
  }

  return (
    <div className="modal-fondo modal-fondo-superior" role="dialog" aria-modal="true">
      <div className="modal-tarjeta">
        <div className="modal-cabecera">
          <h2>
            {esEdicion ? (
              <IconPencil size={24} />
            ) : (
              <IconAddressBook size={24} />
            )}
            {esEdicion ? 'Editar cliente' : 'Registrar cliente'}
          </h2>
          <button
            type="button"
            className="modal-cerrar"
            onClick={cerrar}
            aria-label="Cerrar"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(guardar)} className="cliente-form" noValidate>
          <div className="form-grid">
            <label className="campo-formulario ancho-completo">
              <span>Razón social</span>
              <input
                type="text"
                className={errors.razon_social ? 'input-error' : ''}
                placeholder="Ej. Materiales del Sur SRL"
                {...register('razon_social', {
                  maxLength: {
                    value: 100,
                    message: 'La razón social no puede superar 100 caracteres.',
                  },
                  validate: (valor) => validarRazonSocial(valor) || true,
                })}
              />
              <small className="campo-ayuda">
                Completá razón social o nombre y apellido.
              </small>
              <MensajeError>{errors.razon_social?.message}</MensajeError>
            </label>

            <label className="campo-formulario">
              <span>Tipo de documento *</span>
              <select
                className={errors.tipo_documento ? 'input-error' : ''}
                {...register('tipo_documento', {
                  required: 'Seleccioná el tipo de documento.',
                })}
              >
                {TIPOS_DOCUMENTO.map((tipo) => (
                  <option key={tipo.valor || 'sin'} value={tipo.valor}>
                    {tipo.etiqueta}
                  </option>
                ))}
              </select>
              <MensajeError>{errors.tipo_documento?.message}</MensajeError>
            </label>

            <label className="campo-formulario">
              <span>DNI / CUIT / CUIL *</span>
              <input
                type="text"
                inputMode="numeric"
                className={errors.dni ? 'input-error' : ''}
                placeholder="Ej. 20123456789"
                {...register('dni', {
                  required: 'Ingresá el DNI/CUIT.',
                  maxLength: {
                    value: 15,
                    message: 'El documento no puede superar 15 caracteres.',
                  },
                  validate: (valor) => {
                    const error = validarDocumento(
                      getValues('tipo_documento'),
                      valor,
                    )
                    return error || true
                  },
                })}
              />
              <MensajeError>{errors.dni?.message}</MensajeError>
            </label>

            <label className="campo-formulario">
              <span>Condición IVA</span>
              <select {...register('condicion_iva')}>
                {CONDICIONES_IVA.map((condicion) => (
                  <option key={condicion.valor} value={condicion.valor}>
                    {condicion.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label className="campo-formulario">
              <span>Ingresos brutos</span>
              <input
                type="text"
                className={errors.ingresos_brutos ? 'input-error' : ''}
                placeholder="Opcional"
                {...register('ingresos_brutos', {
                  maxLength: {
                    value: 30,
                    message: 'Ingresos brutos no puede superar 30 caracteres.',
                  },
                  validate: (valor) =>
                    validarIngresosBrutos(valor) || true,
                })}
              />
              <MensajeError>{errors.ingresos_brutos?.message}</MensajeError>
            </label>

            <label className="campo-formulario">
              <span>Nombre</span>
              <input
                type="text"
                className={errors.nombre ? 'input-error' : ''}
                {...register('nombre', {
                  maxLength: {
                    value: 50,
                    message: 'El nombre no puede superar 50 caracteres.',
                  },
                  validate: (valor) =>
                    validarNombre(valor, 'El nombre') || true,
                })}
              />
              <MensajeError>{errors.nombre?.message}</MensajeError>
            </label>

            <label className="campo-formulario">
              <span>Apellido</span>
              <input
                type="text"
                className={errors.apellido ? 'input-error' : ''}
                {...register('apellido', {
                  maxLength: {
                    value: 50,
                    message: 'El apellido no puede superar 50 caracteres.',
                  },
                  validate: (valor) =>
                    validarNombre(valor, 'El apellido') || true,
                })}
              />
              <MensajeError>{errors.apellido?.message}</MensajeError>
            </label>

            <label className="campo-formulario">
              <span>Teléfono</span>
              <input
                type="tel"
                inputMode="tel"
                className={errors.telefono ? 'input-error' : ''}
                {...register('telefono', {
                  maxLength: {
                    value: 20,
                    message: 'El teléfono no puede superar 20 caracteres.',
                  },
                  validate: (valor) =>
                    validarTelefono(valor) || true,
                })}
              />
              <MensajeError>{errors.telefono?.message}</MensajeError>
            </label>

            <label className="campo-formulario">
              <span>Email</span>
              <input
                type="email"
                className={errors.email ? 'input-error' : ''}
                {...register('email', {
                  maxLength: {
                    value: 80,
                    message: 'El email no puede superar 80 caracteres.',
                  },
                  validate: (valor) => validarEmail(valor) || true,
                })}
              />
              <MensajeError>{errors.email?.message}</MensajeError>
            </label>

            <small className="campo-ayuda ancho-completo">
              Completá al menos un teléfono o un email.
            </small>

            <label className="campo-formulario ancho-completo">
              <span>Dirección</span>
              <input
                type="text"
                className={errors.direccion ? 'input-error' : ''}
                placeholder="Calle, número, piso..."
                {...register('direccion', {
                  maxLength: {
                    value: 120,
                    message: 'La dirección no puede superar 120 caracteres.',
                  },
                })}
              />
              <MensajeError>{errors.direccion?.message}</MensajeError>
            </label>

            <label className="campo-checkbox ancho-completo">
              <input type="checkbox" {...register('estado')} />
              <span>Cliente activo para operar</span>
            </label>

            <label className="campo-formulario ancho-completo">
              <span>Notas internas</span>
              <textarea
                rows="3"
                className={errors.notas ? 'input-error' : ''}
                placeholder="Observaciones, condiciones comerciales, etc."
                {...register('notas', {
                  maxLength: {
                    value: 1000,
                    message: 'Las notas no pueden superar 1000 caracteres.',
                  },
                })}
              />
              <MensajeError>{errors.notas?.message}</MensajeError>
            </label>
          </div>

          <div className="modal-acciones">
            <button type="button" className="boton-secundario" onClick={cerrar}>
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
              ) : esEdicion ? (
                'Guardar cambios'
              ) : (
                'Guardar cliente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
