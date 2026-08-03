import { useContext, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faCalendarCheck,
  faCheckCircle,
  faCircleInfo,
  faClipboardCheck,
  faClipboardList,
  faFile,
  faFolderOpen,
  faScrewdriverWrench,
  faPaperclip,
  faUpload
} from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import DeleteIconButton from "../components/DeleteIconButton";
import ProjectSelector from "../components/ProjectSelector";
import {
  formatearTamanoArchivo,
  obtenerIconoArchivo
} from "../components/AttachmentList";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

function NuevaSolicitud() {
  const { setSolicitudes } = useContext(SolicitudesContext);
  const { user } = useContext(AuthContext);

  const [proyecto, setProyecto] = useState("");
  const [urgente, setUrgente] = useState("No");
  const [motivoUrgencia, setMotivoUrgencia] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivosDescripcion, setArchivosDescripcion] = useState([]);
  const [archivosUrgente, setArchivosUrgente] = useState([]);
  const [archivosNoUrgente, setArchivosNoUrgente] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const descripcionInputRef = useRef(null);
  const urgenteBlockRef = useRef(null);
  const urgenteInputRef = useRef(null);
  const noUrgenteInputRef = useRef(null);

  const obtenerClaveArchivo = (archivo) =>
    `${archivo.name}-${archivo.size}-${archivo.lastModified}`;

  const agregarArchivos = (event, setter) => {
    const nuevosArchivos = Array.from(event.target.files || []);

    setter(archivosActuales => {
      const clavesActuales = new Set(
        archivosActuales.map(obtenerClaveArchivo)
      );
      const archivosSinDuplicar = nuevosArchivos.filter(archivo => {
        const clave = obtenerClaveArchivo(archivo);

        if (clavesActuales.has(clave)) {
          return false;
        }

        clavesActuales.add(clave);
        return true;
      });

      return [...archivosActuales, ...archivosSinDuplicar];
    });

    event.target.value = "";
  };

  const eliminarArchivoSeleccionado = (indice, setter) => {
    setter(archivosActuales =>
      archivosActuales.filter((_, indiceItem) => indiceItem !== indice)
    );
  };

  const limpiarArchivos = () => {
    setArchivosDescripcion([]);
    setArchivosUrgente([]);
    setArchivosNoUrgente([]);

    [descripcionInputRef, urgenteInputRef, noUrgenteInputRef].forEach(ref => {
      if (ref.current) {
        ref.current.value = "";
      }
    });
  };

  const contarArchivos = () =>
    urgente === "Sí"
      ? archivosUrgente.length + archivosNoUrgente.length
      : archivosDescripcion.length;

  useEffect(() => {
    if (urgente !== "Sí" || !urgenteBlockRef.current) {
      return;
    }

    const rect = urgenteBlockRef.current.getBoundingClientRect();
    const margenVisible = 96;
    const estaVisible =
      rect.top >= margenVisible &&
      rect.bottom <= window.innerHeight - margenVisible;

    if (!estaVisible) {
      urgenteBlockRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [urgente]);

  const renderAdjuntosBloque = ({ archivos, setter, inputRef, inputId }) => (
    <div className="block-attachments">
      <div className="attachments-dropzone">
        <div className="attachments-dropzone-copy">
          <FontAwesomeIcon icon={faUpload} aria-hidden="true" />
          <div>
            <label htmlFor={inputId}>Adjuntos relacionados</label>
            <p>Añade documentación, presupuestos, planos o referencias útiles.</p>
          </div>
        </div>
        <input
          id={inputId}
          type="file"
          ref={inputRef}
          multiple
          onChange={(event) => agregarArchivos(event, setter)}
          aria-describedby={`${inputId}-ayuda`}
        />
        <span id={`${inputId}-ayuda`} className="sr-only">
          Puedes seleccionar varios archivos relacionados con este bloque.
        </span>
      </div>

      {archivos.length > 0 ? (
        <div className="new-attachments-list" aria-live="polite">
          {archivos.map((archivo, indice) => (
            <div
              className="new-attachment-chip"
              key={obtenerClaveArchivo(archivo)}
            >
              <FontAwesomeIcon
                className="new-attachment-icon"
                icon={obtenerIconoArchivo(archivo.type) || faFile}
                aria-hidden="true"
              />
              <div className="new-attachment-info">
                <strong>{archivo.name}</strong>
                <span>{formatearTamanoArchivo(archivo.size)}</span>
              </div>
              <DeleteIconButton
                label={`Eliminar ${archivo.name}`}
                onClick={() => eliminarArchivoSeleccionado(indice, setter)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="attachments-empty-hint">Sin archivos seleccionados.</p>
      )}
    </div>
  );

  const handleSubmit = async () => {
    const nuevaSolicitud = new FormData();

    nuevaSolicitud.append("solicitante", user.nombre);
    nuevaSolicitud.append("compradorAsignado", "");
    nuevaSolicitud.append("email", user.email);
    nuevaSolicitud.append("proyecto", proyecto);
    nuevaSolicitud.append("urgente", urgente === "Sí");
    nuevaSolicitud.append("motivoUrgencia", urgente === "Sí" ? motivoUrgencia : "");
    nuevaSolicitud.append("descripcion", descripcion);
    nuevaSolicitud.append("estado", "Pendiente");

    if (urgente === "Sí") {
      archivosUrgente.forEach(archivo => {
        nuevaSolicitud.append("archivosUrgente", archivo);
      });
      archivosNoUrgente.forEach(archivo => {
        nuevaSolicitud.append("archivosNoUrgente", archivo);
      });
    } else {
      archivosDescripcion.forEach(archivo => {
        nuevaSolicitud.append("archivosDescripcion", archivo);
      });
    }

    try {
      await api.post("/api/pedidos", nuevaSolicitud);
      const response = await api.get("/api/pedidos");
      setSolicitudes(response.data);
    } catch (error) {
      console.error("Error creando pedido:", error);
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    setProyecto("");
    setUrgente("No");
    setMotivoUrgencia("");
    setDescripcion("");
    limpiarArchivos();
    setMensaje("Pedido enviado correctamente");
    setTimeout(() => setMensaje(""), 3000);
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Nueva solicitud de compra</h1>
        <p className="page-subtitle">
          Completa los datos para registrar una necesidad de compra.
        </p>
      </div>

      <div className="new-request-page">
        {mensaje && (
          <div className="mensaje-exito new-request-success" role="status">
            {mensaje}
          </div>
        )}

        <div className="new-request-shell">
          <section className="new-request-card new-request-section">
            <div className="section-heading">
              <span className="section-icon">
                <FontAwesomeIcon icon={faFolderOpen} aria-hidden="true" />
              </span>
              <div>
                <p className="section-kicker">Paso 1</p>
                <h2>Información general</h2>
                <p>Selecciona el proyecto y define la prioridad de la compra.</p>
              </div>
            </div>

            <div className="guided-field">
              <div className="guided-field-header">
                <label htmlFor="buscador-proyecto"><FontAwesomeIcon className="field-label-icon" icon={faScrewdriverWrench} aria-hidden="true" />Proyecto</label>
                <span>Obligatorio</span>
              </div>
              <p className="field-help">
                Selecciona el proyecto al que corresponde esta solicitud.
              </p>
              <ProjectSelector value={proyecto} onChange={setProyecto} />
            </div>

            <div className="guided-field">
              <div className="guided-field-header">
                <label><FontAwesomeIcon className="field-label-icon" icon={faClipboardList} aria-hidden="true" />Tipo de solicitud</label>
                <span>Obligatorio</span>
              </div>
              <p className="field-help">
                Elige si todo puede gestionarse de forma planificada o si hay
                necesidades con prioridad inmediata.
              </p>

              <div className="urgency-choice-grid" role="radiogroup" aria-label="Prioridad de la solicitud">
                <label className={`urgency-choice-card${urgente === "No" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    value="No"
                    checked={urgente === "No"}
                    onChange={(event) => setUrgente(event.target.value)}
                  />
                  <FontAwesomeIcon icon={faCalendarCheck} aria-hidden="true" />
                  <strong>Solicitud normal</strong>
                  <span>Para necesidades planificables o sin urgencia inmediata.</span>
                </label>

                <label className={`urgency-choice-card${urgente === "Sí" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    value="Sí"
                    checked={urgente === "Sí"}
                    onChange={(event) => setUrgente(event.target.value)}
                  />
                  <FontAwesomeIcon icon={faBolt} aria-hidden="true" />
                  <strong>Solicitud urgente</strong>
                  <span>Separa lo inmediato de lo que puede tramitarse después.</span>
                </label>
              </div>
            </div>
          </section>

          <section className="new-request-card new-request-section">
            <div className="section-heading">
              <span className="section-icon">
                <FontAwesomeIcon icon={faClipboardCheck} aria-hidden="true" />
              </span>
              <div>
                <p className="section-kicker">Paso 2</p>
                <h2>Detalles de la necesidad</h2>
                <p>
                  Describe los elementos solicitados y adjunta los documentos
                  relacionados con cada bloque.
                </p>
              </div>
            </div>

            {urgente === "Sí" ? (
              <div className="request-blocks-grid">
                <div className="request-block-card request-block-urgent" ref={urgenteBlockRef}>
                  <div className="request-block-title">
                    <FontAwesomeIcon icon={faBolt} aria-hidden="true" />
                    <div>
                      <label htmlFor="necesidades-urgentes">Necesidades urgentes</label>
                      <p>Indica únicamente aquello que debe comprarse con prioridad inmediata.</p>
                    </div>
                  </div>
                  <textarea
                    id="necesidades-urgentes"
                    value={motivoUrgencia}
                    placeholder="Ej. Material necesario para mañana, unidades críticas, fecha límite..."
                    onChange={(event) => setMotivoUrgencia(event.target.value)}
                  />
                  {renderAdjuntosBloque({
                    archivos: archivosUrgente,
                    setter: setArchivosUrgente,
                    inputRef: urgenteInputRef,
                    inputId: "archivos-urgente"
                  })}
                </div>

                <div className="request-block-card">
                  <div className="request-block-title">
                    <FontAwesomeIcon icon={faCalendarCheck} aria-hidden="true" />
                    <div>
                      <label htmlFor="necesidades-planificables">Necesidades planificables</label>
                      <p>Incluye lo que puede gestionarse sin prioridad inmediata.</p>
                    </div>
                  </div>
                  <textarea
                    id="necesidades-planificables"
                    value={descripcion}
                    placeholder="Ej. Material previsto para próximos trabajos, compras no críticas..."
                    onChange={(event) => setDescripcion(event.target.value)}
                  />
                  {renderAdjuntosBloque({
                    archivos: archivosNoUrgente,
                    setter: setArchivosNoUrgente,
                    inputRef: noUrgenteInputRef,
                    inputId: "archivos-no-urgente"
                  })}
                </div>
              </div>
            ) : (
              <div className="request-block-card">
                <div className="request-block-title">
                  <FontAwesomeIcon icon={faClipboardCheck} aria-hidden="true" />
                  <div>
                    <label htmlFor="necesidad-normal">¿Qué necesitas solicitar?</label>
                    <p>Describe los elementos, cantidades o referencias que debe revisar Compras.</p>
                  </div>
                </div>
                <textarea
                  id="necesidad-normal"
                  value={descripcion}
                  placeholder="Ej. Elementos solicitados, cantidades, referencias, proveedor sugerido..."
                  onChange={(event) => setDescripcion(event.target.value)}
                />
                {renderAdjuntosBloque({
                  archivos: archivosDescripcion,
                  setter: setArchivosDescripcion,
                  inputRef: descripcionInputRef,
                  inputId: "archivos-descripcion"
                })}
              </div>
            )}
          </section>

          <section className="new-request-card new-request-summary-card" aria-label="Resumen de la solicitud">
            <div className="section-heading compact">
              <span className="section-icon">
                <FontAwesomeIcon icon={faCheckCircle} aria-hidden="true" />
              </span>
              <div>
                <p className="section-kicker">Resumen</p>
                <h2>Resumen de la solicitud</h2>
              </div>
            </div>

            <div className="summary-grid">
              <div>
                <span><FontAwesomeIcon className="summary-label-icon" icon={faFolderOpen} aria-hidden="true" />Proyecto seleccionado</span>
                <strong>{proyecto || "Pendiente de seleccionar"}</strong>
              </div>
              <div>
                <span><FontAwesomeIcon className="summary-label-icon" icon={faClipboardList} aria-hidden="true" />Tipo</span>
                <strong>{urgente === "Sí" ? "Solicitud urgente" : "Solicitud normal"}</strong>
              </div>
              <div className={urgente === "Sí" ? "summary-urgency-highlight" : ""}>
                <span><FontAwesomeIcon className="summary-label-icon" icon={urgente === "Sí" ? faBolt : faCalendarCheck} aria-hidden="true" />Urgencia</span>
                <strong>{urgente === "Sí" ? "Urgente" : "Normal"}</strong>
              </div>
              <div>
                <span><FontAwesomeIcon className="summary-label-icon" icon={faPaperclip} aria-hidden="true" />Archivos</span>
                <strong>{contarArchivos()}</strong>
              </div>
            </div>

            <div className="summary-note">
              <FontAwesomeIcon icon={faCircleInfo} aria-hidden="true" />
              <span>Revisa que el proyecto y los detalles sean correctos antes de enviar.</span>
            </div>

            <button className="submit-request-button" onClick={handleSubmit}>
              <FontAwesomeIcon icon={faPaperclip} aria-hidden="true" />
              Crear solicitud
            </button>
          </section>
        </div>
      </div>
    </Layout>
  );
}

export default NuevaSolicitud;







