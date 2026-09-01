import AttachmentList from "./AttachmentList";
import ModalShell from "./ModalShell";
import { RequestItemsList } from "./RequestItems";

const obtenerAdjuntosDescripcion = pedido =>
  Array.isArray(pedido.archivosDescripcion) && pedido.archivosDescripcion.length > 0
    ? pedido.archivosDescripcion
    : !pedido.urgente
      ? pedido.archivos || []
      : [];

const obtenerAdjuntosUrgente = pedido =>
  Array.isArray(pedido.archivosUrgente) ? pedido.archivosUrgente : [];

const obtenerAdjuntosNoUrgente = pedido =>
  Array.isArray(pedido.archivosNoUrgente) && pedido.archivosNoUrgente.length > 0
    ? pedido.archivosNoUrgente
    : pedido.urgente
      ? pedido.archivos || []
      : [];

function RequestBlock({ titulo, texto, elementos, archivos, pedido, urgente = false }) {
  return (
    <section className={`original-request-block${urgente ? " is-urgent" : ""}`}>
      <h3>{titulo}</h3>
      <RequestItemsList elementos={elementos} textoLegacy={texto} />
      <div className="original-request-attachments">
        <strong>Adjuntos originales</strong>
        <AttachmentList pedido={pedido} archivos={archivos} />
      </div>
    </section>
  );
}

function OriginalRequestModal({ pedido, onClose }) {
  if (!pedido) return null;

  return (
    <ModalShell onClose={onClose} className="original-request-modal" ariaLabel="Solicitud original">
        <h2 id="original-request-title">Solicitud original</h2>
        <p className="original-request-project">{pedido.proyecto}</p>

        <div className="original-request-content">
          {pedido.urgente ? (
            <>
              <RequestBlock
                titulo="Necesidades urgentes"
                texto={pedido.motivoUrgencia}
                elementos={pedido.elementosUrgentes}
                archivos={obtenerAdjuntosUrgente(pedido)}
                pedido={pedido}
                urgente
              />
              <RequestBlock
                titulo="Necesidades planificables / no urgentes"
                texto={pedido.descripcion}
                elementos={pedido.elementosNoUrgentes}
                archivos={obtenerAdjuntosNoUrgente(pedido)}
                pedido={pedido}
              />
            </>
          ) : (
            <RequestBlock
              titulo="Descripción del pedido"
              texto={pedido.descripcion}
              elementos={pedido.elementos}
              archivos={obtenerAdjuntosDescripcion(pedido)}
              pedido={pedido}
            />
          )}
        </div>

    </ModalShell>
  );
}

export default OriginalRequestModal;
