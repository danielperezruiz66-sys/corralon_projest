import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconLoader2, IconTruck, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { useSucursal } from '../../context/sucursal-context'
import MensajeError from '../common/MensajeError.jsx'
import {
  normalizarDocumento,
  validarEmail,
  validarTelefono,
  validarTexto,
} from '../../utils/validaciones'

export default function FormularioProveedor({
  proveedor = null,
  onCerrar,
  onGuardado,
}) {
  const { sucursalActiva } = useSucursal()
  const esEdicion = Boolean(proveedor?.id)
  const [cuit, setCuit] = useState(proveedor?.cuit || '')
  const [nombre, setNombre] = useState(proveedor?.nombre || '')
  const [razonSocial, setRazonSocial] = useState(proveedor?.razon_social || '')
  const [contacto, setContacto] = useState(proveedor?.contacto || '')
  const [email, setEmail] = useState(proveedor?.email_prov || '')
  const [estado, setEstado] = useState(proveedor?.estado_prov ?? true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {}
    const cuitNumero = normalizarDocumento(cuit)

    if (!cuitNumero) {
      nuevos.cuit = 'Ingresá el CUIT.'
    } else if (!/^\d{11}$/.test(cuitNumero)) {
      nuevos.cuit =
        'El CUIT debe tener 11 números, sin letras ni símbolos.'
    }

    const errorNombre = validarTexto(nombre, 'El nombre', {
      min: 2,
      max: 80,
    })
    if (errorNombre) {
      nuevos.nombre = errorNombre
    }

    const errorRazon = validarTexto(razonSocial, 'La razón social', {
      min: 2,
      max: 100,
    })
    if (errorRazon) {
      nuevos.razon_social = errorRazon
    }

    const errorContacto =
      validarTexto(contacto, 'El contacto', { min: 0, max: 30 }) ||
      validarTelefono(contacto)
    if (errorContacto) {
      nuevos.contacto = errorContacto
    }

    const errorEmail =
      validarTexto(email, 'El email', { min: 0, max: 80 }) ||
      validarEmail(email)
    if (errorEmail) {
      nuevos.email_prov = errorEmail
    }

    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    if (!sucursalActiva) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar el proveedor',
        text: 'Faltan datos de configuración de tu usuario. Contactá al administrador.',
        confirmButtonColor: '#4a9da8',
      })
      return
    }

    setErrores({})
    setGuardando(true)
    try {
      const guardado = await pedir(
        esEdicion ? `/proveedores/${proveedor.id}/` : '/proveedores/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({
            cuit: cuitNumero,
            nombre: nombre.trim(),
            razon_social: razonSocial.trim(),
            contacto: contacto.trim() || null,
            email_prov: email.trim() || null,
            estado_prov: estado,
            sucursales: [Number(sucursalActiva)],
          }),
        },
      )
      onGuardado?.(guardado, esEdicion)
    } catch (e) {
      const campos = { ...(e.campos || {}) }
      const errorAsociacion = campos.sucursales
      delete campos.sucursales
      if (Object.keys(campos).length > 0) {
        setErrores(campos)
        requestAnimationFrame(() => {
          document.querySelector('.input-error')?.focus()
        })
        return
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar el proveedor',
        text: errorAsociacion
          ? 'Verificá la configuración de tu usuario e intentá de nuevo.'
          : e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconTruck size={24} />
            {esEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}
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
          <label className="campo-comercial">
            <span>CUIT *</span>
            <input
              type="text"
              inputMode="numeric"
              className={errores.cuit ? 'input-error' : ''}
              value={cuit}
              onChange={(evento) => setCuit(evento.target.value)}
            />
            <MensajeError>{errores.cuit}</MensajeError>
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

          <label className="campo-comercial ancho-completo">
            <span>Razón social *</span>
            <input
              type="text"
              className={errores.razon_social ? 'input-error' : ''}
              value={razonSocial}
              onChange={(evento) => setRazonSocial(evento.target.value)}
            />
            <MensajeError>{errores.razon_social}</MensajeError>
          </label>

          <label className="campo-comercial">
            <span>Contacto</span>
            <input
              type="text"
              inputMode="tel"
              className={errores.contacto ? 'input-error' : ''}
              value={contacto}
              onChange={(evento) => setContacto(evento.target.value)}
            />
            <MensajeError>{errores.contacto}</MensajeError>
          </label>

          <label className="campo-comercial">
            <span>Email</span>
            <input
              type="email"
              className={errores.email_prov ? 'input-error' : ''}
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
            />
            <MensajeError>{errores.email_prov}</MensajeError>
          </label>

          <label className="campo-checkbox ancho-completo">
            <input
              type="checkbox"
              checked={estado}
              onChange={(evento) => setEstado(evento.target.checked)}
            />
            <span>Proveedor activo</span>
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
                'Guardar proveedor'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
