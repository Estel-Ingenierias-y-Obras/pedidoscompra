import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { descargarSolicitudPdf } from "../utils/solicitudPdf";

export default function DownloadRequestButton({ pedido }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const descargar = async () => {
    setGenerando(true);
    setError("");
    try { await descargarSolicitudPdf(pedido); }
    catch { setError("No se pudo generar el PDF. Vuelve a intentarlo."); }
    finally { setGenerando(false); }
  };
  return <div className="download-request-actions">
    <div className="modal-buttons">
      <button type="button" onClick={descargar} disabled={generando}>
        <FontAwesomeIcon icon={faFilePdf} /> {generando ? "Generando PDF…" : "Descargar Solicitud"}
      </button>
    </div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
