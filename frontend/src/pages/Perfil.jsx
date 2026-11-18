import { useCallback, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconEdit,
  IconKey,
  IconLoader2,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import { pedir } from '../api/client'
import Encabezado from '../components/Encabezado.jsx'
import MensajeError from '../components/common/MensajeError.jsx'
import { useAuth } from '../context/auth-context'
import {
  validarDocumento,
  validarEmail,
  validarFuerzaPassword,
  validarNombre,
  validarTelefono,
} from '../utils/validaciones'
import '../styles/Empleados.css'
import '../styles/Comercial.css'

const CAMPOS_PERSONALES = [
  {
    id: 'nombre',
    etiqueta: 'Nombre',
    tipo: 'text',
    placeholder: 'Tu nombre',
    validar: (valor) => validarNombre(valor, 'El nombre'),
    icono: IconUser,
  },
  {
    id: 'apellido',
    etiqueta: 'Apellido',
    tipo: 'text',
    placeholder: 'Tu apellido',
    validar: (valor) => validarNombre(valor, 'El apellido'),
    icono: IconUser,
  },
  {
    id: 'email',
    etiqueta: 'Email',
    tipo: 'email',
    placeholder: 'tu@correo.com',
    validar: validarEmail,
    icono: null,
  },
  {
    id: 'dni',
    etiqueta: 'DNI',
    tipo: 'text',
    placeholder: '12345678',
    validar: (valor) => validarDocumento('DNI', valor),
    icono: null,
  },
  {
    id: 'telefono',
    etiqueta: 'Teléfono',
    tipo: 'text',
    placeholder: '+54 9 387 1234567',
    validar: validarTelefono,
    icono: null,
  },
]

export default function Perfil() {
  const { user } = useAuth()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [erroresPersonales, setErroresPersonales] = useState({})
  const [erroresPassword, setErroresPassword] = useState({})
  const [valoresPersonales, setValoresPersonales] = useState({
    nombre: '',
    apellido: '',
    email: '',
    dni: '',
    telefono: '',
  })
  const [valoresPassword, setValoresPassword] = useState({
    password_actual: '',
    password_nueva: '',
    password_confirmacion: '',
  })
  const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false)
  const [modalPasswordAbierto, setModalPasswordAbierto] = useState(false)

  const esAdministrador = Boolean(
    user?.is_superuser || (user?.codigos ?? []).includes('AD'),
  )

  const cargar = useCallback(() => {
    setCargando(true)
    setError('')
    pedir('/perfil/')
      .then((perfil) => {
        setDatos(perfil)
        setValoresPersonales({
          nombre: perfil.empleado?.nombre ?? '',
          apellido: perfil.empleado?.apellido ?? '',
          email: perfil.email ?? '',
          dni: perfil.empleado?.dni ?? '',
          telefono: perfil.empleado?.telefono ?? '',
        })
        setCargando(false)
      })
      .catch((e) => {
        setError(e.message)
        setCargando(false)
      })
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function setValorPersonal(campo, valor) {
    setValoresPersonales((actuales) => ({ ...actuales, [campo]: valor }))
    const mensaje = CAMPOS_PERSONALES.find((c) => c.id === campo)?.validar(valor)
    setErroresPersonales((previos) => ({ ...previos, [campo]: mensaje }))
  }

  function setValorPassword(campo, valor) {
    setValoresPassword((actuales) => ({ ...actuales, [campo]: valor }))
    let mensaje = ''
    if (campo === 'password_actual') {
      mensaje = valor ? '' : 'Ingresá tu contraseña actual.'
    } else if (campo === 'password_nueva') {
      mensaje = validarFuerzaPassword(valor)
    } else if (campo === 'password_confirmacion') {
      mensaje =
        valor === '' && valoresPassword.password_nueva !== ''
          ? 'Repetí la contraseña.'
          : valor !== valoresPassword.password_nueva
            ? 'Las contraseñas no coinciden.'
            : ''
    }
    setErroresPassword((previos) => ({ ...previos, [campo]: mensaje }))
  }

  async function guardarPersonales(evento) {
    evento.preventDefault()
    const errores = {}
    const campos = datos.empleado
      ? CAMPOS_PERSONALES
      : CAMPOS_PERSONALES.filter((c) => c.id === 'email')

    campos.forEach((campo) => {
      const mensaje = campo.validar(valoresPersonales[campo.id])
      if (mensaje) {
        errores[campo.id] = mensaje
      }
    })

    if (Object.keys(errores).length > 0) {
      setErroresPersonales(errores)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErroresPersonales({})
    setGuardando(true)
    try {
      const cuerpo = { email: valoresPersonales.email.trim() }
      if (datos.empleado) {
        cuerpo.empleado = {
          nombre: valoresPersonales.nombre.trim(),
          apellido: valoresPersonales.apellido.trim(),
          dni: valoresPersonales.dni.trim(),
          telefono: valoresPersonales.telefono.trim() || null,
        }
      }
      await pedir(`/usuarios/${datos.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(cuerpo),
      })
      Swal.fire({
        icon: 'success',
        title: 'Datos actualizados',
        timer: 1400,
        showConfirmButton: false,
      })
      setModalEdicionAbierto(false)
      cargar()
    } catch (e) {
      const mapeado = { ...erroresPersonales }
      if (e.campos) {
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          mapeado[campo] = mensaje
        })
      }
      // Errores anidados del empleado: { empleado: { dni: [...] } }
      const nested = e.datos?.empleado
      if (nested && typeof nested === 'object') {
        Object.entries(nested).forEach(([campo, valor]) => {
          mapeado[campo] = Array.isArray(valor) ? valor.join(' ') : String(valor)
        })
      }
      setErroresPersonales(mapeado)
      Swal.fire({
        icon: 'error',
        title: 'No se pudieron guardar los datos',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarPasswordPropio(evento) {
    evento.preventDefault()
    const errores = {}

    if (!valoresPassword.password_actual) {
      errores.password_actual = 'Ingresá tu contraseña actual.'
    }
    const mensajeNueva = validarFuerzaPassword(valoresPassword.password_nueva)
    if (mensajeNueva) {
      errores.password_nueva = mensajeNueva
    }
    let mensajeConfirm = ''
    if (
      valoresPassword.password_confirmacion === '' &&
      valoresPassword.password_nueva !== ''
    ) {
      mensajeConfirm = 'Repetí la contraseña.'
    } else if (
      valoresPassword.password_confirmacion !== valoresPassword.password_nueva
    ) {
      mensajeConfirm = 'Las contraseñas no coinciden.'
    }
    if (mensajeConfirm) {
      errores.password_confirmacion = mensajeConfirm
    }

    if (Object.keys(errores).length > 0) {
      setErroresPassword(errores)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErroresPassword({})
    setCambiandoPassword(true)
    try {
      await pedir(`/empleados/${datos.empleado?.id}/cambiar-password/`, {
        method: 'POST',
        body: JSON.stringify({
          password_actual: valoresPassword.password_actual,
          password: valoresPassword.password_nueva,
          password_confirmacion: valoresPassword.password_confirmacion,
        }),
      })
      Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        timer: 1400,
        showConfirmButton: false,
      })
      setModalPasswordAbierto(false)
      setValoresPassword({
        password_actual: '',
        password_nueva: '',
        password_confirmacion: '',
      })
      setCambiandoPassword(false)
    } catch (e) {
      const mapeado = { ...erroresPassword }
      if (e.campos) {
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          mapeado[campo] = mensaje
        })
      }
      setErroresPassword(mapeado)
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cambiar la contraseña',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setCambiandoPassword(false)
    }
  }

  if (cargando) {
    return (
      <>
        <Encabezado
          titulo="Perfil"
          subtitulo="Cuenta y datos personales"
        />
        <div className="comercial comercial-cargando">
          <IconLoader2 className="icono-girando" size={24} />
          <p>Cargando tu perfil…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Encabezado
          titulo="Perfil"
          subtitulo="Cuenta y datos personales"
        />
        <div className="comercial-error">{error}</div>
      </>
    )
  }

  const empleado = datos?.empleado ?? null
  const rolesTexto = (datos?.roles ?? [])
    .map((rol) => `${rol.ocupacion} (${rol.codigo})`)
    .join(' · ') || 'Sin roles asignados'
  const sucursalesTexto = (datos?.sucursales ?? [])
    .map((s) => s.nombre)
    .join(' · ') || 'Sin sucursales asignadas'

  return (
    <>
      <Encabezado
        titulo="Perfil"
        subtitulo="Cuenta y datos personales"
      />

      {/* ===================== TARJETA PRINCIPAL - MODO LECTURA ===================== */}
      <div className="comercial">
        <section className="comercial-panel perfil-tarjeta-principal">
          <div className="perfil-cabecera">
            <div className="perfil-avatar">
              {iniciales(empleado?.nombre ?? user?.nombre ?? '')}
            </div>
            <div className="perfil-datos-basicos">
              <h2 className="perfil-nombre">
                {empleado ? `${empleado.nombre} ${empleado.apellido}` : user?.nombre ?? '—'}
              </h2>
              <p className="perfil-legajo">
                {empleado?.legajo ? `Legajo ${empleado.legajo}` : 'Sin legajo asignado'}
              </p>
            </div>
            <div className="perfil-acciones-cabecera">
              <button
                type="button"
                className="boton-comercial-primario"
                onClick={() => {
                  setValoresPersonales({
                    nombre: datos?.empleado?.nombre ?? '',
                    apellido: datos?.empleado?.apellido ?? '',
                    email: datos?.email ?? '',
                    dni: datos?.empleado?.dni ?? '',
                    telefono: datos?.empleado?.telefono ?? '',
                  })
                  setErroresPersonales({})
                  setModalEdicionAbierto(true)
                }}
                disabled={guardando}
              >
                <IconEdit size={16} />
                Editar perfil
              </button>
              {datos?.empleado && (
                <button
                  type="button"
                  className="perfil-boton-password"
                  onClick={() => {
                    setValoresPassword({
                      password_actual: '',
                      password_nueva: '',
                      password_confirmacion: '',
                    })
                    setErroresPassword({})
                    setModalPasswordAbierto(true)
                  }}
                  disabled={cambiandoPassword}
                >
                  <IconKey size={16} />
                  Cambiar contraseña
                </button>
              )}
            </div>
          </div>

          <div className="perfil-grid-datos">
            <div className="perfil-dato">
              <span className="perfil-dato-label">Email</span>
              <span className="perfil-dato-valor">{datos?.email ?? '—'}</span>
            </div>
            <div className="perfil-dato">
              <span className="perfil-dato-label">DNI</span>
              <span className="perfil-dato-valor">{empleado?.dni ?? '—'}</span>
            </div>
            <div className="perfil-dato">
              <span className="perfil-dato-label">Teléfono</span>
              <span className="perfil-dato-valor">{empleado?.telefono ?? '—'}</span>
            </div>
            <div className="perfil-dato">
              <span className="perfil-dato-label">Rol</span>
              <span className="perfil-dato-valor">
                {esAdministrador ? 'Administrador (superusuario)' : user?.rol ?? '—'}
              </span>
            </div>
            <div className="perfil-dato perfil-dato-ancho">
              <span className="perfil-dato-label">Sucursales asignadas</span>
              <span className="perfil-dato-valor">{sucursalesTexto}</span>
            </div>
            <div className="perfil-dato perfil-dato-ancho">
              <span className="perfil-dato-label">Roles activos</span>
              <span className="perfil-dato-valor">{rolesTexto}</span>
            </div>
          </div>
        </section>
      </div>

      {/* ===================== MODAL: EDITAR DATOS PERSONALES ===================== */}
      {modalEdicionAbierto && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal comercial-modal-medio">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconUser size={24} />
                Editar datos personales
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={() => {
                  setModalEdicionAbierto(false)
                  setErroresPersonales({})
                }}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <form
              onSubmit={guardarPersonales}
              className="comercial-grid"
              noValidate
            >
              {(datos.empleado
                ? CAMPOS_PERSONALES
                : CAMPOS_PERSONALES.filter((c) => c.id === 'email')
              ).map((campo) => (
                <label key={campo.id} className="campo-comercial">
                  <span>{campo.etiqueta}</span>
                  <div className="campo-con-atajo">
                    <input
                      type={campo.tipo}
                      className={erroresPersonales[campo.id] ? 'input-error' : ''}
                      placeholder={campo.placeholder}
                      value={valoresPersonales[campo.id]}
                      onChange={(e) => setValorPersonal(campo.id, e.target.value)}
                      autoComplete={campo.id === 'email' ? 'email' : 'off'}
                    />
                    {campo.icono && (
                      <campo.icono size={18} className="icono-campo" />
                    )}
                  </div>
                  <MensajeError>{erroresPersonales[campo.id]}</MensajeError>
                </label>
              ))}
              <div className="comercial-modal-acciones ancho-completo">
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={() => {
                    setModalEdicionAbierto(false)
                    setErroresPersonales({})
                  }}
                  disabled={guardando}
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
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CAMBIAR CONTRASEÑA ===================== */}
      {modalPasswordAbierto && (
        <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
          <div className="comercial-modal comercial-modal-medio">
            <div className="comercial-modal-cabecera">
              <h2>
                <IconKey size={24} />
                Cambiar contraseña
              </h2>
              <button
                type="button"
                className="comercial-modal-cerrar"
                onClick={() => {
                  setModalPasswordAbierto(false)
                  setErroresPassword({})
                  setValoresPassword({
                    password_actual: '',
                    password_nueva: '',
                    password_confirmacion: '',
                  })
                }}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            <form
              onSubmit={cambiarPasswordPropio}
              className="comercial-grid"
              noValidate
            >
              <label className="campo-comercial">
                <span>Contraseña actual *</span>
                <input
                  type="password"
                  className={erroresPassword.password_actual ? 'input-error' : ''}
                  autoComplete="current-password"
                  value={valoresPassword.password_actual}
                  onChange={(e) => setValorPassword('password_actual', e.target.value)}
                  placeholder="Tu contraseña actual"
                />
                <MensajeError>{erroresPassword.password_actual}</MensajeError>
              </label>
              <label className="campo-comercial">
                <span>Contraseña nueva *</span>
                <input
                  type="password"
                  className={erroresPassword.password_nueva ? 'input-error' : ''}
                  autoComplete="new-password"
                  value={valoresPassword.password_nueva}
                  onChange={(e) => setValorPassword('password_nueva', e.target.value)}
                  placeholder="Letras, números y un símbolo"
                />
                <MensajeError>{erroresPassword.password_nueva}</MensajeError>
                <p className="empleados-nota ancho-completo">
                  Debe tener letras, números y un símbolo.
                </p>
              </label>
              <label className="campo-comercial">
                <span>Repetir contraseña nueva *</span>
                <input
                  type="password"
                  className={erroresPassword.password_confirmacion ? 'input-error' : ''}
                  autoComplete="new-password"
                  value={valoresPassword.password_confirmacion}
                  onChange={(e) =>
                    setValorPassword('password_confirmacion', e.target.value)
                  }
                  placeholder="Repetí la contraseña nueva"
                />
                <MensajeError>{erroresPassword.password_confirmacion}</MensajeError>
              </label>
              <div className="comercial-modal-acciones ancho-completo">
                <button
                  type="button"
                  className="boton-comercial-secundario"
                  onClick={() => {
                    setModalPasswordAbierto(false)
                    setErroresPassword({})
                    setValoresPassword({
                      password_actual: '',
                      password_nueva: '',
                      password_confirmacion: '',
                    })
                  }}
                  disabled={cambiandoPassword}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="boton-comercial-primario"
                  disabled={cambiandoPassword}
                >
                  {cambiandoPassword ? (
                    <>
                      <IconLoader2 className="icono-girando" size={18} />
                      Cambiando…
                    </>
                  ) : (
                    <>
                      <IconKey size={18} />
                      Cambiar contraseña
                    </>
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

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}
