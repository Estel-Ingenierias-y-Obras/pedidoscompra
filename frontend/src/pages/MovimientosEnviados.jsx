import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import ModalShell from "../components/ModalShell";
import NotificationToast from "../components/NotificationToast";
import { obtenerDetalleMovimiento, obtenerMovimientosEnviados, registrarMovimiento } from "../services/movimientosAlmacen";
import "./Almacen.css";

const estados = { enviadoBC: "Enviado a BC", registrado: "Registrado", error: "Error", borrador: "Borrador" };
const fecha = valor => valor && Number.isFinite(Date.parse(valor)) ? new Date(valor).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
const nombres = { tipoorigen: "Tipo de origen", origen: "Origen", tipodestino: "Tipo de destino", destino: "Destino", solicitante: "Solicitante", nombresolicitante: "Nombre del solicitante", departamento: "Departamento", tipoproyectocodigo: "Tipo de proyecto", serie: "Serie", fechaaplicacion: "Fecha de aplicación", usuario: "Usuario", contacto1: "Contacto 1", contacto2: "Contacto 2", solicitudId: "Referencia del envío", claveintegracion: "Referencia de integración", id: "Referencia de línea", tipoOperacion: "Operación", cabecera: "Cabecera", lineas: "Líneas", numprod: "Nº artículo", cantidad: "Cantidad", codudmedida: "Unidad de medida", descripcion: "Descripción" };
function DatosEnviados({ datos }) {
  if (datos === null || datos === undefined) return <span>—</span>;
  if (typeof datos !== "object") return <span>{datos === "Location" ? "Almacén" : datos === "Job" ? "Proyecto" : String(datos)}</span>;
  return <dl className="movement-readonly-data">{Object.entries(datos).map(([campo, valor]) => <div key={campo}><dt>{Array.isArray(datos) ? `Línea ${Number(campo) + 1}` : nombres[campo] || campo}</dt><dd><DatosEnviados datos={valor} /></dd></div>)}</dl>;
}
export default function MovimientosEnviados() {
  const [movimientos, setMovimientos] = useState([]), [cargando, setCargando] = useState(true), [error, setError] = useState("");
  const [intento, setIntento] = useState(0), [seleccion, setSeleccion] = useState(null), [vista, setVista] = useState("acciones");
  const [detalle, setDetalle] = useState(null), [cargandoDetalle, setCargandoDetalle] = useState(false), [errorModal, setErrorModal] = useState("");
  const [registrando, setRegistrando] = useState(false), [mensaje, setMensaje] = useState("");
  const enVuelo = useRef(false);
  useEffect(() => {
    let activo = true; setCargando(true); setError("");
    obtenerMovimientosEnviados().then(datos => {
      if (!Array.isArray(datos) || datos.some(m => !m.bcId || !m.numero || m.confirmadoBC !== true)) throw new Error("El historial no contiene confirmaciones válidas de BC.");
      if (activo) setMovimientos(datos);
    }).catch(err => { if (activo) setError(err.response?.data?.error || err.message || "No se pudo cargar el historial."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
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
  const abrir = movimiento => { if (!cargando && !enVuelo.current) { setSeleccion(movimiento); setVista("acciones"); setErrorModal(""); } };
  const cerrar = () => { if (!enVuelo.current) { if (vista === "detalle") setVista("acciones"); else setSeleccion(null); } };
  const registrar = async () => {
    if (enVuelo.current || seleccion?.estado === "registrado") return;
    enVuelo.current = true; setRegistrando(true); setErrorModal(""); setMensaje("");
    try {
      const resultado = await registrarMovimiento({ id: seleccion.bcId, claveintegracion: seleccion.solicitudId });
      if (resultado.estado !== "registrado" || resultado.registrado !== true || resultado.bcId !== seleccion.bcId || resultado.solicitudId !== seleccion.solicitudId || !resultado.comprobanteRegistro?.id || !resultado.fechaRegistro) throw new Error("BC no ha devuelto un comprobante verificable de registro. Conserva este movimiento y revisa su resultado.");
      setMovimientos(actuales => actuales.map(m => m.bcId === seleccion.bcId ? { ...m, estado: "registrado", fechaRegistro: resultado.fechaRegistro, error: "" } : m));
      setSeleccion(null); setMensaje("Movimiento registrado correctamente en Business Central.");
    } catch (err) {
      const texto = err.response?.data?.error || err.message || "No se pudo confirmar el registro en BC.";
      setErrorModal(texto);
      setSeleccion(actual => ({ ...actual, estado: "error", error: texto }));
      setMovimientos(actuales => actuales.map(m => m.bcId === seleccion.bcId ? { ...m, estado: "error", error: texto } : m));
    } finally { enVuelo.current = false; setRegistrando(false); }
  };
  return <Layout><NotificationToast message={mensaje} onClose={() => setMensaje("")} /><section className="bc-journal-page">
    <header className="page-header"><Link className="back-link" to="/material/almacen/movimientos">← Movimientos de Almacén</Link><h1>Enviados a BC</h1><p className="page-subtitle">Movimientos de almacén · tus envíos confirmados</p></header>
    <div className="page-content bc-journal-card"><div className="bc-command-bar"><button disabled={cargando || registrando} onClick={() => setIntento(v => v + 1)}>Actualizar datos</button></div>
      {error && <p role="alert" className="journal-error">{error}</p>}{cargando && <p role="status">Cargando movimientos enviados…</p>}
      <div className="warehouse-table-container"><table className="warehouse-entries-table gestion-pedidos-table"><thead><tr>{["Fecha", "Nº Movimiento", "Origen", "Destino", "Solicitante", "Estado"].map(c => <th key={c} scope="col">{c}</th>)}</tr></thead><tbody>
        {movimientos.map(m => <tr key={m.bcId} tabIndex={cargando ? -1 : 0} aria-label={`Abrir movimiento ${m.numero}`} onClick={() => abrir(m)} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); abrir(m); } }}>
          <td data-label="Fecha">{fecha(m.fechaEnvio)}</td><td data-label="Nº Movimiento">{m.numero}</td><td data-label="Origen">{m.cabecera.origen}</td><td data-label="Destino">{m.cabecera.destino}</td><td data-label="Solicitante">{m.cabecera.nombresolicitante || m.cabecera.solicitante}</td><td data-label="Estado">{estados[m.estado] || "Error"}</td>
        </tr>)}
        {!cargando && !error && !movimientos.length && <tr><td colSpan={6}>No hay movimientos enviados a BC.</td></tr>}
      </tbody></table></div>
    </div>
    {seleccion && <ModalShell key={vista} onClose={cerrar} ariaLabel={vista === "acciones" ? `Movimiento ${seleccion.numero}` : `Visualizar movimiento ${seleccion.numero}`}>
      <h2>{seleccion.numero}</h2>
      {errorModal && <p role="alert" className="journal-error">{errorModal}</p>}
      {vista === "acciones" ? <><p>{estados[seleccion.estado]}</p><div className="journal-actions"><button onClick={() => { setVista("detalle"); setErrorModal(""); }} disabled={registrando}>Visualizar</button><button onClick={registrar} disabled={registrando || seleccion.estado === "registrado"}>{registrando ? "Registrando…" : "Registrar"}</button></div></> : <>
        {cargandoDetalle && <p role="status">Cargando detalle…</p>}
        {detalle && <div className="movement-detail"><h3>Cabecera</h3><DatosEnviados datos={detalle.cabecera} /><h3>Líneas de movimiento</h3><DatosEnviados datos={detalle.lineas} /><h3>Información enviada a BC</h3><DatosEnviados datos={detalle.datosEnviados} /></div>}
      </>}
    </ModalShell>}
  </section></Layout>;
}
