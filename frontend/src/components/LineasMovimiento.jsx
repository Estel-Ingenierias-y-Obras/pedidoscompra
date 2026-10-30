import { referenciaTlm } from "../utils/referenciaTlm";
import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import BuscadorMovimiento from "./BuscadorMovimiento";
import SelectorProducto from "./SelectorProducto";
import { obtenerProducto } from "../services/almacen";

function InventarioArticulo({ item, onProducto }) {
  const [cargando, setCargando] = useState(false), [error, setError] = useState(false);
  const numero = item?.number, inventario = item?.inventory;
  useEffect(() => {
    let vigente = true;
    setError(false);
    if (!numero || Number.isFinite(inventario) || !onProducto) { setCargando(false); return undefined; }
    setCargando(true);
    obtenerProducto(numero).then(producto => { if (vigente) onProducto(producto); })
      .catch(() => { if (vigente) setError(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [numero, inventario, onProducto]);
  if (Number.isFinite(inventario)) return inventario.toLocaleString("es-ES");
  if (error) return <span role="alert">Inventario no disponible</span>;
  return cargando ? <span role="status">Consultando…</span> : "—";
}

export default function LineasMovimiento({ lineas, articulos, cambiar, quitar, onProducto, buscarProductos }) {
  const opciones = useMemo(() => articulos.map(item => ({ codigo: item.number, referencia: referenciaTlm(item), nombre: item.displayName })), [articulos]);
  return <div className="warehouse-journal-scroll movement-lines"><table className="journal-table"><caption>Líneas de movimiento · cantidades en la unidad base del artículo</caption><thead><tr>{["Referencia", "Descripción", "Inventario", "Cantidad disponible", "Cantidad", "Unidad de medida", "Acciones"].map((titulo, index) => <th key={index} scope="col">{titulo}</th>)}</tr></thead>
    <tbody>{lineas.map((linea, index) => {
      const item = articulos.find(articulo => articulo.number === linea.numprod);
      return <tr key={linea.id}>
        <td>{buscarProductos
          ? <SelectorProducto label={`Artículo línea ${index + 1}`} producto={item} onProducto={onProducto} value={linea.numprod} onChange={codigo => cambiar(linea.id, { numprod: codigo, cantidad: "" })} />
          : <BuscadorMovimiento label={`Artículo línea ${index + 1}`} opciones={opciones} value={linea.numprod} onChange={codigo => cambiar(linea.id, { numprod: codigo, cantidad: "" })} />}</td>
        <td>{item?.displayName || "—"}</td>
        <td title="Inventario total en unidad base; no equivale a la disponibilidad del origen"><InventarioArticulo item={item} onProducto={onProducto} /></td>
        <td title="Pendiente de consulta de disponibilidad del origen en BC">—</td>
        <td><input aria-label={`Cantidad línea ${index + 1}`} type="number" min="0" step="any" value={linea.cantidad} onChange={event => cambiar(linea.id, { cantidad: event.target.value })} /></td>
        <td>{item?.baseUnitOfMeasureCode || "—"}</td>
        <td><button type="button" className="movement-delete" aria-label={`Eliminar línea ${index + 1}`} title="Eliminar línea" onClick={() => quitar(linea.id)}><FontAwesomeIcon icon={faTrash} /></button></td>
      </tr>;
    })}{!lineas.length && <tr><td colSpan={7}>Añade una línea para seleccionar los materiales.</td></tr>}</tbody></table></div>;
}
