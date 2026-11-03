import { useAuth } from '../auth/contexto'

export default function Inicio({ onSeccion }) {
  const { perfil } = useAuth()
  const nombre = perfil.empleado
    ? `${perfil.empleado.nombre} ${perfil.empleado.apellido}`
    : perfil.username

  return (
    <div className="inicio">
      <section className="tarjeta bienvenida">
        <h2>Hola, {nombre}</h2>
        <p>
          Este es el punto de partida del sistema. Desde el menú podés entrar al
          catálogo de productos y, más adelante, al resto de los módulos.
        </p>
        <div className="acciones">
          <button
            className="boton-primario"
            type="button"
            onClick={() => onSeccion('productos')}
          >
            Ver productos
          </button>
        </div>
      </section>

      <section className="grilla-tarjetas">
        <article className="tarjeta">
          <h3>Roles activos</h3>
          {perfil.roles.length ? (
            <ul className="lista-chips">
              {perfil.roles.map((rol) => (
                <li key={rol.id} className="chip">
                  {rol.ocupacion}
                </li>
              ))}
            </ul>
          ) : (
            <p className="texto-suave">
              No tenés roles asignados. Vas a poder consultar la información,
              pero no modificar datos.
            </p>
          )}
        </article>

        <article className="tarjeta">
          <h3>Facturación electrónica</h3>
          <p className="texto-suave">
            El módulo está en mantenimiento hasta terminar la integración con
            ARCA. Por ahora las facturas se consultan, pero no se emiten.
          </p>
        </article>
      </section>
    </div>
  )
}
