import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'

export default function PanelCatalogo({
  titulo,
  tipo,
  campo,
  items,
  puedeEditar,
  onNuevo,
  onEditar,
  onEliminar,
}) {
  return (
    <section className="inventario-catalogo-panel">
      <div className="inventario-catalogo-cabecera">
        <h3>{titulo}</h3>
        {puedeEditar && (
          <button
            type="button"
            className="boton-comercial-secundario"
            onClick={onNuevo}
          >
            <IconPlus size={16} />
            Nuevo
          </button>
        )}
      </div>
      <div className="inventario-catalogo-lista">
        {items.length === 0 && (
          <p className="comercial-nota">No hay registros.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="inventario-catalogo-item">
            <span>{item[campo]}</span>
            {puedeEditar && (
              <div className="acciones-fila">
                <button
                  type="button"
                  className="boton-icono"
                  onClick={() => onEditar(item)}
                  title={`Editar ${tipo}`}
                >
                  <IconPencil size={15} />
                </button>
                <button
                  type="button"
                  className="boton-icono boton-icono-peligro"
                  onClick={() => onEliminar(item)}
                  title={`Eliminar ${tipo}`}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
