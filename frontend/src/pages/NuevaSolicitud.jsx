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
import NotificationToast from "../components/NotificationToast";
import ProjectSelector from "../components/ProjectSelector";
import {
  formatearTamanoArchivo,
  obtenerIconoArchivo
} from "../components/AttachmentList";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import {
  crearElementoVacio,
  elementosATexto,
  normalizarElementos,
  RequestItemsEditor
} from "../components/RequestItems";

function NuevaSolicitud() {
  const { setSolicitudes } = useContext(SolicitudesContext);
  const { user } = useContext(AuthContext);

  const [proyecto, setProyecto] = useState("");
  const [urgente, setUrgente] = useState("No");
  const [elementos, setElementos] = useState([crearElementoVacio()]);
  const [elementosUrgentes, setElementosUrgentes] = useState([crearElementoVacio()]);
  const [elementosNoUrgentes, setElementosNoUrgentes] = useState([]);
  const [archivosDescripcion, setArchivosDescripcion] = useState([]);
  const [archivosUrgente, setArchivosUrgente] = useState([]);
  const [archivosNoUrgente, setArchivosNoUrgente] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [modoWizard, setModoWizard] = useState(() =>
    window.matchMedia("(max-width: 900px)").matches
  );
  const [pasoActual, setPasoActual] = useState(0);
  const [direccionPaso, setDireccionPaso] = useState("adelante");
  const descripcionInputRef = useRef(null);
  const urgenteBlockRef = useRef(null);
  const urgenteInputRef = useRef(null);
  const noUrgenteInputRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const actualizarModo = event => setModoWizard(event.matches);
    mediaQuery.addEventListener("change", actualizarModo);
    return () => mediaQuery.removeEventListener("change", actualizarModo);
  }, []);

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
    const elementosNormales = normalizarElementos(elementos);
    const urgentesNormalizados = normalizarElementos(elementosUrgentes);
    const noUrgentesNormalizados = normalizarElementos(elementosNoUrgentes);

    if (!proyecto) return;
    if (urgente === "Sí" && urgentesNormalizados.length === 0) return;
    if (urgente !== "Sí" && elementosNormales.length === 0) return;

    const nuevaSolicitud = new FormData();

    nuevaSolicitud.append("solicitante", user.nombre);
    nuevaSolicitud.append("compradorAsignado", "");
    nuevaSolicitud.append("email", user.email);
    nuevaSolicitud.append("proyecto", proyecto);
    nuevaSolicitud.append("urgente", urgente === "Sí");
    nuevaSolicitud.append("elementos", JSON.stringify(urgente === "Sí" ? [] : elementosNormales));
    nuevaSolicitud.append("elementosUrgentes", JSON.stringify(urgente === "Sí" ? urgentesNormalizados : []));
    nuevaSolicitud.append("elementosNoUrgentes", JSON.stringify(urgente === "Sí" ? noUrgentesNormalizados : []));
    nuevaSolicitud.append("motivoUrgencia", urgente === "Sí" ? elementosATexto(urgentesNormalizados) : "");
    nuevaSolicitud.append(
      "descripcion",
      urgente === "Sí" ? elementosATexto(noUrgentesNormalizados) : elementosATexto(elementosNormales)
    );
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
    setElementos([crearElementoVacio()]);
    setElementosUrgentes([crearElementoVacio()]);
    setElementosNoUrgentes([]);
    limpiarArchivos();
    setPasoActual(0);
    setMensaje("Pedido enviado correctamente");
  };

  const pasosWizard = ["Proyecto", "Tipo", "Materiales", "Adjuntos", "Resumen"];
  const elementosPasoActual = urgente === "Sí" ? elementosUrgentes : elementos;
  const pasoValido =
    pasoActual === 0
      ? Boolean(proyecto)
      : pasoActual === 2
        ? normalizarElementos(elementosPasoActual).length > 0
        : true;

  const cambiarPaso = nuevoPaso => {
    setDireccionPaso(nuevoPaso > pasoActual ? "adelante" : "atras");
    setPasoActual(nuevoPaso);
  };

  const renderNavegacionWizard = () => (
    <div className="mobile-wizard-navigation">
      <button
        type="button"
        className="secondary-button"
        disabled={pasoActual === 0}
        onClick={() => cambiarPaso(pasoActual - 1)}
      >
        Atrás
      </button>
      {pasoActual < pasosWizard.length - 1 ? (
        <button
          type="button"
          disabled={!pasoValido}
          onClick={() => cambiarPaso(pasoActual + 1)}
        >
          Continuar
        </button>
      ) : (
        <button type="button" onClick={handleSubmit} disabled={!proyecto || !pasoValido}>
          Crear pedido
        </button>
      )}
    </div>
  );

  const renderWizardMovil = () => (
    <div className="mobile-request-wizard">
      <div className="mobile-wizard-progress" aria-label={`Paso ${pasoActual + 1} de ${pasosWizard.length}`}>
        <div className="mobile-wizard-progress-copy">
          <span>Paso {pasoActual + 1} de {pasosWizard.length}</span>
          <strong>{pasosWizard[pasoActual]}</strong>
        </div>
        <div className="mobile-wizard-progress-track" aria-hidden="true">
          <span style={{ width: `${((pasoActual + 1) / pasosWizard.length) * 100}%` }} />
        </div>
        <div className="mobile-wizard-dots" aria-hidden="true">
          {pasosWizard.map((paso, indice) => (
            <span key={paso} className={indice <= pasoActual ? "is-complete" : ""} />
          ))}
        </div>
      </div>

      <section
        key={`${pasoActual}-${direccionPaso}`}
        className={`mobile-wizard-step slide-${direccionPaso}`}
        aria-labelledby={`mobile-step-title-${pasoActual}`}
      >
        {pasoActual === 0 && (
          <>
            <p className="section-kicker">Paso 1</p>
            <h2 id="mobile-step-title-0">Selecciona el proyecto</h2>
            <div className="mobile-identity-card">
              <span>Solicitante</span>
              <strong>{user?.nombre}</strong>
              <small>{user?.email}</small>
            </div>
            <div className="guided-field">
              <div className="guided-field-header">
                <label htmlFor="buscador-proyecto-mobile"><FontAwesomeIcon className="field-label-icon" icon={faScrewdriverWrench} aria-hidden="true" />Proyecto</label>
                <span>Obligatorio</span>
              </div>
              <ProjectSelector value={proyecto} onChange={setProyecto} inputId="buscador-proyecto-mobile" />
            </div>
          </>
        )}

        {pasoActual === 1 && (
          <>
            <p className="section-kicker">Paso 2</p>
            <h2 id="mobile-step-title-1">Tipo de pedido</h2>
            <div className="urgency-choice-grid" role="radiogroup" aria-label="Prioridad de la solicitud">
              <label className={`urgency-choice-card${urgente === "No" ? " selected" : ""}`}>
                <input type="radio" value="No" checked={urgente === "No"} onChange={event => setUrgente(event.target.value)} />
                <FontAwesomeIcon icon={faCalendarCheck} aria-hidden="true" />
                <strong>Normal</strong>
              </label>
              <label className={`urgency-choice-card${urgente === "Sí" ? " selected" : ""}`}>
                <input type="radio" value="Sí" checked={urgente === "Sí"} onChange={event => setUrgente(event.target.value)} />
                <FontAwesomeIcon icon={faBolt} aria-hidden="true" />
                <strong>Urgente</strong>
              </label>
            </div>
          </>
        )}

        {pasoActual === 2 && (
          <>
            <p className="section-kicker">Paso 3</p>
            <h2 id="mobile-step-title-2">Materiales</h2>
            {urgente === "Sí" ? (
              <div className="mobile-material-groups">
                <div className="request-block-card request-block-urgent">
                  <h3>Urgentes</h3>
                  <RequestItemsEditor value={elementosUrgentes} onChange={setElementosUrgentes} label="Materiales urgentes" />
                </div>
                <div className="request-block-card">
                  <h3>Planificables</h3>
                  <RequestItemsEditor value={elementosNoUrgentes} onChange={setElementosNoUrgentes} label="Materiales planificables" />
                </div>
              </div>
            ) : (
              <RequestItemsEditor value={elementos} onChange={setElementos} label="Materiales solicitados" />
            )}
          </>
        )}

        {pasoActual === 3 && (
          <>
            <p className="section-kicker">Paso 4</p>
            <h2 id="mobile-step-title-3"><FontAwesomeIcon icon={faPaperclip} aria-hidden="true" /> Adjuntos</h2>
            {urgente === "Sí" ? (
              <div className="mobile-attachment-groups">
                <div className="request-block-card request-block-urgent">
                  <h3>Necesidades urgentes</h3>
                  {renderAdjuntosBloque({ archivos: archivosUrgente, setter: setArchivosUrgente, inputRef: urgenteInputRef, inputId: "archivos-urgente-mobile" })}
                </div>
                <div className="request-block-card">
                  <h3>Necesidades planificables</h3>
                  {renderAdjuntosBloque({ archivos: archivosNoUrgente, setter: setArchivosNoUrgente, inputRef: noUrgenteInputRef, inputId: "archivos-no-urgente-mobile" })}
                </div>
              </div>
            ) : renderAdjuntosBloque({
              archivos: archivosDescripcion,
              setter: setArchivosDescripcion,
              inputRef: descripcionInputRef,
              inputId: "archivos-descripcion-mobile"
            })}
          </>
        )}

        {pasoActual === 4 && (
          <>
            <p className="section-kicker">Paso 5</p>
            <h2 id="mobile-step-title-4">Revisa y crea el pedido</h2>
            <div className="summary-grid">
              <div><span>Proyecto</span><strong>{proyecto}</strong></div>
              <div><span>Tipo</span><strong>{urgente === "Sí" ? "Urgente" : "Normal"}</strong></div>
              <div><span>Materiales</span><strong>{urgente === "Sí" ? normalizarElementos(elementosUrgentes).length + normalizarElementos(elementosNoUrgentes).length : normalizarElementos(elementos).length}</strong></div>
              <div><span>Archivos</span><strong>{contarArchivos()}</strong></div>
            </div>
          </>
        )}
      </section>

      {renderNavegacionWizard()}
    </div>
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>Nueva solicitud de compra</h1>
        <p className="page-subtitle">
          Completa los datos para registrar una necesidad de compra.
        </p>
      </div>

      <div className="new-request-page">
        <NotificationToast message={mensaje} onClose={() => setMensaje("")} />

        {modoWizard ? renderWizardMovil() : <div className="new-request-shell">
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
                  <RequestItemsEditor
                    value={elementosUrgentes}
                    onChange={setElementosUrgentes}
                    label="Elementos urgentes"
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
                  <RequestItemsEditor
                    value={elementosNoUrgentes}
                    onChange={setElementosNoUrgentes}
                    label="Elementos planificables"
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
                <RequestItemsEditor
                  value={elementos}
                  onChange={setElementos}
                  label="Elementos solicitados"
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
        </div>}
      </div>
    </Layout>
  );
}

export default NuevaSolicitud;







