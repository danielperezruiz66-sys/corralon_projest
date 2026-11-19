import { useAuth } from '../context/auth-context'
import { iniciales } from '../utils/formato'
import '../styles/Encabezado.css'

export default function Encabezado({ titulo, subtitulo, children }) {
  const { user } = useAuth()
  const mostrarLegajo =
    Boolean(user?.legajo) &&
    user.legajo !== '—' &&
    user.legajo !== 'Superuser'

  return (
    <header className="encabezado-principal">
      <div className="contenedor-titulo-encabezado">
        {children}
        <div>
          <h1 className="titulo-principal-encabezado">{titulo}</h1>
          {subtitulo && <p className="subtitulo-encabezado">{subtitulo}</p>}
        </div>
      </div>
      <div className="encabezado-derecha">
        <div className="tarjeta-usuario-encabezado">
          <span className="avatar-usuario-encabezado">
            {iniciales(user?.nombre)}
          </span>
          <span className="datos-usuario-encabezado">
            <strong title={user?.nombre}>{user?.nombre}</strong>
            <span className="meta-usuario-encabezado">
              <span className="rol-usuario-encabezado">{user?.rol}</span>
              {mostrarLegajo && (
                <span className="legajo-usuario-encabezado">
                  Legajo {user.legajo}
                </span>
              )}
            </span>
          </span>
        </div>
      </div>
    </header>
  )
}
