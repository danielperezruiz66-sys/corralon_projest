import { useState } from 'react'
import Swal from 'sweetalert2'
import { IconBuildingWarehouse, IconLoader2, IconX } from '@tabler/icons-react'
import { pedir } from '../../api/client'
import { validarNombreCatalogo } from '../../utils/validaciones'
import CampoSelectorBuscable from '../common/CampoSelectorBuscable.jsx'
import MensajeError from '../common/MensajeError.jsx'

export default function FormularioDeposito({
  deposito = null,
  sucursales = [],
  depositos = [],
  sucursalActiva = '',
  onCerrar,
  onGuardado,
}) {
  const [sucursal, setSucursal] = useState(
    deposito?.sucursal
      ? String(deposito.sucursal)
      : sucursalActiva
        ? String(sucursalActiva)
        : '',
  )
  const [nombre, setNombre] = useState(deposito?.nombre || '')
  const [descripcion, setDescripcion] = useState(deposito?.descripcion || '')
  const [predeterminado, setPredeterminado] = useState(
    Boolean(deposito?.es_predeterminado),
  )
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const esEdicion = Boolean(deposito?.id)
  const hayErrores = Object.values(errores).some(Boolean)

  function validarSucursal(valor) {
    return valor ? '' : 'Seleccioná la sucursal.'
  }

  function validarNombre(valor, sucursalId) {
    const errorNombre = validarNombreCatalogo(
      valor,
      'El nombre del depósito',
    )
    if (errorNombre) {
      return errorNombre
    }
    if (!sucursalId) {
      return ''
    }
    const normalizado = String(valor || '').trim().toLowerCase()
    const duplicado = depositos.some(
      (item) =>
        (!deposito || Number(item.id) !== Number(deposito.id)) &&
        Number(item.sucursal) === Number(sucursalId) &&
        String(item.nombre || '').trim().toLowerCase() === normalizado,
    )
    return duplicado
      ? 'Ya existe un depósito con ese nombre en la sucursal.'
      : ''
  }

  function validarPredeterminado(valor, sucursalId) {
    if (!valor || !sucursalId) {
      return ''
    }
    const existente = depositos.some(
      (item) =>
        (!deposito || Number(item.id) !== Number(deposito.id)) &&
        Number(item.sucursal) === Number(sucursalId) &&
        item.es_predeterminado,
    )
    return existente
      ? 'Ya existe un depósito predeterminado para esta sucursal.'
      : ''
  }

  function cambiarSucursal(valor) {
    setSucursal(valor)
    setErrores((previos) => ({
      ...previos,
      sucursal: validarSucursal(valor),
      nombre: validarNombre(nombre, valor),
      es_predeterminado: validarPredeterminado(predeterminado, valor),
    }))
  }

  function cambiarNombre(valor) {
    setNombre(valor)
    setErrores((previos) => ({
      ...previos,
      nombre: validarNombre(valor, sucursal),
    }))
  }

  function cambiarPredeterminado(valor) {
    setPredeterminado(valor)
    setErrores((previos) => ({
      ...previos,
      es_predeterminado: validarPredeterminado(valor, sucursal),
    }))
  }

  async function guardar(evento) {
    evento.preventDefault()
    const nuevos = {
      sucursal: validarSucursal(sucursal),
      nombre: validarNombre(nombre, sucursal),
      es_predeterminado: validarPredeterminado(predeterminado, sucursal),
    }
    Object.keys(nuevos).forEach((campo) => {
      if (!nuevos[campo]) {
        delete nuevos[campo]
      }
    })
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
        esEdicion ? `/depositos/${deposito.id}/` : '/depositos/',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          body: JSON.stringify({
            sucursal: Number(sucursal),
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            es_predeterminado: predeterminado,
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
    <div className="comercial-modal-fondo" role="dialog" aria-modal="true">
      <div className="comercial-modal comercial-modal-medio">
        <div className="comercial-modal-cabecera">
          <h2>
            <IconBuildingWarehouse size={24} />
            {esEdicion ? 'Editar depósito' : 'Nuevo depósito'}
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
            etiqueta="Sucursal *"
            valor={sucursal}
            onCambiar={cambiarSucursal}
            opciones={sucursales}
            textoOpcion={(item) => item.nombre}
            placeholder="Buscar sucursal"
            error={Boolean(errores.sucursal)}
            mensajeError={errores.sucursal}
          />

          <label className="campo-comercial">
            <span>Nombre *</span>
            <input
              type="text"
              maxLength={50}
              className={errores.nombre ? 'input-error' : ''}
              value={nombre}
              onChange={(evento) => cambiarNombre(evento.target.value)}
            />
            <MensajeError>{errores.nombre}</MensajeError>
          </label>

          <label className="campo-comercial ancho-completo">
            <span>Descripción</span>
            <input
              type="text"
              maxLength={150}
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
          </label>

          <label className="campo-checkbox ancho-completo">
            <input
              type="checkbox"
              checked={predeterminado}
              onChange={(evento) =>
                cambiarPredeterminado(evento.target.checked)
              }
            />
            <span>Depósito predeterminado de la sucursal</span>
          </label>
          <MensajeError>{errores.es_predeterminado}</MensajeError>

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
              disabled={guardando || hayErrores}
            >
              {guardando ? (
                <>
                  <IconLoader2 className="icono-girando" size={18} />
                  Guardando…
                </>
              ) : (
                'Guardar depósito'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
