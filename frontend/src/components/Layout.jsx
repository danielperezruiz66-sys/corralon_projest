import { useAuth } from '../auth/contexto'
import { SECCIONES } from '../secciones'

function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) {
    return '?'
  }
  const primera = partes[0][0]
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return `${primera}${segunda}`.toUpperCase()
}

export default function Layout({ seccion, onSeccion, children }) {
  const { perfil, logout } = useAuth()
  const actual =
    SECCIONES.find((opcion) => opcion.id === seccion) ?? SECCIONES[0]

  const nombre = perfil.empleado
    ? `${perfil.empleado.nombre} ${perfil.empleado.apellido}`
    : perfil.username
  const roles = perfil.roles.length
    ? perfil.roles.map((rol) => rol.ocupacion).join(' · ')
    : 'Sin rol asignado'

  return (
    <div className="app">
      <aside className="barra">
        <div className="marca">
          <span className="marca-logo">FC</span>
          <div>
            <strong>Fer-Cons</strong>
            <small>Gestión de corralón</small>
          </div>
        </div>

        <nav className="menu" aria-label="Secciones">
          {SECCIONES.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              className={`menu-opcion${opcion.id === actual.id ? ' activa' : ''}`}
              onClick={() => onSeccion(opcion.id)}
            >
              <span>{opcion.etiqueta}</span>
              {opcion.mantenimiento && (
                <span className="etiqueta-mantenimiento">Mantenimiento</span>
              )}
            </button>
          ))}
        </nav>

        <div className="barra-pie">
          <div className="usuario">
            <span className="avatar">{iniciales(nombre)}</span>
            <div className="usuario-datos">
              <strong>{nombre}</strong>
              <small>{roles}</small>
            </div>
          </div>
          <button className="boton-salir" type="button" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="contenido">
        <header className="encabezado">
          <div>
            <h1>{actual.titulo}</h1>
            <p>{actual.descripcion}</p>
          </div>
        </header>
        <div className="pagina">{children}</div>
      </main>
    </div>
  )
}
