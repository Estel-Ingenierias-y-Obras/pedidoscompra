import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";

function AddPersonIconButton({ label, type = "button", ...props }) {
  return (
    <button
      {...props}
      type={type}
      className="add-person-icon-button"
      title={label}
      aria-label={label}
    >
      <FontAwesomeIcon icon={faUserPlus} aria-hidden="true" />
    </button>
  );
}

export default AddPersonIconButton;
