import { useAuth } from '../context/auth-context'
import '../styles/Encabezado.css'

export default function Encabezado({ titulo, subtitulo, children }) {
  const { user } = useAuth()

  return (
    <header className="encabezado-principal">
      <div className="contenedor-titulo-encabezado">
        {children}
        <div>
          <h1 className="titulo-principal-encabezado">{titulo}</h1>
          {subtitulo && <p className="subtitulo-encabezado">{subtitulo}</p>}
        </div>
      </div>
      <div className="tarjeta-usuario-encabezado">
        <p>{user?.nombre}</p>
        <p>{user?.legajo}</p>
      </div>
    </header>
  )
}
