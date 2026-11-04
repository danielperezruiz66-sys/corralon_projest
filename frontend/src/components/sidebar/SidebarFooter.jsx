import { NavLink } from 'react-router-dom'
import { IconKey, IconLogout } from '@tabler/icons-react'
import { useAuth } from '../../context/auth-context'
import { iniciales } from '../../utils/formato'

export default function SidebarFooter({ abierto, onLogoutClick }) {
  const { user } = useAuth()

  return (
    <div className="layout-pie-sidebar">
      <div className="sidebar-usuario">
        <span className="sidebar-avatar">{iniciales(user?.nombre)}</span>
        {abierto && (
          <span className="sidebar-datos">
            <strong>{user?.nombre}</strong>
            <small>{user?.rol}</small>
          </span>
        )}
      </div>

      <NavLink
        to="/cambiar-contrasena"
        className="item-base-sidebar item-pie-sidebar"
        title="Cambiar contraseña"
      >
        <IconKey size={abierto ? 22 : 24} />
        {abierto && <span>Cambiar contraseña</span>}
      </NavLink>

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
