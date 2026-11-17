import { IconLogout } from '@tabler/icons-react'

export default function SidebarFooter({ abierto, onLogoutClick }) {
  return (
    <div className="layout-pie-sidebar">
      <button
        type="button"
        onClick={onLogoutClick}
        className="item-base-sidebar layout-boton-logout"
        title="Cerrar sesión"
      >
        <IconLogout size={abierto ? 22 : 24} />
        {abierto && <span>Cerrar sesión</span>}
      </button>
    </div>
  )
}
