import { useCallback, useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  IconBuildingWarehouse,
  IconCalendarEvent,
  IconDeviceFloppy,
  IconHash,
  IconLoader2,
  IconMail,
  IconPhone,
  IconRefresh,
  IconShieldCheck,
} from '@tabler/icons-react'
import { pedirTodas } from '../api/catalogos'
import { pedir } from '../api/client'
import useCacheModulo from '../hooks/useCacheModulo'
import Encabezado from '../components/Encabezado.jsx'
import MensajeError from '../components/common/MensajeError.jsx'
import { useAuth } from '../context/auth-context'
import {
  limpiar,
  normalizarDocumento,
  validarDocumento,
  validarEmail,
  validarFecha,
  validarIngresosBrutos,
  validarTelefono,
  validarTexto,
} from '../utils/validaciones'
import '../styles/DatosCuenta.css'

const CONDICIONES_IVA = [
  { valor: 'RESPONSABLE_INSCRIPTO', etiqueta: 'Responsable inscripto' },
  { valor: 'MONOTRIBUTISTA', etiqueta: 'Monotributista' },
  { valor: 'SOCIEDADES', etiqueta: 'Sociedades' },
  { valor: 'EXENTO', etiqueta: 'Exento' },
  { valor: 'NO_RESPONSABLE', etiqueta: 'No responsable' },
  { valor: 'CONSUMIDOR_FINAL', etiqueta: 'Consumidor final' },
]

const CAMPOS = [
  {
    id: 'cuit',
    etiqueta: 'CUIT',
    tipo: 'text',
    Icono: IconHash,
    placeholder: '30-12345678-9',
    requerido: true,
    validar: (valor) => validarDocumento('CUIT', valor),
  },
  {
    id: 'nombre',
    etiqueta: 'Nombre',
    tipo: 'text',
    Icono: IconBuildingWarehouse,
    placeholder: 'Nombre de la empresa',
    requerido: true,
    validar: (valor) => validarTexto(valor, 'El nombre', { min: 2, max: 80 }),
  },
  {
    id: 'razon_social',
    etiqueta: 'Razón social',
    tipo: 'text',
    Icono: IconBuildingWarehouse,
    placeholder: 'Razón social',
    requerido: true,
    validar: (valor) =>
      validarTexto(valor, 'La razón social', { min: 2, max: 100 }),
  },
  {
    id: 'email',
    etiqueta: 'Email',
    tipo: 'email',
    Icono: IconMail,
    placeholder: 'contacto@empresa.com.ar',
    validar: validarEmail,
  },
  {
    id: 'telefono',
    etiqueta: 'Teléfono',
    tipo: 'text',
    Icono: IconPhone,
    placeholder: '+54 9 387 1234567',
    validar: validarTelefono,
  },
  {
    id: 'ingresos_brutos',
    etiqueta: 'Ingresos brutos',
    tipo: 'text',
    Icono: IconHash,
    placeholder: '387-123456-7',
    validar: validarIngresosBrutos,
  },
  {
    id: 'fecha_inicio_act',
    etiqueta: 'Inicio de actividades',
    tipo: 'date',
    Icono: IconCalendarEvent,
    validar: (valor) => (valor ? validarFecha(valor, 'La fecha') : ''),
  },
  {
    id: 'condicion_iva',
    etiqueta: 'Condición IVA',
    tipo: 'select',
    Icono: IconShieldCheck,
    requerido: true,
    opciones: CONDICIONES_IVA,
    validar: (valor) => (valor ? '' : 'Seleccioná la condición de IVA.'),
  },
  {
    id: 'dir_fiscal',
    etiqueta: 'Dirección fiscal',
    tipo: 'text',
    Icono: IconBuildingWarehouse,
    placeholder: 'Calle, número y localidad',
    ancho: true,
    validar: (valor) =>
      valor
        ? validarTexto(valor, 'La dirección fiscal', { min: 2, max: 120 })
        : '',
  },
]


function valoresDesdeEmpresa(empresa) {
  return {
    cuit: empresa?.cuit ?? '',
    nombre: empresa?.nombre ?? '',
    razon_social: empresa?.razon_social ?? '',
    email: empresa?.email ?? '',
    telefono: empresa?.telefono ?? '',
    ingresos_brutos: empresa?.ingresos_brutos ?? '',
    fecha_inicio_act: empresa?.fecha_inicio_act ?? '',
    condicion_iva: empresa?.condicion_iva ?? 'RESPONSABLE_INSCRIPTO',
    dir_fiscal: empresa?.dir_fiscal ?? '',
  }
}

export default function Configuracion() {
  const { user } = useAuth()
  const claveCache = `configuracion|${user?.id ?? ''}`

  const [valores, setValores] = useState(() =>
    valoresDesdeEmpresa(null),
  )
  const [valoresGuardados, setValoresGuardados] = useState(() =>
    valoresDesdeEmpresa(null),
  )
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const editandoRef = useRef(false)

  const puedeEditar = Boolean(
    user?.is_superuser || (user?.codigos ?? []).includes('AD'),
  )

  const consultar = useCallback(
    () =>
      pedirTodas('/empresas/').then((lista) =>
        Array.isArray(lista) ? lista[0] ?? null : null,
      ),
    [],
  )

  const {
    datos: empresa,
    cargando,
    actualizando,
    error,
    refrescar,
    invalidar,
  } = useCacheModulo({
    clave: claveCache,
    consultar,
    inicial: null,
    intervalo: 15000,
  })

  useEffect(() => {
    if (!empresa || editandoRef.current) {
      return
    }
    const valoresServidor = valoresDesdeEmpresa(empresa)
    setValores(valoresServidor)
    setValoresGuardados(valoresServidor)
  }, [empresa])

  const opcionesIva = CONDICIONES_IVA.some(
    (opcion) => opcion.valor === valores.condicion_iva,
  )
    ? CONDICIONES_IVA
    : [
        {
          valor: valores.condicion_iva,
          etiqueta: valores.condicion_iva,
        },
        ...CONDICIONES_IVA,
      ]

  const hayCambios = CAMPOS.some(
    (campo) => valores[campo.id] !== (valoresGuardados[campo.id] ?? ''),
  )
  const formularioInvalido = CAMPOS.some((campo) =>
    Boolean(campo.validar(valores[campo.id])),
  )

  const setValor = (campo, valor) => {
    editandoRef.current = true
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
    const mensaje = CAMPOS.find((item) => item.id === campo)?.validar(valor) ?? ''
    setErrores((previos) => ({ ...previos, [campo]: mensaje }))
  }

  const cancelarEdicion = () => {
    editandoRef.current = false
    setValores(valoresGuardados)
    setErrores({})
  }

  const guardar = async (evento) => {
    evento.preventDefault()
    const erroresFormulario = {}
    CAMPOS.forEach((campo) => {
      const mensaje = campo.validar(valores[campo.id])
      if (mensaje) {
        erroresFormulario[campo.id] = mensaje
      }
    })

    if (Object.keys(erroresFormulario).length > 0) {
      setErrores(erroresFormulario)
      requestAnimationFrame(() => {
        document.querySelector('.input-error')?.focus()
      })
      return
    }

    setErrores({})
    setGuardando(true)
    const cuerpo = {
      ...valores,
      cuit: normalizarDocumento(valores.cuit),
      email: limpiar(valores.email) || null,
      telefono: limpiar(valores.telefono) || null,
      ingresos_brutos: limpiar(valores.ingresos_brutos) || null,
      fecha_inicio_act: valores.fecha_inicio_act || null,
      dir_fiscal: limpiar(valores.dir_fiscal) || null,
    }

    try {
      const guardada = await pedir(
        empresa ? `/empresas/${empresa.id}/` : '/empresas/',
        {
          method: empresa ? 'PATCH' : 'POST',
          body: cuerpo,
        },
      )
      editandoRef.current = false
      const valoresServidor = valoresDesdeEmpresa(guardada)
      setValores(valoresServidor)
      setValoresGuardados(valoresServidor)
      invalidar(claveCache)
      refrescar(true)
      Swal.fire({
        icon: 'success',
        title: 'Datos guardados',
        timer: 1400,
        showConfirmButton: false,
      })
    } catch (e) {
      if (e.campos) {
        setErrores((actuales) => ({ ...actuales, ...e.campos }))
      }
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

  const valorPara = (campo) => {
    const valor = valoresGuardados[campo.id]
    if (campo.id === 'condicion_iva') {
      return CONDICIONES_IVA.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor
    }
    return valor || ''
  }

  const renderCampo = (campo) => {
    const mensaje = errores[campo.id] ?? ''
    const opciones = campo.id === 'condicion_iva' ? opcionesIva : campo.opciones
    const Icono = campo.Icono
    return (
      <div
        className={`campo-perfil-item ${campo.ancho ? 'campo-perfil-ancho' : ''}`}
        key={campo.id}
      >
        <span className="icono-campo-perfil">
          <Icono size={20} stroke={1.8} />
        </span>
        <div className="info-campo-perfil">
          <span>
            {campo.etiqueta}
            {campo.requerido ? ' *' : ''}
          </span>
          {puedeEditar ? (
            <>
              {opciones ? (
                <select
                  className={`input-perfil-editable ${mensaje ? 'input-error' : ''}`}
                  value={valores[campo.id] ?? ''}
                  onChange={(e) => setValor(campo.id, e.target.value)}
                  disabled={guardando}
                >
                  {opciones.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={campo.tipo}
                  className={`input-perfil-editable ${mensaje ? 'input-error' : ''}`}
                  placeholder={campo.placeholder}
                  value={valores[campo.id] ?? ''}
                  onChange={(e) => setValor(campo.id, e.target.value)}
                  autoComplete={campo.id === 'email' ? 'email' : 'off'}
                  disabled={guardando}
                />
              )}
              <MensajeError>{mensaje}</MensajeError>
            </>
          ) : (
            <p className="campo-perfil-valor">{valorPara(campo) || '—'}</p>
          )}
        </div>
      </div>
    )
  }

  if (!puedeEditar) {
    return (
      <main className="contenido-modulo">
        <Encabezado titulo="Configuración" subtitulo="Datos de la empresa" />
        <div className="perfil-error">
          No tenés permiso para ver la configuración del sistema.
        </div>
      </main>
    )
  }

  if (cargando && !empresa) {
    return (
      <main className="contenido-modulo">
        <Encabezado titulo="Configuración" subtitulo="Datos de la empresa" />
        <div className="perfil-cargando">
          <IconLoader2 className="icono-girando" size={28} />
          <span>Cargando datos de la empresa…</span>
        </div>
      </main>
    )
  }

  if (error && !empresa) {
    return (
      <main className="contenido-modulo">
        <Encabezado titulo="Configuración" subtitulo="Datos de la empresa" />
        <div className="perfil-error">
          <p>{error}</p>
          <button
            type="button"
            className="boton-secundario-perfil"
            onClick={() => refrescar(true)}
          >
            <IconRefresh size={16} />
            Reintentar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="contenido-modulo">
      <Encabezado titulo="Configuración" subtitulo="Datos de la empresa" />
      <section className="seccion-perfil-principal">
        <div className="tarjeta-perfil-cabecera">
          <div className="avatar-perfil-contenedor">
            <IconBuildingWarehouse size={38} stroke={1.8} />
          </div>
          <div className="info-perfil-cabecera">
            <h2 className="nombre-perfil">
              {empresa?.nombre ?? 'Datos de la empresa'}
            </h2>
            <div className="rol-perfil-badge">
              <IconShieldCheck size={16} stroke={1.9} />
              Configuración del sistema
            </div>
          </div>
          <div className="estado-perfil-contenedor">
            <span className="label-estado">Empresa</span>
            <div className={`badge-estado-perfil ${empresa ? '' : 'inactivo'}`}>
              <span className="punto-estado" />
              {empresa ? 'Cargada' : 'Sin cargar'}
            </div>
          </div>
        </div>

        <form className="formulario-perfil" onSubmit={guardar} noValidate>
          <div className="grid-datos-perfil">
            {CAMPOS.map(renderCampo)}
          </div>

          <div className="contenedor-boton-guardar-perfil">
            <button
              type="submit"
              className="boton-guardar-perfil"
              disabled={!hayCambios || formularioInvalido || guardando}
            >
              <IconDeviceFloppy size={18} stroke={1.9} />
              {guardando
                ? 'Guardando…'
                : empresa
                  ? 'Guardar cambios'
                  : 'Guardar datos'}
            </button>
            <button
              type="button"
              className="boton-secundario-perfil"
              onClick={cancelarEdicion}
              disabled={!hayCambios || formularioInvalido || guardando}
            >
              Descartar cambios
            </button>
            {!hayCambios && !guardando && (
              <span className="panel-actualizando">Sin cambios pendientes</span>
            )}
            {guardando && (
              <span className="panel-actualizando">
                <IconLoader2 className="icono-girando" size={15} />
                Guardando…
              </span>
            )}
          </div>

          {actualizando && (
            <p className="panel-actualizando">
              <IconLoader2 className="icono-girando" size={15} />
              Actualizando datos…
            </p>
          )}
          {error && (
            <p className="nota-perfil">
              No se pudo actualizar en segundo plano: {error}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}
