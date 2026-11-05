import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
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
  return <div className="warehouse-journal-scroll"><table className="journal-table purchase-order-lines" aria-label={`Artículos del pedido ${numero}`}>
    <thead><tr>{["Referencia", "Descripción", "Inventario", "Cantidad disponible", "Cantidad", "Unidad de medida"].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
    <tbody>{datos.map(l => <tr key={l.id || l.lineNumber}><td>{l.referencia || l.Referencia || "—"}</td><td>{l.Description || "—"}</td><td title={`Inventario actual en unidad base: ${l.unidadInventario || "no disponible"}`}>{decimal(l.inventario)}</td><td>—</td><td>{decimal(l.Cantidad)}</td><td>{l.unitOfMeasureCode || "—"}</td></tr>)}{!datos.length && <tr><td colSpan={6}>Este pedido no tiene líneas.</td></tr>}</tbody>
  </table></div>;
}

export default function VisualizarPedidosCompra() {
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState({ buscar: "", pagina: 1, ordenar: "documentDate", direccion: "desc" });
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
  useEffect(() => {
    const espera = setTimeout(() => setConsulta(prev => prev.buscar === busqueda.trim() ? prev : { ...prev, buscar: busqueda.trim(), pagina: 1 }), 350);
    return () => clearTimeout(espera);
  }, [busqueda]);
  const buscar = event => { event.preventDefault(); setConsulta(prev => ({ ...prev, buscar: busqueda.trim(), pagina: 1 })); };
  const ordenar = campo => setConsulta(prev => ({ ...prev, ordenar: campo, direccion: prev.ordenar === campo && prev.direccion === "asc" ? "desc" : "asc", pagina: 1 }));
  const pagina = numero => setConsulta(prev => ({ ...prev, pagina: numero }));
  return <Layout><div className="page-header"><Link className="back-link" to="/pedidos-compra">← Pedidos Compra</Link><h1>Visualizar</h1><p className="page-subtitle">Pedidos de Compra · 100 pedidos por página</p></div>
    <div className="page-content purchase-orders">
      <form className="purchase-filters" onSubmit={buscar}>
        <label htmlFor="purchase-order-search">Buscar por Nº</label>
        <div className="purchase-search-controls">
          <input id="purchase-order-search" type="search" maxLength={100} placeholder="Nº del pedido de compra" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <button type="submit" className="purchase-search-button" aria-label="Buscar pedidos" title="Buscar"><FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" /></button>
        </div>
      </form>
      {cargando && <p role="status">Cargando pedidos…</p>}
      {error && <p role="alert">{error} <button onClick={() => setConsulta({ ...consulta })}>Reintentar</button></p>}
      {datos && consulta && <><div className="warehouse-journal-scroll"><table className="journal-table purchase-orders-table"><caption>Pedidos de compra</caption><thead><tr>{[["number", "Nº"], ["buyFromVendorNumber", "Compra a Nº Proveedor"], ["NombreCliente", "Compra a Nombre"], ["documentDate", "Fecha emisión documento"], ["Estado", "Estado"], ["amount", "Importe"], ["amountIncludingVAT", "Importe IVA incl."], ["Proyecto", "Proyecto"]].map(([campo, titulo]) => <th key={campo} scope="col" aria-sort={consulta.ordenar === campo ? (consulta.direccion === "asc" ? "ascending" : "descending") : "none"}><button className="purchase-sort" onClick={() => ordenar(campo)} aria-label={`Ordenar por ${titulo}`}>{titulo} {consulta.ordenar === campo ? (consulta.direccion === "asc" ? "↑" : "↓") : "↕"}</button></th>)}</tr></thead>
        <tbody>{datos.pedidos.map(p => <Fragment key={p.number}><tr className="purchase-order-row" onClick={() => setAbiertos(prev => ({ ...prev, [p.number]: !prev[p.number] }))}>
          <td data-label="Nº"><button aria-expanded={!!abiertos[p.number]} aria-label={`Artículos del pedido ${p.number}`} onClick={e => { e.stopPropagation(); setAbiertos(prev => ({ ...prev, [p.number]: !prev[p.number] })); }}>{abiertos[p.number] ? "▾" : "▸"} {p.number}</button></td>
          <td data-label="Compra a Nº Proveedor">{p.buyFromVendorNumber}</td><td data-label="Compra a Nombre">{p.NombreCliente}</td><td data-label="Fecha emisión documento">{fecha(p.documentDate)}</td><td data-label="Estado">{estados[p.Estado] || p.Estado}</td><td data-label="Importe">{decimal(p.amount)}</td><td data-label="Importe IVA incl.">{decimal(p.amountIncludingVAT)}</td><td data-label="Proyecto">{p.Proyecto || "—"}</td>
        </tr>{abiertos[p.number] && <tr className="purchase-order-expanded"><td colSpan={8}><LineasPedido numero={p.number} /></td></tr>}</Fragment>)}{!datos.pedidos.length && <tr><td colSpan={8}>No hay pedidos con estos filtros.</td></tr>}</tbody>
      </table></div><nav className="purchase-pagination" aria-label="Paginación de pedidos"><button disabled={datos.pagina <= 1 || cargando} onClick={() => pagina(datos.pagina - 1)}>Anterior</button><label>Página <input aria-label="Número de página" type="number" min="1" max={Math.max(1, datos.paginas)} key={datos.pagina} defaultValue={datos.pagina} onKeyDown={e => { if (e.key === "Enter") { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= datos.paginas) pagina(n); } }} onBlur={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= datos.paginas && n !== datos.pagina) pagina(n); else e.target.value = datos.pagina; }} /> de {Math.max(1, datos.paginas)}</label><button disabled={datos.pagina >= datos.paginas || cargando} onClick={() => pagina(datos.pagina + 1)}>Siguiente</button></nav></>}
    </div></Layout>;
}
