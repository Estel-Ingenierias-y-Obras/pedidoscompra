import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";

export default function ActualizarDatosButton({ disabled, onClick }) {
  return <button type="button" className="bc-refresh-button" disabled={disabled} onClick={onClick}>
    <FontAwesomeIcon icon={faRotate} /> Actualizar datos
  </button>;
}
