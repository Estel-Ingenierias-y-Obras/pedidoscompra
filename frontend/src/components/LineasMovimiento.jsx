import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import BuscadorMovimiento from "./BuscadorMovimiento";
export default function LineasMovimiento({ lineas, articulos, cambiar, quitar }) {
  const opciones = useMemo(() => articulos.map(item => ({ codigo: item.number, nombre: item.displayName })), [articulos]);
  return <div className="warehouse-journal-scroll movement-lines"><table className="journal-table"><caption>Líneas de movimiento · cantidades en la unidad base del artículo</caption><thead><tr>{["Nº artículo", "Descripción", "Inventario", "Cantidad disponible", "Cantidad", "Unidad de medida", "Acciones"].map((titulo, index) => <th key={index} scope="col">{titulo}</th>)}</tr></thead>
    <tbody>{lineas.map((linea, index) => {
      const item = articulos.find(articulo => articulo.number === linea.numprod);
      return <tr key={linea.id}>
        <td><BuscadorMovimiento label={`Artículo línea ${index + 1}`} opciones={opciones} value={linea.numprod} onChange={codigo => cambiar(linea.id, { numprod: codigo, cantidad: "" })} /></td>
        <td>{item?.displayName || "—"}</td>
        <td title="Inventario total en unidad base; no equivale a la disponibilidad del origen">{Number.isFinite(item?.inventory) ? item.inventory.toLocaleString("es-ES") : "—"}</td>
        <td title="Pendiente de consulta de disponibilidad del origen en BC">—</td>
        <td><input aria-label={`Cantidad línea ${index + 1}`} type="number" min="0" step="any" value={linea.cantidad} onChange={event => cambiar(linea.id, { cantidad: event.target.value })} /></td>
        <td>{item?.baseUnitOfMeasureCode || "—"}</td>
        <td><button type="button" className="movement-delete" aria-label={`Eliminar línea ${index + 1}`} title="Eliminar línea" onClick={() => quitar(linea.id)}><FontAwesomeIcon icon={faTrash} /></button></td>
      </tr>;
    })}{!lineas.length && <tr><td colSpan={7}>Añade una línea para seleccionar los materiales.</td></tr>}</tbody></table></div>;
}
