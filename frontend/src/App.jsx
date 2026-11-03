import { useState } from 'react'
import './App.css'
import AuthProvider from './auth/AuthProvider'
import { useAuth } from './auth/contexto'
import Layout from './components/Layout'
import Login from './components/Login'
import Facturacion from './pages/Facturacion'
import Inicio from './pages/Inicio'
import Productos from './pages/Productos'

function Contenido() {
  const { perfil, cargando } = useAuth()
  const [seccion, setSeccion] = useState('inicio')

  if (cargando) {
    return <div className="pantalla-carga">Cargando…</div>
  }

  if (!perfil) {
    return <Login />
  }

  return (
    <Layout seccion={seccion} onSeccion={setSeccion}>
      {seccion === 'productos' && <Productos />}
      {seccion === 'facturacion' && <Facturacion />}
      {seccion === 'inicio' && <Inicio onIr={setSeccion} />}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Contenido />
    </AuthProvider>
  )
}
