import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api";
import "./Almacen.css";
import "./VisualizarPedidosCompra.css";

const estados = { Open: "Abierto", Released: "Lanzado", "Pending Approval": "Pendiente de aprobación", "Pending Prepayment": "Pendiente de anticipo" };
const decimal = valor => typeof valor === "number" ? valor.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
const fecha = valor => /^\d{4}-\d{2}-\d{2}$/.test(valor || "") ? valor.split("-").reverse().join("/") : "—";
const mensaje = error => error.response?.data?.error || "No se pudieron cargar los datos de Business Central.";

function LineasPedido({ numero }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    setDatos(null); setError("");
    api.get(`/api/pedidos-compra/${encodeURIComponent(numero)}/lineas`).then(res => {
      if (activo) { if (!Array.isArray(res.data)) setError("Respuesta de líneas no válida."); else setDatos(res.data); }
    }).catch(err => { if (activo) setError(mensaje(err)); });
    return () => { activo = false; };
  }, [numero, intento]);
  if (error) return <div role="alert">{error} <button onClick={() => setIntento(i => i + 1)}>Reintentar artículos</button></div>;
  if (!datos) return <p role="status">Cargando artículos…</p>;
  return <div className="warehouse-journal-scroll"><table className="journal-table"><caption>Artículos del pedido {numero}</caption>
    <thead><tr>{["Referencia", "Descripción", "Inventario", "Cantidad disponible", "Cantidad", "Unidad de medida"].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
    <tbody>{datos.map(l => <tr key={l.id || l.lineNumber}><td>{l.referencia || l.Referencia || "—"}</td><td>{l.Description || "—"}</td><td title={`Inventario actual en unidad base: ${l.unidadInventario || "no disponible"}`}>{decimal(l.inventario)}</td><td>—</td><td>{decimal(l.Cantidad)}</td><td>{l.unitOfMeasureCode || "—"}</td></tr>)}{!datos.length && <tr><td colSpan={6}>Este pedido no tiene líneas.</td></tr>}</tbody>
  </table><p>Inventario actual en la unidad base del artículo. Cantidad disponible pendiente de consulta del almacén; los guiones indican datos no disponibles.</p></div>;
}

export default function VisualizarPedidosCompra() {
  const [anio, setAnio] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [abiertos, setAbiertos] = useState({});

  useEffect(() => {
    let activo = true;
    setDatos(null); setError(""); setAbiertos({});
    if (!consulta) { setCargando(false); return; }
    setCargando(true);
    api.get("/api/pedidos-compra", { params: consulta }).then(res => {
      if (activo) setDatos(res.data);
    }).catch(err => { if (activo) setError(mensaje(err)); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [consulta]);
  const buscar = event => { event.preventDefault(); setConsulta({ anio, pagina: 1, ordenar: "documentDate", direccion: "desc" }); };
  const ordenar = campo => setConsulta(prev => ({ ...prev, ordenar: campo, direccion: prev.ordenar === campo && prev.direccion === "asc" ? "desc" : "asc", pagina: 1 }));
  const pagina = numero => setConsulta(prev => ({ ...prev, pagina: numero }));
  return <Layout><div className="page-header"><Link className="back-link" to="/pedidos-compra">← Pedidos Compra</Link><h1>Visualizar</h1><p className="page-subtitle">Pedidos de compra de Business Central · 100 pedidos por página</p></div>
    <div className="page-content purchase-orders">
      <form className="purchase-filters" onSubmit={buscar}>
        <label>Año de emisión<input type="number" min="2000" max="9998" required placeholder="Selecciona un año" value={anio} onChange={e => { setAnio(e.target.value); setConsulta(null); }} /></label>
        <button type="submit" disabled={!anio || cargando}>Mostrar pedidos</button>
      </form>
      {!consulta && <p>Selecciona el año y pulsa Mostrar pedidos. Se usará la fecha de emisión del documento.</p>}
      {cargando && <p role="status">Cargando pedidos…</p>}
      {error && <p role="alert">{error} <button onClick={() => setConsulta({ ...consulta })}>Reintentar</button></p>}
      {datos && consulta && <><p role="status">{datos.total} pedidos · Año {consulta.anio}</p><div className="warehouse-journal-scroll"><table className="journal-table"><caption>Pedidos de compra</caption><thead><tr>{[["number", "Nº"], ["buyFromVendorNumber", "Compra a Nº Proveedor"], ["NombreCliente", "Compra a Nombre"], ["documentDate", "Fecha emisión documento"], ["Estado", "Estado"], ["amount", "Importe"], ["amountIncludingVAT", "Importe IVA incl."], ["Proyecto", "Proyecto"]].map(([campo, titulo]) => <th key={campo} scope="col" aria-sort={consulta.ordenar === campo ? (consulta.direccion === "asc" ? "ascending" : "descending") : "none"}><button className="purchase-sort" onClick={() => ordenar(campo)} aria-label={`Ordenar por ${titulo}`}>{titulo} {consulta.ordenar === campo ? (consulta.direccion === "asc" ? "↑" : "↓") : "↕"}</button></th>)}</tr></thead>
        <tbody>{datos.pedidos.map(p => <Fragment key={p.number}><tr className="purchase-order-row" onClick={() => setAbiertos(prev => ({ ...prev, [p.number]: !prev[p.number] }))}>
          <td><button aria-expanded={!!abiertos[p.number]} aria-label={`Artículos del pedido ${p.number}`} onClick={e => { e.stopPropagation(); setAbiertos(prev => ({ ...prev, [p.number]: !prev[p.number] })); }}>{abiertos[p.number] ? "▾" : "▸"} {p.number}</button></td>
          <td>{p.buyFromVendorNumber}</td><td>{p.NombreCliente}</td><td>{fecha(p.documentDate)}</td><td>{estados[p.Estado] || p.Estado}</td><td>{decimal(p.amount)}</td><td>{decimal(p.amountIncludingVAT)}</td><td>{p.Proyecto || "—"}</td>
        </tr>{abiertos[p.number] && <tr><td colSpan={8}><LineasPedido numero={p.number} /></td></tr>}</Fragment>)}{!datos.pedidos.length && <tr><td colSpan={8}>No hay pedidos con estos filtros.</td></tr>}</tbody>
      </table></div><nav className="purchase-pagination" aria-label="Paginación de pedidos"><button disabled={datos.pagina <= 1 || cargando} onClick={() => pagina(datos.pagina - 1)}>Anterior</button><label>Página <input aria-label="Número de página" type="number" min="1" max={Math.max(1, datos.paginas)} key={datos.pagina} defaultValue={datos.pagina} onKeyDown={e => { if (e.key === "Enter") { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= datos.paginas) pagina(n); } }} onBlur={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= datos.paginas && n !== datos.pagina) pagina(n); else e.target.value = datos.pagina; }} /> de {Math.max(1, datos.paginas)}</label><button disabled={datos.pagina >= datos.paginas || cargando} onClick={() => pagina(datos.pagina + 1)}>Siguiente</button></nav></>}
    </div></Layout>;
}
