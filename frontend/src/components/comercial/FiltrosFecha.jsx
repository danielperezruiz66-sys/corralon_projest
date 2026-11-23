import { useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { fechaIso, sumarDias } from '../../utils/fechas'
import '../../styles/components/comercial/FiltrosFecha.css'

function inicioDelMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

function fechaLegible(iso) {
  const [anio, mes, dia] = String(iso || '').split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso
}

function menorIso(primera, segunda) {
  if (!primera) {
    return segunda || ''
  }
  if (!segunda) {
    return primera
  }
  return primera < segunda ? primera : segunda
}

export default function FiltrosFecha({
  valores,
  onCambiar,
  error,
  desdeMaximo = '',
  hastaMaximo = '',
  diaMaximo = '',
}) {
  const { desde, hasta, fecha } = valores
  const [hoy] = useState(() => new Date())
  const [aviso, setAviso] = useState('')
  const hoyIso = fechaIso(hoy)
  const ayerIso = fechaIso(sumarDias(hoy, -1))
  const haceSeisIso = fechaIso(sumarDias(hoy, -6))
  const inicioMesIso = fechaIso(inicioDelMes(hoy))
  const maximoDesde = menorIso(desdeMaximo, hasta)
  const minimoHasta = desde || ''

  function cambiar(cambios) {
    onCambiar({ ...valores, ...cambios })
  }

  function limitarFecha(valor, maximo, etiqueta) {
    if (!valor || !maximo || valor <= maximo) {
      setAviso('')
      return valor
    }
    setAviso(
      `${etiqueta} no puede ser posterior a ${fechaLegible(
        maximo,
      )}. Se ajustó al máximo permitido.`,
    )
    return maximo
  }

  function aplicarPreset(tipo) {
    setAviso('')
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
    <section className="filtros-fechas">
      <div className="filtros-tabs filtros-fechas-presets">
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
      </div>

      <div className="filtros-fechas-campos">
        <label className="campo-comercial">
          <span>Desde</span>
          <input
            type="date"
            value={desde}
            max={maximoDesde || undefined}
            onChange={(evento) =>
              cambiar({
                desde: limitarFecha(
                  evento.target.value,
                  desdeMaximo,
                  'La fecha desde',
                ),
                fecha: '',
              })
            }
          />
        </label>
        <label className="campo-comercial">
          <span>Hasta</span>
          <input
            type="date"
            value={hasta}
            min={minimoHasta || undefined}
            max={hastaMaximo || undefined}
            onChange={(evento) =>
              cambiar({
                hasta: limitarFecha(
                  evento.target.value,
                  hastaMaximo,
                  'La fecha hasta',
                ),
                fecha: '',
              })
            }
          />
        </label>
        <label className="campo-comercial">
          <span>Un día</span>
          <input
            type="date"
            value={fecha}
            max={diaMaximo || undefined}
            onChange={(evento) =>
              cambiar({
                fecha: limitarFecha(
                  evento.target.value,
                  diaMaximo,
                  'La fecha',
                ),
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
      </div>

      {error && <p className="filtros-fecha-error">{error}</p>}
      {aviso && !error && <p className="filtros-fecha-aviso">{aviso}</p>}
    </section>
  )
}
