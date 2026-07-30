import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faEye,
  faFile,
  faFileImage,
  faFileLines,
  faFilePdf
} from "@fortawesome/free-solid-svg-icons";
import DeleteIconButton from "./DeleteIconButton";
import api from "../api";

export const formatearTamanoArchivo = (bytes = 0) => {
  if (!bytes) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const obtenerIconoArchivo = (tipoMime = "") => {
  if (tipoMime.includes("pdf")) return faFilePdf;
  if (tipoMime.startsWith("image/")) return faFileImage;
  if (tipoMime.startsWith("text/") || tipoMime.includes("word")) {
    return faFileLines;
  }

  return faFile;
};

export const obtenerUrlAdjunto = (pedido, archivo) => {
  const ruta = `/api/pedidos/${pedido._id}/archivos/${archivo.fileId}`;
  return `${api.defaults.baseURL || ""}${ruta}`;
};

function AttachmentList({
  pedido,
  archivos: archivosProp,
  canDelete = false,
  onDelete
}) {
  const archivos = Array.isArray(archivosProp)
    ? archivosProp
    : Array.isArray(pedido?.archivos)
      ? pedido.archivos
      : [];

  if (archivos.length === 0) {
    return (
      <div className="edit-attachments-empty">
        Sin archivos adjuntos
      </div>
    );
  }

  return (
    <div className="edit-attachments-list">
      {archivos.map(archivo => {
        const url = obtenerUrlAdjunto(pedido, archivo);

        return (
          <div className="edit-attachment-item" key={archivo.fileId}>
            <FontAwesomeIcon
              className="edit-attachment-icon"
              icon={obtenerIconoArchivo(archivo.tipoMime)}
            />
            <div className="edit-attachment-info">
              <strong>{archivo.nombre}</strong>
              <span>{formatearTamanoArchivo(archivo.tamano)}</span>
            </div>
            <div className="edit-attachment-actions">
              <button
                type="button"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                title="Visualizar adjunto"
                aria-label={`Visualizar ${archivo.nombre}`}
              >
                <FontAwesomeIcon icon={faEye} />
              </button>
              <button
                type="button"
                onClick={() =>
                  window.open(`${url}?download=1`, "_blank", "noopener,noreferrer")
                }
                title="Descargar adjunto"
                aria-label={`Descargar ${archivo.nombre}`}
              >
                <FontAwesomeIcon icon={faDownload} />
              </button>
              {canDelete && (
                <DeleteIconButton
                  label={`Eliminar ${archivo.nombre}`}
                  onClick={() => onDelete?.(archivo.fileId)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AttachmentList;


