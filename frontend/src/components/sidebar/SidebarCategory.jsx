import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import SidebarItem from './SidebarItem'

export default function SidebarCategory({
  cat,
  modulosAutorizados,
  abierto,
  isDesplegada,
  onToggleCategoria,
  onModuloClick,
}) {
  const CatIcon = cat.icono

  if (cat.id === 'principal' || !abierto) {
    return modulosAutorizados.map((modulo) => (
      <SidebarItem
        key={modulo.path}
        modulo={modulo}
        abierto={abierto}
        onModuloClick={onModuloClick}
      />
    ))
  }

  return (
    <div className="menu-categoria-grupo">
      <button
        type="button"
        className="menu-categoria-boton"
        onClick={() => onToggleCategoria(cat.id)}
      >
        <div className="categoria-titulo-icono">
          <CatIcon size={20} />
          <span>{cat.title}</span>
        </div>
        {isDesplegada ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
      </button>

      {isDesplegada && (
        <div className="menu-submodulos">
          {modulosAutorizados.map((modulo) => (
            <SidebarItem
              key={modulo.path}
              modulo={modulo}
              abierto={abierto}
              onModuloClick={onModuloClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
