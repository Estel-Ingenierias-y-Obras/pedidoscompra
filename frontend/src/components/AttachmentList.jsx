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

const obtenerBlobAdjunto = async (pedido, archivo, descargar = false) => {
  const ruta = `/api/pedidos/${pedido._id}/archivos/${archivo.fileId}`;
  const response = await api.get(ruta, {
    params: descargar ? { download: 1 } : undefined,
    responseType: "blob"
  });

  return response.data;
};

const abrirBlobEnNuevaPestana = (blob) => {
  const blobUrl = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = blobUrl;
  enlace.target = "_blank";
  enlace.rel = "noopener noreferrer";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

export const visualizarAdjunto = async (pedido, archivo) => {
  const blob = await obtenerBlobAdjunto(pedido, archivo);
  abrirBlobEnNuevaPestana(blob);
};

export const descargarAdjunto = async (pedido, archivo) => {
  const blob = await obtenerBlobAdjunto(pedido, archivo, true);
  const blobUrl = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = blobUrl;
  enlace.download = archivo.nombre || "adjunto";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
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

  const ejecutarAccionAdjunto = async (accion, archivo) => {
    try {
      await accion(pedido, archivo);
    } catch (error) {
      console.error("Error accediendo al adjunto:", error);
    }
  };

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
                onClick={() => ejecutarAccionAdjunto(visualizarAdjunto, archivo)}
                title="Visualizar adjunto"
                aria-label={`Visualizar ${archivo.nombre}`}
              >
                <FontAwesomeIcon icon={faEye} />
              </button>
              <button
                type="button"
                onClick={() => ejecutarAccionAdjunto(descargarAdjunto, archivo)}
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


