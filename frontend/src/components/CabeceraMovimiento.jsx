import BuscadorMovimiento from "./BuscadorMovimiento";
export default function CabeceraMovimiento({ cabecera, cambiar, catalogos, proyectos }) {
  const selector = (campo, titulo, opciones) => <label>{titulo}<select value={cabecera[campo] || ""} onChange={event => cambiar({ [campo]: event.target.value })}><option value="">Seleccionar…</option>{opciones.map(item => <option key={item.codigo} value={item.codigo}>{item.nombre ? `${item.codigo} · ${item.nombre}` : item.codigo}</option>)}</select></label>;
  const almacenes = (catalogos.almacenes || []).map(item => ({ codigo: item.code, nombre: item.displayName }));
  const rutas = lado => <fieldset><legend>{lado === "origen" ? "Origen" : "Destino"}</legend><label>Tipo<select value={cabecera[`tipo${lado}`]} onChange={event => cambiar({ [`tipo${lado}`]: event.target.value, [lado]: "" })}><option value="Location">Almacén</option><option value="Job">Proyecto</option></select></label><label>Código<BuscadorMovimiento key={cabecera[`tipo${lado}`]} label={`${lado === "origen" ? "Origen" : "Destino"} código`} opciones={cabecera[`tipo${lado}`] === "Location" ? almacenes : proyectos} value={cabecera[lado]} onChange={codigo => cambiar({ [lado]: codigo })} /></label></fieldset>;
  const tipos = (catalogos.tiposProyecto || []).filter(item => ["DIRECTO", "INDIRECTO"].includes(String(item.codigo).toUpperCase())).map(item => ({ codigo: item.codigo, nombre: item.descripcion || item.nombre }));
  return <div className="movement-header">
    {rutas("origen")}{rutas("destino")}
    <fieldset><legend>Datos del movimiento</legend>
      <label>Solicitante<BuscadorMovimiento label="Solicitante" opciones={catalogos.recursos || []} value={cabecera.solicitante} onChange={codigo => cambiar({ solicitante: codigo })} /></label>
      {selector("tipoproyectocodigo", "Tipo proyecto código", tipos)}
      {selector("departamento", "Departamento", (catalogos.departamentos || []).map(item => ({ codigo: item.code, nombre: item.displayName })))}
      {selector("zona", "Zona", (catalogos.zonas || []).map(item => ({ codigo: item.code, nombre: item.displayName })))}
    </fieldset>
  </div>;
}
