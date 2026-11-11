import { useEffect, useMemo, useRef, useState } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'

function normalizar(valor) {
  return String(valor ?? '').toLowerCase()
}

export default function CampoSelectorBuscable({
  etiqueta,
  valor,
  onCambiar,
  opciones = [],
  onBuscar = null,
  textoOpcion = (item) => item.nombre,
  textoSecundario = () => '',
  placeholder = 'Buscar…',
  onCrear,
  tituloCrear = 'Crear nuevo',
  icono: Icono = IconPlus,
  textoBoton = '',
  deshabilitado = false,
  error = false,
  mensajeError = '',
  opcionSeleccionada = null,
}) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)
  const [indice, setIndice] = useState(0)
  const contenedorRef = useRef(null)
  const solicitudRef = useRef(0)

  const opcionActual = useMemo(() => {
    const todas = [...opciones, ...resultados]
    return (
      todas.find((item) => String(item.id) === String(valor)) ||
      (seleccionado &&
      String(seleccionado.id) === String(valor)
        ? seleccionado
        : null) ||
      (opcionSeleccionada &&
      String(opcionSeleccionada.id) === String(valor)
        ? opcionSeleccionada
        : null)
    )
  }, [
    opciones,
    resultados,
    valor,
    seleccionado,
    opcionSeleccionada,
  ])

  const etiquetaActual = opcionActual ? textoOpcion(opcionActual) : ''
  const valorMostrado = abierto ? texto : etiquetaActual

  const opcionesBase = useMemo(() => {
    const base = onBuscar ? resultados : opciones
    if (!opcionActual) {
      return base
    }
    const existe = base.some(
      (item) => String(item.id) === String(valor),
    )
    return existe ? base : [opcionActual, ...base]
  }, [onBuscar, resultados, opciones, opcionActual, valor])

  const filtradas = useMemo(() => {
    const termino = normalizar(texto)
    const mostrarTodas =
      !termino || (opcionActual && texto === etiquetaActual)
    if (mostrarTodas) {
      return opcionesBase
    }
    return opcionesBase.filter((item) => {
      const principal = normalizar(textoOpcion(item))
      const secundario = normalizar(textoSecundario(item))
      return principal.includes(termino) || secundario.includes(termino)
    })
  }, [
    texto,
    opcionActual,
    etiquetaActual,
    opcionesBase,
    textoOpcion,
    textoSecundario,
  ])

  useEffect(() => {
    if (!onBuscar || !abierto) {
      return undefined
    }
    const termino = texto.trim()
    if (opcionActual && termino === etiquetaActual) {
      return undefined
    }
    const solicitud = solicitudRef.current + 1
    solicitudRef.current = solicitud
    const temporizador = window.setTimeout(() => {
      onBuscar(termino)
        .then((datos) => {
          if (solicitud === solicitudRef.current) {
            setResultados(datos)
            setIndice(0)
          }
        })
        .catch(() => {
          if (solicitud === solicitudRef.current) {
            setResultados([])
          }
        })
        .finally(() => {
          if (solicitud === solicitudRef.current) {
            setBuscando(false)
          }
        })
    }, 300)
    return () => window.clearTimeout(temporizador)
  }, [texto, abierto, onBuscar, opcionActual, etiquetaActual])

  useEffect(() => {
    function alClick(evento) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target)
      ) {
        setAbierto(false)
        setBuscando(false)
      }
    }
    document.addEventListener('mousedown', alClick)
    return () => document.removeEventListener('mousedown', alClick)
  }, [])

  function seleccionar(opcion) {
    setSeleccionado(opcion)
    onCambiar(String(opcion.id), opcion)
    setTexto(textoOpcion(opcion))
    setAbierto(false)
    setBuscando(false)
    setIndice(0)
  }

  function limpiar() {
    setSeleccionado(null)
    onCambiar('', null)
    setTexto('')
    setAbierto(false)
    setResultados([])
    setBuscando(false)
  }

  function alFoco(evento) {
    if (deshabilitado) {
      return
    }
    setAbierto(true)
    setTexto(etiquetaActual)
    evento.target.select()
    setIndice(0)
    if (!etiquetaActual && onBuscar) {
      setBuscando(true)
    } else {
      setBuscando(false)
    }
  }

  function alEscribir(evento) {
    setTexto(evento.target.value)
    setAbierto(true)
    setIndice(0)
    if (onBuscar) {
      setBuscando(true)
    }
  }

  function alTeclear(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAbierto(true)
      setIndice((actual) =>
        Math.min(actual + 1, Math.max(filtradas.length - 1, 0)),
      )
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndice((actual) => Math.max(actual - 1, 0))
    } else if (evento.key === 'Enter') {
      if (abierto) {
        evento.preventDefault()
        if (filtradas[indice]) {
          seleccionar(filtradas[indice])
        }
      }
    } else if (evento.key === 'Escape') {
      setAbierto(false)
      setBuscando(false)
    }
  }

  return (
    <div className="campo-comercial">
      {etiqueta && <span>{etiqueta}</span>}
      <div className="campo-con-atajo">
        <div className="selector-buscable" ref={contenedorRef}>
          <input
            type="text"
            className={error ? 'input-error' : ''}
            value={valorMostrado}
            onChange={alEscribir}
            onFocus={alFoco}
            onKeyDown={alTeclear}
            placeholder={placeholder}
            disabled={deshabilitado}
            role="combobox"
            aria-expanded={abierto}
            aria-autocomplete="list"
          />
          {valor && !deshabilitado && (
            <button
              type="button"
              className="selector-buscable-limpiar"
              onClick={limpiar}
              aria-label="Limpiar selección"
            >
              <IconX size={14} />
            </button>
          )}
          {abierto && (
            <ul className="selector-buscable-lista" role="listbox">
              {buscando && (
                <li className="selector-buscable-estado">Buscando…</li>
              )}
              {!buscando && filtradas.length === 0 && (
                <li className="selector-buscable-estado">Sin resultados</li>
              )}
              {filtradas.map((opcion, posicion) => (
                <li
                  key={opcion.id}
                  role="option"
                  aria-selected={String(opcion.id) === String(valor)}
                  className={posicion === indice ? 'activo' : ''}
                  onMouseDown={(evento) => {
                    evento.preventDefault()
                    seleccionar(opcion)
                  }}
                >
                  <span>{textoOpcion(opcion)}</span>
                  {textoSecundario(opcion) && (
                    <small>{textoSecundario(opcion)}</small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onCrear && (
          <button
            type="button"
            className={`boton-atajo ${
              textoBoton ? 'boton-atajo-con-texto' : ''
            }`}
            onClick={onCrear}
            title={tituloCrear}
            aria-label={tituloCrear}
            disabled={deshabilitado}
          >
            <Icono size={17} />
            {textoBoton && (
              <span className="boton-atajo-texto">{textoBoton}</span>
            )}
          </button>
        )}
      </div>
      {mensajeError && (
        <small className="mensaje-error-campo">{mensajeError}</small>
      )}
    </div>
  )
}
