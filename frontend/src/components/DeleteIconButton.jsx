import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

function DeleteIconButton({ label = "Eliminar", className = "", ...props }) {
  return (
    <button
      type="button"
      className={`delete-icon-button ${className}`.trim()}
      title={label}
      aria-label={label}
      {...props}
    >
      <FontAwesomeIcon icon={faTrash} />
    </button>
  );
}

export default DeleteIconButton;
