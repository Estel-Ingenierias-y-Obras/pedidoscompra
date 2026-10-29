import { referenciaTlm } from "../utils/referenciaTlm";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import DiarioAlmacen from "../components/DiarioAlmacen";
import ModalShell from "../components/ModalShell";
import NotificationToast from "../components/NotificationToast";
import { obtenerEnviados, obtenerEntradas, registrarEntrada } from "../services/almacen";
import "./Almacen.css";

export default function EnviadosAlmacen() {
  const [entradas, setEntradas] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [lineaRegistro, setLineaRegistro] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState("");
  const [mensaje, setMensaje] = useState("");
  const registroEnCurso = useRef(false);
  const cerrarRegistro = () => { if (!registroEnCurso.current) setLineaRegistro(null); };
  const abrirRegistro = entrada => {
    if (cargando || registroEnCurso.current) return;
    setErrorRegistro("");
    setLineaRegistro(entrada);
  };
  async function registrar() {
    if (registroEnCurso.current || !lineaRegistro?.claveintegracion) return;
    registroEnCurso.current = true;
    setRegistrando(true);
    setErrorRegistro("");
    setMensaje("");
    try {
      const resultado = await registrarEntrada(lineaRegistro);
      if (resultado.estado !== "creada" || resultado.respuesta?.registrado !== true) {
        setErrorRegistro(resultado.error || "BC todavía no ha confirmado el registro. Reintenta para confirmar el resultado de esta misma línea.");
        return;
      }
      setEntradas(actuales => actuales.filter(entrada => entrada.id !== lineaRegistro.id));
      setSeleccion(null);
      setLineaRegistro(null);
      setMensaje("Línea registrada correctamente en Business Central");
    } catch (err) {
      setErrorRegistro(err.response?.data?.error || err.response?.data?.resultado?.error || "No se pudo confirmar el registro en BC. Reintenta la misma línea para confirmar el resultado.");
    } finally {
      registroEnCurso.current = false;
      setRegistrando(false);
    }
  }
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError("");
    Promise.all([obtenerEnviados(), obtenerEntradas()]).then(([operaciones, diario]) => {
      // Solo actualizar la vista después de recibir ambas colecciones completas.
      if (!Array.isArray(operaciones) || !Array.isArray(diario) || diario.some(linea => typeof linea?.id !== "string" || !linea.id)) throw new Error("Respuesta de BC no válida");
      const idsVigentes = new Set(diario.map(linea => linea.id.toLowerCase()));
      if (activo) {
        const vigentes = operaciones.filter(op => typeof op.respuesta?.id === "string" && idsVigentes.has(op.respuesta.id.toLowerCase()));
        setEntradas(vigentes.map(op => ({ ...op.cuerpo, ...op.respuesta, referenciaTlm: diario.find(linea => linea.id.toLowerCase() === op.respuesta.id.toLowerCase())?.referenciaTlm || "", claveintegracion: op.respuesta.claveintegracion || op.claveintegracion || op.cuerpo?.claveintegracion, solicitudId: op.solicitudId, fechaEnvio: op.createdAt })));
        setSeleccion(anterior => vigentes.some(op => op.respuesta.id === anterior) ? anterior : null);
        setLineaRegistro(anterior => anterior && idsVigentes.has(anterior.id.toLowerCase()) ? anterior : null);
        setCargado(true);
      }
    }).catch(err => {
      if (activo) setError(err.response?.data?.error || "No se pudo cargar el historial de envíos a BC. Pulsa Actualizar datos para reintentar.");
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento]);
  return <Layout>
    <NotificationToast message={mensaje} onClose={() => setMensaje("")} />
    <section className="bc-journal-page">
      <header className="page-header"><Link className="back-link" to="/material/almacen/entradas">← Entradas de almacén</Link><h1>Enviados a BC</h1><p className="page-subtitle">Historial de tus envíos · CENTRAL 3 · SG-ALMACEN</p></header>
      <div className="page-content bc-journal-card">
        <div className="bc-command-bar">
          <button disabled={cargando || registrando} onClick={() => setIntento(valor => valor + 1)}><FontAwesomeIcon icon={faRotate} /> Actualizar datos</button>
          <Link className="bc-command-link" to="/material/almacen/entradas">Volver a entradas</Link>
        </div>
        <div className="bc-journal-content warehouse-page">
          {error && <p role="alert" className="journal-error">{error}</p>}
          {cargando && <p role="status">Cargando envíos a BC…</p>}
          {cargado && <DiarioAlmacen historial filas={[]} entradas={entradas} seleccion={seleccion} seleccionar={setSeleccion} abrirRegistro={abrirRegistro} />}
          {cargado && <div className="bc-journal-footer">{entradas.length} envíos confirmados por BC</div>}
        </div>
      </div>
      {lineaRegistro && <ModalShell onClose={cerrarRegistro} ariaLabel="Registrar entrada en BC">
        <h2>Registrar entrada</h2>
        <p><strong>Documento:</strong> {lineaRegistro.numdoc}<br /><strong>Referencia:</strong> {referenciaTlm(lineaRegistro)} · {lineaRegistro.descripcion}<br /><strong>Cantidad:</strong> {lineaRegistro.cantidad} {lineaRegistro.codudmedida}</p>
        {!lineaRegistro.claveintegracion && <p role="alert" className="journal-error">Esta línea no tiene clave de integración. Actualiza los datos antes de registrarla.</p>}
        {errorRegistro && <p role="alert" className="journal-error">{errorRegistro}</p>}
        {registrando && <p role="status">Registrando en Business Central…</p>}
        <div className="journal-actions">
          <button type="button" disabled={registrando || !lineaRegistro.claveintegracion} onClick={registrar}>{registrando ? "Registrando…" : "Registrar"}</button>
          <button type="button" disabled={registrando} onClick={cerrarRegistro}>Cancelar</button>
        </div>
      </ModalShell>}
    </section>
  </Layout>;
}
