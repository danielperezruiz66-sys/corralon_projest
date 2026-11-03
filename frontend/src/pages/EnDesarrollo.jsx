import { IconTool } from '@tabler/icons-react'
import Encabezado from '../components/Encabezado.jsx'
import '../styles/Placeholder.css'

export default function EnDesarrollo({ titulo, detalle }) {
  return (
    <>
      <Encabezado titulo={titulo} subtitulo={detalle} />
      <div className="placeholder-contenido">
        <article className="placeholder-panel">
          <span className="placeholder-icono">
            <IconTool size={40} stroke={1.5} />
          </span>
          <h2>Módulo en desarrollo</h2>
          <p>
            La estructura visual y el acceso desde el menú ya están listos. En
            la próxima tanda conectamos esta pantalla con la API y definimos sus
            campos.
          </p>
        </article>
      </div>
    </>
  )
}
