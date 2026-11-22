import { useState } from 'react'
import { IconX } from '@tabler/icons-react'
import '../../styles/components/comercial/FiltrosFecha.css'

function isoLocal(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function sumarDias(fecha, dias) {
  const copia = new Date(fecha)
  copia.setDate(copia.getDate() + dias)
  return copia
}

function inicioDelMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

export default function FiltrosFecha({ valores, onCambiar, error }) {
  const { desde, hasta, fecha } = valores
  const [hoy] = useState(() => new Date())
  const hoyIso = isoLocal(hoy)
  const ayerIso = isoLocal(sumarDias(hoy, -1))
  const haceSeisIso = isoLocal(sumarDias(hoy, -6))
  const inicioMesIso = isoLocal(inicioDelMes(hoy))

  function cambiar(cambios) {
    onCambiar({ ...valores, ...cambios })
  }

  function aplicarPreset(tipo) {
    if (tipo === 'todas') {
      cambiar({ desde: '', hasta: '', fecha: '' })
    } else if (tipo === 'hoy') {
      cambiar({ desde: '', hasta: '', fecha: hoyIso })
    } else if (tipo === 'ayer') {
      cambiar({ desde: '', hasta: '', fecha: ayerIso })
    } else if (tipo === '7d') {
      cambiar({ desde: haceSeisIso, hasta: hoyIso, fecha: '' })
    } else if (tipo === 'mes') {
      cambiar({ desde: inicioMesIso, hasta: hoyIso, fecha: '' })
    }
  }

  const presets = [
    { id: 'todas', etiqueta: 'Todas', activo: !desde && !hasta && !fecha },
    { id: 'hoy', etiqueta: 'Hoy', activo: fecha === hoyIso },
    { id: 'ayer', etiqueta: 'Ayer', activo: fecha === ayerIso },
    {
      id: '7d',
      etiqueta: 'Últimos 7 días',
      activo: desde === haceSeisIso && hasta === hoyIso && !fecha,
    },
    {
      id: 'mes',
      etiqueta: 'Este mes',
      activo: desde === inicioMesIso && hasta === hoyIso && !fecha,
    },
  ]

  return (
    <>
      <section className="filtros-tabs filtros-pills filtros-fechas-presets">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={preset.activo ? 'activo' : ''}
            onClick={() => aplicarPreset(preset.id)}
          >
            {preset.etiqueta}
          </button>
        ))}
      </section>

      <section className="filtros-campos filtros-campos-inline filtros-fechas-campos">
        <label className="campo-comercial">
          <span>Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(evento) =>
              cambiar({ desde: evento.target.value, fecha: '' })
            }
          />
        </label>
        <label className="campo-comercial">
          <span>Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(evento) =>
              cambiar({ hasta: evento.target.value, fecha: '' })
            }
          />
        </label>
        <label className="campo-comercial">
          <span>Un día</span>
          <input
            type="date"
            value={fecha}
            onChange={(evento) =>
              cambiar({
                fecha: evento.target.value,
                desde: '',
                hasta: '',
              })
            }
          />
        </label>
        {(desde || hasta || fecha) && (
          <button
            type="button"
            className="boton-comercial-secundario boton-limpiar-fechas"
            onClick={() => aplicarPreset('todas')}
          >
            <IconX size={16} />
            Limpiar fechas
          </button>
        )}
      </section>

      {error && <p className="filtros-fecha-error">{error}</p>}
    </>
  )
}
