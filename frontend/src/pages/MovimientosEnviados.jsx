import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import ActualizarDatosButton from "../components/ActualizarDatosButton";
import ModalShell from "../components/ModalShell";
import NotificationToast from "../components/NotificationToast";
import { obtenerDetalleMovimiento, obtenerMovimientosEnviados, registrarMovimiento } from "../services/movimientosAlmacen";
import "./Almacen.css";

const estados = { enviadoBC: "Enviado a BC", registrado: "Registrado", error: "Error", borrador: "Borrador" };
const fecha = valor => valor && Number.isFinite(Date.parse(valor)) ? new Date(valor).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
const camposDetalle = { tipoorigen: "Tipo de origen", origen: "Origen", tipodestino: "Tipo de destino", destino: "Destino", tipoproyectocodigo: "Tipo de proyecto", departamento: "Departamento", zona: "Zona", solicitante: "Nº solicitante", nombresolicitante: "Nombre del solicitante" };
const registroConfirmado = m => m.estado === "registrado" && !!m.comprobanteRegistro?.id && !!m.fechaRegistro;
function DatosEnviados({ datos }) {
  return <dl className="movement-readonly-data">{Object.entries(camposDetalle).map(([campo, titulo]) => {
    const valor = datos?.[campo];
    return <div key={campo}><dt>{titulo}</dt><dd>{valor === "Location" ? "Almacén" : valor === "Job" ? "Proyecto" : valor || "—"}</dd></div>;
  })}</dl>;
}
export default function MovimientosEnviados() {
  const [movimientos, setMovimientos] = useState([]), [cargando, setCargando] = useState(true), [error, setError] = useState("");
  const [historial, setHistorial] = useState(false), [seleccion, setSeleccion] = useState(null), [vista, setVista] = useState("acciones");
  const [intento, setIntento] = useState(0);
  const [detalle, setDetalle] = useState(null), [cargandoDetalle, setCargandoDetalle] = useState(false), [errorModal, setErrorModal] = useState("");
  const [registrando, setRegistrando] = useState(false), [mensaje, setMensaje] = useState("");
  const enVuelo = useRef(false);
  const versionDatos = useRef(0);
  useEffect(() => {
    let activo = true, consultando = false;
    const actualizar = async () => {
      if (consultando || enVuelo.current || document.visibilityState === "hidden") return;
      consultando = true;
      const version = versionDatos.current;
      try {
        const datos = await obtenerMovimientosEnviados();
        if (!Array.isArray(datos) || datos.some(m => !m.bcId || !m.numero || m.confirmadoBC !== true)) throw new Error("El historial no contiene confirmaciones válidas de BC.");
        if (activo && version === versionDatos.current) { setMovimientos(datos); setError(""); }
      } catch (err) {
        if (activo && version === versionDatos.current) setError(err.response?.data?.error || err.message || "No se pudo cargar el historial.");
      } finally { consultando = false; if (activo) setCargando(false); }
    };
    actualizar();
    const intervalo = setInterval(actualizar, 15000);
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => { activo = false; clearInterval(intervalo); window.removeEventListener("focus", actualizar); document.removeEventListener("visibilitychange", actualizar); };
  }, [intento]);
  useEffect(() => {
    if (!seleccion || vista !== "detalle") return;
    let activo = true; setCargandoDetalle(true); setDetalle(null); setErrorModal("");
    obtenerDetalleMovimiento(seleccion.bcId).then(datos => {
      if (datos.bcId !== seleccion.bcId || datos.confirmadoBC !== true) throw new Error("No se pudo confirmar el detalle del movimiento.");
      if (activo) setDetalle(datos);
    }).catch(err => { if (activo) setErrorModal(err.response?.data?.error || err.message || "No se pudo consultar el movimiento."); })
      .finally(() => { if (activo) setCargandoDetalle(false); });
    return () => { activo = false; };
  }, [seleccion, vista]);
  const abrir = movimiento => { if (!cargando && !enVuelo.current) { setSeleccion(movimiento); setVista(historial ? "detalle" : "acciones"); setErrorModal(""); } };
  const cerrar = () => { if (!enVuelo.current) { if (vista === "detalle" && !historial) setVista("acciones"); else setSeleccion(null); } };
  const registrar = async () => {
    if (enVuelo.current || seleccion?.estado === "registrado") return;
    enVuelo.current = true; versionDatos.current++; setRegistrando(true); setErrorModal(""); setMensaje("");
    try {
      const resultado = await registrarMovimiento({ id: seleccion.bcId, claveintegracion: seleccion.solicitudId });
      if (resultado.estado !== "registrado" || resultado.registrado !== true || resultado.bcId !== seleccion.bcId || resultado.solicitudId !== seleccion.solicitudId || !resultado.comprobanteRegistro?.id || !resultado.fechaRegistro) throw new Error("BC no ha devuelto un comprobante verificable de registro. Conserva este movimiento y revisa su resultado.");
      setMovimientos(actuales => actuales.map(m => m.bcId === seleccion.bcId ? { ...m, estado: "registrado", fechaRegistro: resultado.fechaRegistro, comprobanteRegistro: resultado.comprobanteRegistro, error: "" } : m));
      setSeleccion(null); setMensaje("Movimiento registrado correctamente en Business Central.");
    } catch (err) {
      const texto = err.response?.data?.error || err.message || "No se pudo confirmar el registro en BC.";
      setErrorModal(texto);
      setSeleccion(actual => ({ ...actual, estado: "error", error: texto }));
      setMovimientos(actuales => actuales.map(m => m.bcId === seleccion.bcId ? { ...m, estado: "error", error: texto } : m));
    } finally { enVuelo.current = false; setRegistrando(false); }
  };
  const visibles = movimientos.filter(m => historial ? registroConfirmado(m) : !registroConfirmado(m));
  const datosDetalle = detalle?.bcId === seleccion?.bcId ? detalle : seleccion;
  if (historial) visibles.sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro));
  return <Layout><NotificationToast message={mensaje} onClose={() => setMensaje("")} /><section className="bc-journal-page">
    <header className="page-header"><Link className="back-link" to="/material/almacen/movimientos">← Movimientos de Almacén</Link><h1>Enviados a BC</h1><p className="page-subtitle">Movimientos de almacén · tus envíos confirmados</p></header>
    <div className="page-content bc-journal-card"><div className="bc-command-bar">
      <ActualizarDatosButton disabled={cargando || registrando} onClick={() => { setCargando(true); setIntento(v => v + 1); }} />
      <div className="movement-sent-tabs" role="tablist" aria-label="Acopios enviados">
      <button role="tab" aria-selected={!historial} aria-controls="acopios-listado" id="acopios-pendientes" onClick={() => setHistorial(false)}>Enviados a BC</button>
      <button role="tab" aria-selected={historial} aria-controls="acopios-listado" id="acopios-historial" onClick={() => setHistorial(true)}>Historial de registros</button>
      </div>
    </div>
      {error && <p role="alert" className="journal-error">{error}</p>}{cargando && <p role="status">Cargando movimientos enviados…</p>}
      <div className="warehouse-table-container" role="tabpanel" id="acopios-listado" aria-labelledby={historial ? "acopios-historial" : "acopios-pendientes"}><table className="warehouse-entries-table gestion-pedidos-table movement-sent-table"><colgroup><col className="movement-col-date" /><col className="movement-col-number" /><col className="movement-col-route" /><col className="movement-col-route" /><col className="movement-col-applicant" />{!historial && <col className="movement-col-status" />}</colgroup><thead><tr>{[historial ? "Fecha de registro" : "Fecha", "Nº Movimiento", "Origen", "Destino", "Solicitante", ...(!historial ? ["Estado"] : [])].map(c => <th key={c} scope="col">{c}</th>)}</tr></thead><tbody>
        {visibles.map(m => <tr key={m.bcId} tabIndex={cargando ? -1 : 0} aria-label={`Abrir movimiento ${m.numero}`} onClick={() => abrir(m)} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); abrir(m); } }}>
          <td data-label={historial ? "Fecha de registro" : "Fecha"}>{fecha(historial ? m.fechaRegistro : m.fechaEnvio)}</td><td data-label="Nº Movimiento">{m.numero}</td><td data-label="Origen">{m.cabecera.origen}</td><td data-label="Destino">{m.cabecera.destino}</td><td data-label="Solicitante">{m.cabecera.nombresolicitante || m.cabecera.solicitante}</td>{!historial && <td data-label="Estado">{estados[m.estado] || "Error"}</td>}
        </tr>)}
        {!cargando && !error && !visibles.length && <tr><td colSpan={historial ? 5 : 6}>{historial ? "No hay acopios registrados." : "No hay movimientos pendientes de registrar."}</td></tr>}
      </tbody></table></div>
    </div>
    {seleccion && <ModalShell key={vista} onClose={cerrar} ariaLabel={vista === "acciones" ? `Movimiento ${seleccion.numero}` : `Visualizar movimiento ${seleccion.numero}`}>
      <h2>{seleccion.numero}</h2>
      {errorModal && <p role="alert" className="journal-error">{errorModal}</p>}
      {vista === "acciones" ? <><p>{estados[seleccion.estado]}</p><div className="journal-actions movement-modal-actions"><button aria-label="Visualizar" title="Visualizar" onClick={() => { setVista("detalle"); setErrorModal(""); }} disabled={registrando}><FontAwesomeIcon icon={faEye} /></button>{!registroConfirmado(seleccion) && <button aria-label={registrando ? "Registrando…" : "Registrar"} title="Registrar" onClick={registrar} disabled={registrando || seleccion.estado === "registrado"}><FontAwesomeIcon icon={faPaperPlane} /></button>}</div></> : <>
        <div className="movement-detail" aria-busy={cargandoDetalle}><DatosEnviados datos={{ ...datosDetalle.datosEnviados?.cabecera, ...datosDetalle.cabecera }} /></div>
      </>}
    </ModalShell>}
  </section></Layout>;
}
