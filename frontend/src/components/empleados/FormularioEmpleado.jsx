import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { IconLoader2, IconUsers, IconX } from '@tabler/icons-react'
import { pedirTodas } from '../../api/catalogos'
import { pedir } from '../../api/client'
import MensajeError from '../common/MensajeError.jsx'
import {
  validarCodigo,
  validarDocumento,
  validarEmail,
  validarNombre,
  validarTelefono,
} from '../../utils/validaciones'
import '../../styles/Empleados.css'

const ESTADOS = [
  { id: 'AC', etiqueta: 'Activo' },
  { id: 'BT', etiqueta: 'Baja temporal' },
  { id: 'SU', etiqueta: 'Suspendido' },
  { id: 'IN', etiqueta: 'Inactivo' },
]

function wantsAcceso(acceso) {
  return (
    acceso.username.trim() !== '' ||
    acceso.password !== '' ||
    acceso.email.trim() !== ''
  )
}

function validarCampoEmpleado(campo, valor) {
  const texto = String(valor ?? '').trim()
  switch (campo) {
    case 'nombre':
      return validarNombre(texto, 'El nombre')
    case 'apellido':
      return validarNombre(texto, 'El apellido')
    case 'dni':
      return validarDocumento('DNI', texto)
    case 'legajo':
      return validarCodigo(texto)
    case 'telefono':
      return validarTelefono(valor)
    default:
      return ''
  }
}

function passwordValida(password) {
  return (
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

function validarCampoAcceso(campo, valor, acceso) {
  const accesoBis = { ...acceso, [campo]: valor }
  switch (campo) {
    case 'username': {
      const texto = String(valor ?? '').trim()
      if (texto === '') {
        return acceso.password !== '' || acceso.email.trim() !== ''
          ? 'Ingresá el usuario.'
          : ''
      }
      return validarCodigo(texto)
    }
    case 'email':
      return validarEmail(valor)
    case 'password': {
      if (accesoBis.password === '') {
        return acceso.username.trim() !== '' || acceso.email.trim() !== ''
          ? 'Ingresá la contraseña.'
          : ''
      }
      return passwordValida(accesoBis.password)
        ? ''
        : 'Debe tener letras, números y un símbolo.'
    }
    case 'password_confirmacion':
      if (valor === '') {
        return acceso.password !== '' ? 'Repetí la contraseña.' : ''
      }
      return valor === acceso.password ? '' : 'Las contraseñas no coinciden.'
    default:
      return ''
  }
}

function inicialValores(empleado) {
  if (!empleado) {
    return {
      nombre: '',
      apellido: '',
      dni: '',
      legajo: '',
      telefono: '',
      estado: 'AC',
    }
  }
  return {
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    dni: empleado.dni,
    legajo: empleado.legajo,
    telefono: empleado.telefono ?? '',
    estado: empleado.estado,
  }
}

export default function FormularioEmpleado({ empleado, onCerrar, onGuardado }) {
  const esAlta = !empleado || !empleado.id
  const [valores, setValores] = useState(() => inicialValores(empleado))
  const [acceso, setAcceso] = useState({
    username: '',
    email: '',
    password: '',
    password_confirmacion: '',
  })
  const [roles, setRoles] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [rolesElegidos, setRolesElegidos] = useState(
    () => new Set(empleado?.roles_ids ?? []),
  )
  const [sucursalesElegidas, setSucursalesElegidas] = useState(
    () => new Set(empleado?.sucursales_ids ?? []),
  )
  const [errorCarga, setErrorCarga] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})

  useEffect(() => {
    let vigente = true
    Promise.all([pedirTodas('/roles/'), pedirTodas('/sucursales/')])
      .then(([rolesData, sucursalesData]) => {
        if (!vigente) {
          return
        }
        setRoles(
          rolesData.filter((rol) => rol.codigo !== null && rol.codigo !== ''),
        )
        setSucursales(sucursalesData)
        setCargando(false)
      })
      .catch((e) => {
        if (vigente) {
          setErrorCarga(e.message)
          setCargando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [])

  function setValor(campo, valor) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
    setErrores((previos) => ({
      ...previos,
      [campo]: validarCampoEmpleado(campo, valor),
    }))
  }

  function setAccesoValor(campo, valor) {
    setAcceso((actuales) => {
      const siguientes = { ...actuales, [campo]: valor }
      const nuevos = {}
      ;['username', 'email', 'password', 'password_confirmacion'].forEach((c) => {
        nuevos[c] = validarCampoAcceso(c, siguientes[c], siguientes)
      })
      setErrores((previos) => ({ ...previos, ...nuevos }))
      return siguientes
    })
  }

  function alternar(conjunto, setConjunto, valor) {
    const siguiente = new Set(conjunto)
    if (siguiente.has(valor)) {
      siguiente.delete(valor)
    } else {
      siguiente.add(valor)
    }
    setConjunto(siguiente)
  }

  async function guardar(evento) {
    evento.preventDefault()
    const dataEmpleado = {
      nombre: validarCampoEmpleado('nombre', valores.nombre),
      apellido: validarCampoEmpleado('apellido', valores.apellido),
      dni: validarCampoEmpleado('dni', valores.dni),
      legajo: validarCampoEmpleado('legajo', valores.legajo),
      telefono: validarCampoEmpleado('telefono', valores.telefono),
    }
    const quiereAccesoInicial = esAlta || !(empleado?.usuario_detalle)
    const quiereAcceso = wantsAcceso(acceso)
    const dataAcceso =
      quiereAccesoInicial && quiereAcceso
        ? {
            username: validarCampoAcceso('username', acceso.username, acceso),
            email: validarCampoAcceso('email', acceso.email, acceso),
            password: validarCampoAcceso('password', acceso.password, acceso),
            password_confirmacion: validarCampoAcceso(
              'password_confirmacion',
              acceso.password_confirmacion,
              acceso,
            ),
          }
        : {}
    const nuevos = { ...dataEmpleado, ...dataAcceso }

    const conError = Object.fromEntries(
      Object.entries(nuevos).filter(([, mensaje]) => mensaje),
    )

    if (Object.keys(conError).length > 0) {
      setErrores(conError)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErrores({})
    setGuardando(true)
    try {
      const nombre = valores.nombre.trim()
      const apellido = valores.apellido.trim()
      const dni = valores.dni.trim()
      const legajo = valores.legajo.trim()
      const cuerpo = {
        nombre,
        apellido,
        dni,
        legajo,
        telefono: valores.telefono.trim() || null,
        estado: valores.estado,
        roles: [...rolesElegidos],
        sucursales: [...sucursalesElegidas],
      }

      const quiereAccesoInicial =
        esAlta || !(empleado?.usuario_detalle)
      const quiereAcceso =
        wantsAcceso(acceso)
      if (quiereAccesoInicial && quiereAcceso) {
        cuerpo.usuario_datos = {
          username: acceso.username.trim(),
          email: acceso.email.trim(),
          password: acceso.password,
        }
      }

      if (esAlta) {
        await pedir('/empleados/', {
          method: 'POST',
          body: JSON.stringify(cuerpo),
        })
      } else {
        await pedir(`/empleados/${empleado.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(cuerpo),
        })
      }
      onGuardado?.()
    } catch (e) {
      const nested = e.datos?.usuario_datos
      const mapeado = { ...errores }
      if (e.campos) {
        Object.entries(e.campos).forEach(([campo, mensaje]) => {
          mapeado[campo] = mensaje
        })
      }
      if (nested && typeof nested === 'object') {
        Object.entries(nested).forEach(([campo, valor]) => {
          mapeado[campo] = Array.isArray(valor) ? valor.join(' ') : String(valor)
        })
      }
      setErrores(mapeado)
      Swal.fire({
        icon: 'error',
        title: esAlta ? 'No se pudo crear el empleado' : 'No se pudieron guardar los datos',
        text: e.message,
        confirmButtonColor: '#4a9da8',
      })
    } finally {
      setGuardando(false)
    }
  }

  const titulo = esAlta ? 'Nuevo empleado' : `Editar · ${empleado.apellido}, ${empleado.nombre}`

  return (
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconUsers size={24} />
            {titulo}
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
          {cargando ? (
            <p className="comercial-nota ancho-completo">
              <IconLoader2 className="icono-girando" size={18} />
              Cargando catálogos…
            </p>
          ) : (
            <>
              {errorCarga && (
                <p className="comercial-error ancho-completo">{errorCarga}</p>
              )}

              <h3 className="empleados-seccion-titulo ancho-completo">
                Datos del empleado
              </h3>
              <label className="campo-comercial">
                <span>Nombre *</span>
                <input
                  className={errores.nombre ? 'input-error' : ''}
                  maxLength={50}
                  value={valores.nombre}
                  onChange={(e) => setValor('nombre', e.target.value)}
                />
                <MensajeError>{errores.nombre}</MensajeError>
              </label>
              <label className="campo-comercial">
                <span>Apellido *</span>
                <input
                  className={errores.apellido ? 'input-error' : ''}
                  maxLength={50}
                  value={valores.apellido}
                  onChange={(e) => setValor('apellido', e.target.value)}
                />
                <MensajeError>{errores.apellido}</MensajeError>
              </label>
              <label className="campo-comercial">
                <span>DNI *</span>
                <input
                  className={errores.dni ? 'input-error' : ''}
                  maxLength={15}
                  value={valores.dni}
                  onChange={(e) => setValor('dni', e.target.value)}
                />
                <MensajeError>{errores.dni}</MensajeError>
              </label>
              <label className="campo-comercial">
                <span>Legajo *</span>
                <input
                  className={errores.legajo ? 'input-error' : ''}
                  maxLength={15}
                  value={valores.legajo}
                  onChange={(e) => setValor('legajo', e.target.value)}
                />
                <MensajeError>{errores.legajo}</MensajeError>
              </label>
              <label className="campo-comercial">
                <span>Teléfono</span>
                <input
                  className={errores.telefono ? 'input-error' : ''}
                  maxLength={30}
                  value={valores.telefono}
                  onChange={(e) => setValor('telefono', e.target.value)}
                />
                <MensajeError>{errores.telefono}</MensajeError>
              </label>
              <label className="campo-comercial">
                <span>Estado</span>
                <select
                  value={valores.estado}
                  onChange={(e) => setValor('estado', e.target.value)}
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.etiqueta}
                    </option>
                  ))}
                </select>
              </label>

              <h3 className="empleados-seccion-titulo ancho-completo">
                Acceso al sistema
              </h3>
              {esAlta ? (
                <>
                  <label className="campo-comercial">
                    <span>Usuario</span>
                    <input
                      className={errores.username ? 'input-error' : ''}
                      maxLength={150}
                      autoComplete="off"
                      value={acceso.username}
                      onChange={(e) => setAccesoValor('username', e.target.value)}
                      placeholder="Opcional: sin usuario no puede iniciar sesión"
                    />
                    <MensajeError>{errores.username}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Email</span>
                    <input
                      type="email"
                      className={errores.email ? 'input-error' : ''}
                      maxLength={150}
                      value={acceso.email}
                      onChange={(e) => setAccesoValor('email', e.target.value)}
                    />
                    <MensajeError>{errores.email}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Contraseña</span>
                    <input
                      className={errores.password ? 'input-error' : ''}
                      type="password"
                      autoComplete="new-password"
                      maxLength={128}
                      value={acceso.password}
                      onChange={(e) => setAccesoValor('password', e.target.value)}
                      placeholder="Letras, números y un símbolo"
                    />
                    <MensajeError>{errores.password}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Repetir contraseña</span>
                    <input
                      className={errores.password_confirmacion ? 'input-error' : ''}
                      type="password"
                      autoComplete="new-password"
                      maxLength={128}
                      value={acceso.password_confirmacion}
                      onChange={(e) =>
                        setAccesoValor('password_confirmacion', e.target.value)
                      }
                    />
                    <MensajeError>{errores.password_confirmacion}</MensajeError>
                  </label>
                  <p className="empleados-nota ancho-completo">
                    Si dejás usuario y contraseña en blanco, el empleado se
                    crea sin acceso. Después, un administrador puede darle y
                    asignarle un acceso con el botón de llave (solo
                    administradores), verificándose con su propia contraseña.
                  </p>
                </>
              ) : empleado.usuario_detalle ? (
                <p className="empleados-nota ancho-completo">
                  Usuario: <strong>{empleado.usuario_detalle}</strong>
                  {empleado.usuario_email ? <> · {empleado.usuario_email}</> : null}
                  <br />
                  La contraseña se cambia desde el botón de la llave en el
                  listado (solo administradores).
                </p>
              ) : (
                <>
                  <label className="campo-comercial">
                    <span>Usuario (diseñar acceso)</span>
                    <input
                      className={errores.username ? 'input-error' : ''}
                      maxLength={150}
                      autoComplete="off"
                      value={acceso.username}
                      onChange={(e) => setAccesoValor('username', e.target.value)}
                      placeholder="Dejar vacío para no crear acceso"
                    />
                    <MensajeError>{errores.username}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Email</span>
                    <input
                      type="email"
                      className={errores.email ? 'input-error' : ''}
                      maxLength={150}
                      value={acceso.email}
                      onChange={(e) => setAccesoValor('email', e.target.value)}
                    />
                    <MensajeError>{errores.email}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Contraseña</span>
                    <input
                      className={errores.password ? 'input-error' : ''}
                      type="password"
                      autoComplete="new-password"
                      maxLength={128}
                      value={acceso.password}
                      onChange={(e) => setAccesoValor('password', e.target.value)}
                      placeholder="Letras, números y un símbolo"
                    />
                    <MensajeError>{errores.password}</MensajeError>
                  </label>
                  <label className="campo-comercial">
                    <span>Repetir contraseña</span>
                    <input
                      className={errores.password_confirmacion ? 'input-error' : ''}
                      type="password"
                      autoComplete="new-password"
                      maxLength={128}
                      value={acceso.password_confirmacion}
                      onChange={(e) =>
                        setAccesoValor('password_confirmacion', e.target.value)
                      }
                    />
                    <MensajeError>{errores.password_confirmacion}</MensajeError>
                  </label>
                  <p className="empleados-nota ancho-completo">
                    Este empleado no tiene acceso al sistema. Al guardar con
                    usuario y contraseña, le creamos su acceso.
                  </p>
                </>
              )}

              <h3 className="empleados-seccion-titulo ancho-completo">
                Roles
              </h3>
              <div className="empleados-checks ancho-completo">
                {roles.map((rol) => (
                  <label key={rol.id} className="empleados-check">
                    <input
                      type="checkbox"
                      checked={rolesElegidos.has(rol.id)}
                      onChange={() =>
                        alternar(rolesElegidos, setRolesElegidos, rol.id)
                      }
                    />
                    {rol.ocupacion}{' '}
                    <span className="empleados-nota">({rol.codigo})</span>
                  </label>
                ))}
              </div>

              <h3 className="empleados-seccion-titulo ancho-completo">
                Sucursales
              </h3>
              <div className="empleados-checks ancho-completo">
                {sucursales.map((sucursal) => (
                  <label key={sucursal.id} className="empleados-check">
                    <input
                      type="checkbox"
                      checked={sucursalesElegidas.has(sucursal.id)}
                      onChange={() =>
                        alternar(sucursalesElegidas, setSucursalesElegidas, sucursal.id)
                      }
                    />
                    {sucursal.nombre}
                  </label>
                ))}
              </div>
            </>
          )}

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
              disabled={guardando || cargando}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Guardando…
                </>
              ) : esAlta ? (
                'Crear empleado'
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
