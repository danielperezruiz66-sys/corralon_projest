export default function TarjetaKpi({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  tono = '',
}) {
  return (
    <article className={`kpi-tarjeta ${tono}`}>
      <span className="kpi-icono">
        <Icono size={26} stroke={1.75} />
      </span>
      <div className="kpi-contenido">
        <p className="kpi-etiqueta">{etiqueta}</p>
        <p className="kpi-valor">{valor}</p>
        {detalle && <div className="kpi-detalle">{detalle}</div>}
      </div>
    </article>
  )
}
