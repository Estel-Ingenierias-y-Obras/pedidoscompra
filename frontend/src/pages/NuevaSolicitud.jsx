import { useContext, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile } from "@fortawesome/free-solid-svg-icons";
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

  const renderAdjuntosBloque = ({ archivos, setter, inputRef, inputId }) => (
    <div className="block-attachments">
      <label htmlFor={inputId}>Adjuntos relacionados</label>
      <input
        id={inputId}
        type="file"
        ref={inputRef}
        multiple
        onChange={(event) => agregarArchivos(event, setter)}
      />

      {archivos.length > 0 && (
        <div className="edit-attachments-list new-attachments-list">
          {archivos.map((archivo, indice) => (
            <div
              className="edit-attachment-item"
              key={obtenerClaveArchivo(archivo)}
            >
              <FontAwesomeIcon
                className="edit-attachment-icon"
                icon={obtenerIconoArchivo(archivo.type) || faFile}
              />
              <div className="edit-attachment-info">
                <strong>{archivo.name}</strong>
                <span>{formatearTamanoArchivo(archivo.size)}</span>
              </div>
              <div className="edit-attachment-actions">
                <DeleteIconButton
                  label={`Eliminar ${archivo.name}`}
                  onClick={() => eliminarArchivoSeleccionado(indice, setter)}
                />
              </div>
            </div>
          ))}
        </div>
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

      {mensaje && (
        <div className="mensaje-exito">
          {mensaje}
        </div>
      )}

      <div className="page-content new-request-form">
        <div className="form-group">
          <label>Proyecto</label>
          <ProjectSelector value={proyecto} onChange={setProyecto} />
        </div>

        <div className="form-group urgency-field">
          <label>Prioridad de la solicitud</label>
          <p className="field-help">
            Indica si la compra requiere atención urgente.
          </p>

          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="Sí"
                checked={urgente === "Sí"}
                onChange={(event) => setUrgente(event.target.value)}
              />
              Sí
            </label>

            <label>
              <input
                type="radio"
                value="No"
                checked={urgente === "No"}
                onChange={(event) => setUrgente(event.target.value)}
              />
              No
            </label>
          </div>
        </div>

        {urgente === "Sí" ? (
          <>
            <div className="form-group request-block-card">
              <label>Urgente</label>
              <textarea
                value={motivoUrgencia}
                placeholder="Elementos urgentes"
                onChange={(event) => setMotivoUrgencia(event.target.value)}
              />
              {renderAdjuntosBloque({
                archivos: archivosUrgente,
                setter: setArchivosUrgente,
                inputRef: urgenteInputRef,
                inputId: "archivos-urgente"
              })}
            </div>

            <div className="form-group request-block-card">
              <label>No urgente</label>
              <textarea
                value={descripcion}
                placeholder="Elementos no urgentes"
                onChange={(event) => setDescripcion(event.target.value)}
              />
              {renderAdjuntosBloque({
                archivos: archivosNoUrgente,
                setter: setArchivosNoUrgente,
                inputRef: noUrgenteInputRef,
                inputId: "archivos-no-urgente"
              })}
            </div>
          </>
        ) : (
          <div className="form-group request-block-card">
            <label>Descripción</label>
            <textarea
              value={descripcion}
              placeholder="Elementos solicitados"
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

        <button className="submit-request-button" onClick={handleSubmit}>
          Enviar Solicitud
        </button>
      </div>
    </Layout>
  );
}

export default NuevaSolicitud;
