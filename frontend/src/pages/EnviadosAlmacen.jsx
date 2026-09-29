import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import DiarioAlmacen from "../components/DiarioAlmacen";
import { obtenerEnviados, obtenerEntradas } from "../services/almacen";
import "./Almacen.css";

export default function EnviadosAlmacen() {
  const [entradas, setEntradas] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
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
        setEntradas(vigentes.map(op => ({ ...op.cuerpo, ...op.respuesta, solicitudId: op.solicitudId, fechaEnvio: op.createdAt })));
        setSeleccion(anterior => vigentes.some(op => op.respuesta.id === anterior) ? anterior : null);
        setCargado(true);
      }
    }).catch(err => {
      if (activo) setError(err.response?.data?.error || "No se pudo cargar el historial de envíos a BC. Pulsa Actualizar datos para reintentar.");
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento]);
  return <Layout>
    <section className="bc-journal-page">
      <header className="page-header"><Link className="back-link" to="/material/almacen/entradas">← Entradas de almacén</Link><h1>Enviados a BC</h1><p className="page-subtitle">Historial de tus envíos · CENTRAL 3 · SG-ALMACEN</p></header>
      <div className="page-content bc-journal-card">
        <div className="bc-command-bar">
          <button disabled={cargando} onClick={() => setIntento(valor => valor + 1)}><FontAwesomeIcon icon={faRotate} /> Actualizar datos</button>
          <Link className="bc-command-link" to="/material/almacen/entradas">Volver a entradas</Link>
        </div>
        <div className="bc-journal-content warehouse-page">
          {error && <p role="alert" className="journal-error">{error}</p>}
          {cargando && <p role="status">Cargando envíos a BC…</p>}
          {cargado && <DiarioAlmacen historial filas={[]} entradas={entradas} seleccion={seleccion} seleccionar={setSeleccion} />}
          {cargado && <div className="bc-journal-footer">{entradas.length} envíos confirmados por BC</div>}
        </div>
      </div>
    </section>
  </Layout>;
}
