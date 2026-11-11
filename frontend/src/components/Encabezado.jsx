import { IconBuildingWarehouse } from '@tabler/icons-react'
import { useAuth } from '../context/auth-context'
import { useSucursal } from '../context/sucursal-context'
import CampoSelectorBuscable from './common/CampoSelectorBuscable.jsx'
import '../styles/Encabezado.css'

export default function Encabezado({ titulo, subtitulo, children }) {
  const { user } = useAuth()
  const { sucursales, sucursalActiva, cambiarSucursal } = useSucursal()

  return (
    <header className="encabezado-principal">
      <div className="contenedor-titulo-encabezado">
        {children}
        <div>
          <h1 className="titulo-principal-encabezado">{titulo}</h1>
          {subtitulo && <p className="subtitulo-encabezado">{subtitulo}</p>}
        </div>
      </div>
      <div className="encabezado-derecha">
        {sucursales.length > 0 && (
          <div className="selector-sucursal-encabezado">
            <IconBuildingWarehouse size={18} />
            <span>Sucursal</span>
            <CampoSelectorBuscable
              valor={sucursalActiva}
              onCambiar={cambiarSucursal}
              opciones={sucursales}
              textoOpcion={(sucursal) => sucursal.nombre}
              placeholder="Todas"
            />
          </div>
        )}
        <div className="tarjeta-usuario-encabezado">
          <p>{user?.nombre}</p>
          <p>{user?.legajo}</p>
        </div>
      </div>
    </header>
  )
}
