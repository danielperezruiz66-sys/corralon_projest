import { Navigate, Route, Routes } from 'react-router-dom'
import MenuDesplegable from './components/MenuDesplegable.jsx'
import { useAuth } from './context/auth-context'
import { modulosDelMenu } from './data/menuConfig.js'
import CambiarContrasena from './pages/CambiarContrasena.jsx'
import Caja from './pages/Caja.jsx'
import Clientes from './pages/Clientes.jsx'
import Compras from './pages/Compras.jsx'
import Facturacion from './pages/Facturacion.jsx'
import Empleados from './pages/Empleados.jsx'
import EnDesarrollo from './pages/EnDesarrollo.jsx'
import Inicio from './pages/Inicio.jsx'
import Inventario from './pages/Inventario.jsx'
import Login from './pages/Login.jsx'
import Proveedores from './pages/Proveedores.jsx'
import Ventas from './pages/Ventas.jsx'

function RutaProtegida() {
  const { user } = useAuth()
  return user ? <MenuDesplegable /> : <Navigate to="/login" replace />
}

function ModuloProtegido({ modulo, children }) {
  const { puedeVer } = useAuth()
  return puedeVer(modulo) ? children : <Navigate to="/" replace />
}

function contenidoModulo(modulo) {
  if (modulo.mantenimiento) {
    return <Facturacion />
  }
  if (modulo.path === '/caja') {
    return <Caja />
  }
  if (modulo.path === '/empleados') {
    return <Empleados />
  }
  if (modulo.path === '/clientes') {
    return <Clientes />
  }
  if (modulo.path === '/ventas') {
    return <Ventas />
  }
  if (modulo.path === '/compras') {
    return <Compras />
  }
  if (modulo.path === '/productos') {
    return <Inventario />
  }
  if (modulo.path === '/proveedores') {
    return <Proveedores />
  }
  return <EnDesarrollo titulo={modulo.name} detalle={modulo.detalle} />
}

export default function App() {
  const { cargando } = useAuth()

  if (cargando) {
    return <div className="pantalla-carga">Cargando…</div>
  }

  const rutasModulos = modulosDelMenu
    .filter((modulo) => modulo.path !== '/')
    .map((modulo) => (
      <Route
        key={modulo.path}
        path={modulo.path.replace(/^\//, '')}
        element={
          <ModuloProtegido modulo={modulo}>
            {contenidoModulo(modulo)}
          </ModuloProtegido>
        }
      />
    ))

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RutaProtegida />}>
        <Route index element={<Inicio />} />
        {rutasModulos}
        <Route path="cambiar-contrasena" element={<CambiarContrasena />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
