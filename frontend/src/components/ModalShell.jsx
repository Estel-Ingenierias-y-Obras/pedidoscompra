import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

function ModalShell({ children, onClose, className = "", ariaLabel = "Modal" }) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal modal-standard ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onMouseDown={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close-button"
          onClick={onClose}
          title="Cerrar"
          aria-label="Cerrar modal"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {children}
      </div>
    </div>
  );
}

export default ModalShell;
