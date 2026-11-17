import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { IconClock } from '@tabler/icons-react'
import MenuDesplegable from './components/MenuDesplegable.jsx'
import { useAuth } from './context/auth-context'
import { modulosDelMenu } from './data/menuConfig.js'

// Cada pagina se descarga recien cuando se entra a su ruta.
const Caja = lazy(() => import('./pages/Caja.jsx'))
const Clientes = lazy(() => import('./pages/Clientes.jsx'))
const Compras = lazy(() => import('./pages/Compras.jsx'))
const Empleados = lazy(() => import('./pages/Empleados.jsx'))
const EnDesarrollo = lazy(() => import('./pages/EnDesarrollo.jsx'))
const Facturacion = lazy(() => import('./pages/Facturacion.jsx'))
const Inicio = lazy(() => import('./pages/Inicio.jsx'))
const Inventario = lazy(() => import('./pages/Inventario.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Proveedores = lazy(() => import('./pages/Proveedores.jsx'))
const Ventas = lazy(() => import('./pages/Ventas.jsx'))

function CargandoModulo() {
  return <div className="cargando-modulo">Cargando…</div>
}

function RutaProtegida() {
  const { user } = useAuth()
  return user ? <MenuDesplegable /> : <Navigate to="/login" replace />
}

function ModuloProtegido({ modulo, children }) {
  const { puedeVer } = useAuth()
  if (!puedeVer(modulo)) {
    return <Navigate to="/" replace />
  }
  return <Suspense fallback={<CargandoModulo />}>{children}</Suspense>
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
  const { cargando, pausada } = useAuth()

  if (cargando) {
    return <div className="pantalla-carga">Cargando…</div>
  }

  if (pausada) {
    return (
      <div className="pantalla-sesion-pausada">
        <div className="tarjeta-sesion-pausada">
          <span className="icono-sesion-pausada">
            <IconClock size={30} stroke={1.75} />
          </span>
          <h1>Sesión en pausa</h1>
          <p>
            Pasaron 30 minutos sin actividad. Elegí una opción para continuar.
          </p>
        </div>
      </div>
    )
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
      <Route
        path="/login"
        element={
          <Suspense fallback={<div className="pantalla-carga">Cargando…</div>}>
            <Login />
          </Suspense>
        }
      />
      <Route element={<RutaProtegida />}>
        <Route
          index
          element={
            <Suspense fallback={<CargandoModulo />}>
              <Inicio />
            </Suspense>
          }
        />
        {rutasModulos}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
