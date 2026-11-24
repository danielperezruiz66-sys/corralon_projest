import { NavLink } from 'react-router-dom'
import { IconCash, IconLogout } from '@tabler/icons-react'
import { sinSucursal } from '../../utils/formato'

export default function SidebarFooter({ abierto, cajaAbierta, onLogoutClick }) {
  return (
    <div className="layout-pie-sidebar">
      {cajaAbierta && (
        <NavLink
          to="/caja"
          className="sidebar-caja-abierta"
          title={`Movimiento #${cajaAbierta.id} · ${sinSucursal(
            cajaAbierta.caja_detalle,
            cajaAbierta.sucursal_detalle,
          )}`}
        >
          <IconCash size={abierto ? 20 : 22} />
          {abierto && (
            <span>
              {cajaAbierta.estado === 'PA' ? 'Movimiento en pausa' : 'Movimiento abierto'}
              <small>Movimiento #{cajaAbierta.id}</small>
            </span>
          )}
        </NavLink>
      )}

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
