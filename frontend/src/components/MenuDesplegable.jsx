import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  IconHome2,
  IconMenu2,
  IconUserCircle,
} from '@tabler/icons-react'
import { useAuth } from '../context/auth-context'
import { menuCategories } from '../data/menuConfig.js'
import SidebarCategory from './sidebar/SidebarCategory'
import SidebarFooter from './sidebar/SidebarFooter'
import SidebarHeader from './sidebar/SidebarHeader'
import '../styles/MenuDesplegable.css'

const clasesInferior = ({ isActive }) =>
  `item-inferior-base ${isActive ? 'item-inferior-activo' : 'item-inferior-inactivo'}`

export default function MenuDesplegable() {
  const [abierto, setAbierto] = useState(true)
  const [menuMovil, setMenuMovil] = useState(false)
  const [esMovil, setEsMovil] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )
  const [categoriasAbiertas, setCategoriasAbiertas] = useState({
    comercial: true,
    inventario: true,
    administracion: true,
    sistema: true,
  })

  const { user, logout, puedeVer } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 767px)')
    const alCambiar = (evento) => {
      setEsMovil(evento.matches)
      if (!evento.matches) {
        setMenuMovil(false)
      }
    }
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])

  const toggleCategoria = (id) => {
    setCategoriasAbiertas((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const alternarMenu = () => {
    if (esMovil) {
      setMenuMovil((prev) => !prev)
    } else {
      setAbierto((prev) => !prev)
    }
  }

  const cerrarMenuMovil = () => setMenuMovil(false)

  const handleLogoutClick = () => {
    cerrarMenuMovil()
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: '¿Estás seguro de que deseas salir del sistema?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4a9da8',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
    }).then((resultado) => {
      if (resultado.isConfirmed) {
        logout()
        navigate('/login', { replace: true })
      }
    })
  }

  const categorias = menuCategories
    .map((categoria) => ({
      ...categoria,
      modules: categoria.modules.filter((modulo) => puedeVer(modulo)),
    }))
    .filter((categoria) => categoria.modules.length > 0)

  const menuAbierto = esMovil ? true : abierto

  return (
    <div className="layout-contenedor">
      <aside
        className={`layout-aside ${
          abierto ? 'layout-aside-ancho-abierto' : 'layout-aside-ancho-cerrado'
        } ${menuMovil ? 'layout-aside-movil-abierto' : ''}`}
      >
        <SidebarHeader
          abierto={menuAbierto}
          onToggle={alternarMenu}
          esMovil={esMovil}
        />

        <nav className="layout-nav-links">
          {categorias.map((categoria) => (
            <SidebarCategory
              key={categoria.id}
              cat={categoria}
              modulosAutorizados={categoria.modules}
              abierto={menuAbierto}
              isDesplegada={categoriasAbiertas[categoria.id]}
              onToggleCategoria={toggleCategoria}
              onModuloClick={cerrarMenuMovil}
            />
          ))}
        </nav>

        <SidebarFooter
          abierto={menuAbierto}
          onLogoutClick={handleLogoutClick}
        />
      </aside>

      {menuMovil && (
        <button
          type="button"
          className="layout-overlay"
          aria-label="Cerrar menú"
          onClick={cerrarMenuMovil}
        />
      )}

      <div className="layout-columna">
        <header className="layout-barra-movil">
          <button
            type="button"
            className="layout-barra-boton"
            aria-label="Abrir menú"
            onClick={() => setMenuMovil(true)}
          >
            <IconMenu2 size={26} />
          </button>
          <span className="layout-barra-logo">FER-CONS</span>
          <span className="layout-barra-usuario">{user?.nombre}</span>
        </header>

        <main className="layout-main">
          <Outlet />
        </main>
      </div>

      <nav className="layout-nav-movil">
        <NavLink to="/" end className={clasesInferior}>
          <IconHome2 size={20} />
          Inicio
        </NavLink>
        <button
          type="button"
          className="item-inferior-base item-inferior-inactivo"
          onClick={() => setMenuMovil(true)}
        >
          <IconMenu2 size={20} />
          Módulos
        </button>
        <NavLink to="/perfil" className={clasesInferior}>
          <IconUserCircle size={20} />
          Perfil
        </NavLink>
      </nav>
    </div>
  )
}
