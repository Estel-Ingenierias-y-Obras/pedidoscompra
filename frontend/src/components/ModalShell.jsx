import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

function ModalShell({ children, onClose, className = "", ariaLabel = "Modal" }) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const elementoAnterior = document.activeElement;
    const cerrarConEscape = event => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", cerrarConEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", cerrarConEscape);
      elementoAnterior?.focus?.();
    };
  }, []);

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
          ref={closeButtonRef}
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
