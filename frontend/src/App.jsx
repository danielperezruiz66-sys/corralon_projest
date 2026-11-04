import { Navigate, Route, Routes } from 'react-router-dom'
import MenuDesplegable from './components/MenuDesplegable.jsx'
import { useAuth } from './context/auth-context'
import { modulosDelMenu } from './data/menuConfig.js'
import CambiarContrasena from './pages/CambiarContrasena.jsx'
import Clientes from './pages/Clientes.jsx'
import EnDesarrollo from './pages/EnDesarrollo.jsx'
import Facturacion from './pages/Facturacion.jsx'
import Inicio from './pages/Inicio.jsx'
import Login from './pages/Login.jsx'

function RutaProtegida() {
  const { user } = useAuth()
  return user ? <MenuDesplegable /> : <Navigate to="/login" replace />
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
          modulo.mantenimiento ? (
            <Facturacion />
          ) : modulo.path === '/clientes' ? (
            <Clientes />
          ) : (
            <EnDesarrollo titulo={modulo.name} detalle={modulo.detalle} />
          )
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
