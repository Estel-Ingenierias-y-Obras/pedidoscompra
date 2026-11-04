import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import ModalShell from "../components/ModalShell";
import api from "../api";
import "./Almacen.css";
import "./EnviadosPedidosCompra.css";

const estados = { Open: "Abierto", Released: "Lanzado", "Pending Approval": "Pendiente de aprobación", "Pending Prepayment": "Pendiente de anticipo", Deleted: "Eliminado", Missing: "No disponible en BC" };
const errorTexto = e => e.response?.data?.error || e.message || "No se pudo completar la operación en BC.";
const numero = n => typeof n === "number" ? n.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "—";
const fecha = f => f && Number.isFinite(Date.parse(f)) ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(f)) : "—";

export default function EnviadosPedidosCompra() {
  const [params, setParams] = useSearchParams();
  const seleccion = params.get("pedido") || "";
  const [datos, setDatos] = useState(null);
  const [consulta, setConsulta] = useState({ pagina: 1, buscar: "", incluirEliminados: "0" });
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState("");
  const [errorDetalle, setErrorDetalle] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [intento, setIntento] = useState(0);
  const [accion, setAccion] = useState("");
  const [confirmacion, setConfirmacion] = useState(false);
  const enVuelo = useRef(false);
  useEffect(() => {
    let activo = true;
    setCargando(true); setError(""); setDatos(null);
    api.get("/api/pedidos-compra/enviados", { params: consulta }).then(r => {
      if (!Array.isArray(r.data?.pedidos) || !Number.isInteger(r.data.paginas)) throw Error("Historial de compras no válido.");
      if (activo) setDatos(r.data);
    }).catch(e => { if (activo) setError(errorTexto(e)); }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [consulta, intento]);
  useEffect(() => {
    let activo = true;
    setDetalle(null); setErrorDetalle(""); setConfirmacion(false); setCargandoDetalle(Boolean(seleccion));
    if (!seleccion) return;
    api.get(`/api/pedidos-compra/solicitudes/${encodeURIComponent(seleccion)}/detalles`).then(r => {
      if (r.data?.resultado?.solicitudId !== seleccion || !Array.isArray(r.data.lineas)) throw Error("BC no confirmó el pedido seleccionado.");
      if (activo) setDetalle(r.data);
    }).catch(e => { if (activo) setErrorDetalle(errorTexto(e)); }).finally(() => { if (activo) setCargandoDetalle(false); });
    return () => { activo = false; };
  }, [seleccion, intento]);
  const elegir = id => { if (!enVuelo.current) { setMensaje(""); setParams(id === seleccion ? {} : { pedido: id }); } };
  const ejecutar = async tipo => {
    if (enVuelo.current || !detalle) return;
    enVuelo.current = true; setAccion(tipo); setErrorDetalle(""); setMensaje("");
    const id = detalle.resultado.solicitudId;
    try {
      const url = `/api/pedidos-compra/solicitudes/${encodeURIComponent(id)}`;
      const r = tipo === "eliminar" ? await api.delete(url, { data: { numero: detalle.resultado.numero } }) : await api.post(`${url}/lanzar`, {});
      if (r.data?.solicitudId !== id || r.data.estado !== (tipo === "eliminar" ? "Deleted" : "Released")) throw Error("BC no ha confirmado el resultado. Actualiza el estado antes de reintentar.");
      setConfirmacion(false);
      setMensaje(tipo === "eliminar" ? `Pedido ${r.data.numero} eliminado de BC.` : `Pedido ${r.data.numero} lanzado.`);
      if (tipo === "eliminar") setParams({});
      setIntento(i => i + 1);
    } catch (e) { setErrorDetalle(errorTexto(e)); }
    finally { enVuelo.current = false; setAccion(""); }
  };
  const r = detalle?.resultado;
  const cabecera = detalle?.cabecera;
  const cuerpo = detalle?.cuerpo;
  const recibido = detalle?.lineas?.some(l => Number(l.CantidadRecivida) !== 0 || Number(l.quantityInvoiced || 0) !== 0);
  const puedeEliminar = r && ["Open", "Released"].includes(r.estado) && !recibido;
  return <Layout><div className="page-header"><Link className="back-link" to="/pedidos-compra/crear">← Crear en BC</Link><h1>Enviados a BC</h1><p className="page-subtitle">Pedidos de compra enviados desde la web</p></div>
    <div className="page-content purchase-sent">
      <div className="purchase-sent-toolbar"><Link className="bc-command-link" to="/pedidos-compra/crear">Crear pedido</Link><button disabled={!!accion || cargando || cargandoDetalle} onClick={() => setIntento(i => i + 1)}>Actualizar estado</button>
        <form onSubmit={e => { e.preventDefault(); setConsulta({ ...consulta, buscar: busqueda.trim(), pagina: 1 }); }}><input aria-label="Buscar enviados por Nº" type="search" maxLength={100} placeholder="Nº de pedido" value={busqueda} onChange={e => setBusqueda(e.target.value)} /><button disabled={!!accion}>Buscar</button></form>
        <label className="purchase-sent-check"><input type="checkbox" checked={consulta.incluirEliminados === "1"} disabled={!!accion} onChange={e => setConsulta({ ...consulta, pagina: 1, incluirEliminados: e.target.checked ? "1" : "0" })} />Mostrar eliminados</label>
      </div>
      {mensaje && <p role="status">{mensaje}</p>}{cargando && <p role="status">Cargando enviados…</p>}{error && <p role="alert" className="journal-error">{error}</p>}
      {datos && <><div className="warehouse-journal-scroll"><table className="journal-table"><thead><tr>{["Nº", "Proveedor", "Proyecto", "Estado", "Fecha de envío", "Enviado por"].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>
        {datos.pedidos.map(p => <tr key={p.solicitudId} className={seleccion === p.solicitudId ? "purchase-sent-selected" : ""} onClick={() => { if (p.gestionable) elegir(p.solicitudId); }}><td><button className="purchase-sent-number" disabled={!!accion || !p.gestionable} onClick={e => { e.stopPropagation(); elegir(p.solicitudId); }} aria-expanded={seleccion === p.solicitudId}>{p.numero}</button></td><td>{[p.proveedor, p.nombreProveedor].filter(Boolean).join(" · ")}</td><td>{p.proyecto || "—"}</td><td>{estados[p.estado] || p.estado}</td><td>{fecha(p.fechaEnvio)}</td><td>{p.enviadoPor || "—"}</td></tr>)}
        {!datos.pedidos.length && <tr><td colSpan={6}>No hay pedidos enviados con estos filtros.</td></tr>}
      </tbody></table></div><nav className="purchase-sent-pagination" aria-label="Paginación de enviados"><button disabled={!!accion || consulta.pagina <= 1} onClick={() => setConsulta({ ...consulta, pagina: consulta.pagina - 1 })}>Anterior</button><label>Página <input aria-label="Página de enviados" type="number" min="1" max={Math.max(1, datos.paginas)} key={consulta.pagina} defaultValue={consulta.pagina} disabled={!!accion} onBlur={e => { const p = Number(e.target.value); if (Number.isInteger(p) && p >= 1 && p <= datos.paginas) setConsulta({ ...consulta, pagina: p }); else e.target.value = consulta.pagina; }} /></label><span>de {Math.max(1, datos.paginas)}</span><button disabled={!!accion || consulta.pagina >= datos.paginas} onClick={() => setConsulta({ ...consulta, pagina: consulta.pagina + 1 })}>Siguiente</button></nav></>}
      {cargandoDetalle && <p role="status">Cargando detalles del pedido…</p>}{errorDetalle && <p role="alert" className="journal-error">{errorDetalle}</p>}
      {detalle && <section className="purchase-sent-details" aria-label={`Detalles ${r.numero}`}><header><h2>{r.numero}</h2><strong>{estados[r.estado] || r.estado}</strong><button disabled={!!accion} onClick={() => setParams({})}>Cerrar detalles</button></header>
        <dl><div><dt>Proveedor</dt><dd>{cabecera ? `${cabecera.buyFromVendorNumber} · ${cabecera.NombreCliente}` : cuerpo.proveedor}</dd></div><div><dt>Proyecto</dt><dd>{cabecera?.Proyecto || cuerpo.proyecto}</dd></div><div><dt>Tarea</dt><dd>{cabecera?.taskNumber || cuerpo.tarea}</dd></div><div><dt>Usuario asignado</dt><dd>{cabecera?.assignedUserId || cuerpo.usuarioAsignado}</dd></div><div><dt>Recepción esperada</dt><dd>{cabecera?.expectedReceiptDate || cuerpo.fechaRecepcion}</dd></div><div><dt>Enviado por</dt><dd>{detalle.enviadoPor}</dd></div>{cabecera && <><div><dt>Importe</dt><dd>{numero(cabecera.amount)} {cabecera.currencyCode || "moneda local"}</dd></div><div><dt>Importe IVA incl.</dt><dd>{numero(cabecera.amountIncludingVAT)} {cabecera.currencyCode || "moneda local"}</dd></div></>}</dl>
        {cabecera && <p>{[cabecera.shipToName, cabecera.shipToAddress, cabecera.shipToAddress2, cabecera.shipToPostCode, cabecera.shipToCity, cabecera.shipToCountry].filter(Boolean).join(" · ")}</p>}
        {["Deleted", "Missing"].includes(r.estado) ? <p>El pedido ya no está disponible como pedido activo en BC. Se conserva el envío original.</p> : <div className="warehouse-journal-scroll"><table className="journal-table"><caption>Artículos</caption><thead><tr>{["Referencia", "Descripción", "Cantidad", "Unidad", "Coste unitario", "Importe", "Recibida", "Facturada"].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{detalle.lineas.map(l => <tr key={l.id || l.lineNumber}><td>{l.referencia || l.Referencia}</td><td>{l.Description}</td><td>{numero(l.Cantidad)}</td><td>{l.unitOfMeasureCode}</td><td>{numero(l.unitCost)}</td><td>{numero(l.lineAmount)}</td><td>{numero(l.CantidadRecivida)}</td><td>{numero(l.quantityInvoiced)}</td></tr>)}</tbody></table></div>}
        {["Deleted", "Missing"].includes(r.estado) && <ul>{cuerpo.lineas.map((l, i) => <li key={i}>{l.articulo}: {numero(l.cantidad)} {l.unidad}</li>)}</ul>}
        <div className="purchase-sent-actions">{r.estado === "Open" && <button disabled={!!accion} onClick={() => ejecutar("lanzar")}>{accion === "lanzar" ? "Lanzando…" : "Lanzar"}</button>}{["Open", "Released"].includes(r.estado) && <button className="purchase-sent-delete" disabled={!!accion || !puedeEliminar} onClick={() => setConfirmacion(true)}>Eliminar</button>}</div>
        {recibido && <p>El pedido tiene cantidades recibidas o facturadas y no se puede eliminar desde esta página.</p>}
      </section>}
      {confirmacion && detalle && <ModalShell ariaLabel="Confirmar eliminación de pedido" onClose={() => { if (!enVuelo.current) setConfirmacion(false); }}><h2>Eliminar {r.numero}</h2><p>Se eliminará este pedido y sus líneas de Business Central. Si está lanzado, se reabrirá para eliminarlo.</p><p>¿Confirmas que quieres eliminarlo?</p>{errorDetalle && <p role="alert" className="journal-error">{errorDetalle}</p>}<div className="purchase-sent-actions"><button disabled={!!accion} onClick={() => setConfirmacion(false)}>Cancelar</button><button className="purchase-sent-delete" disabled={!!accion} onClick={() => ejecutar("eliminar")}>{accion === "eliminar" ? "Eliminando…" : "Confirmar eliminación"}</button></div></ModalShell>}
    </div></Layout>;
}
