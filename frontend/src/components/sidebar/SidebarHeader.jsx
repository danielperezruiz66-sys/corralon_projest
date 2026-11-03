import { IconAdjustments, IconSettings, IconX } from '@tabler/icons-react'

export default function SidebarHeader({ abierto, onToggle, esMovil }) {
  return (
    <div className="layout-header-sidebar">
      <button
        onClick={onToggle}
        aria-label={esMovil ? 'Cerrar menú' : 'Abrir o cerrar menú'}
        className="layout-boton-toggle"
      >
        {esMovil ? (
          <IconX size={26} />
        ) : abierto ? (
          <IconSettings size={28} />
        ) : (
          <IconAdjustments size={28} />
        )}
      </button>
      {abierto && <span className="layout-logo-texto">FER-CONS</span>}
    </div>
  )
}
