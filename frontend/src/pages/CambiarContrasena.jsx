import { IconKey } from '@tabler/icons-react'
import Encabezado from '../components/Encabezado.jsx'
import '../styles/Placeholder.css'

export default function CambiarContrasena() {
  return (
    <>
      <Encabezado
        titulo="Cambiar contraseña"
        subtitulo="Seguridad de tu cuenta"
      />
      <div className="placeholder-contenido">
        <article className="placeholder-panel">
          <span className="placeholder-icono">
            <IconKey size={40} stroke={1.5} />
          </span>
          <h2>Próximamente</h2>
          <p>
            El cambio de contraseña necesita un endpoint nuevo en el backend.
            Cuando esté disponible, esta pantalla va a pedir la contraseña
            actual y la nueva, con validación y confirmación.
          </p>
          <p className="placeholder-nota">
            Por ahora, si necesitás restablecer tu acceso, contactá al
            administrador del sistema.
          </p>
        </article>
      </div>
    </>
  )
}
