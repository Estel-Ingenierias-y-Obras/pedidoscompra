import { useId, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import AddPersonIconButton from "./AddPersonIconButton";
import DeleteIconButton from "./DeleteIconButton";

const valido = email => email.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email);

export function NotificationPeopleList({ personas = [] }) {
  return <section className="notification-people-readonly">
    <strong>Personas notificadas:</strong>
    {personas.length ? <ul>{personas.map(email => <li key={email}>{email}</li>)}</ul> : <p>Ninguna persona adicional</p>}
  </section>;
}

export default function NotificationPeople({ value = [], onChange, onPendingChange }) {
  const id = useId();
  const [borrador, setBorrador] = useState("");
  const [error, setError] = useState("");
  const agregar = () => {
    const emails = [borrador.trim().toLowerCase()];
    if (emails.some(email => !valido(email))) {
      setError("Revisa el formato de los correos electrónicos.");
      return;
    }
    onChange([...new Set([...emails, ...value])]);
    setBorrador("");
    setError("");
    onPendingChange?.(false);
  };
  return <section className="notification-people-editor">
    <div className="request-block-title">
      <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
      <div>
        <label htmlFor={id}>Personas a notificar</label>
        <p>Destinatarios que recibirán en copia la nueva solicitud de compra.</p>
      </div>
    </div>
    <div className="settings-form">
      <div>
        <input id={id} type="email" autoCapitalize="none" autoComplete="off"
          placeholder="persona@esteling.com" value={borrador} aria-describedby={error ? id + "-error" : undefined}
          aria-invalid={Boolean(error)} onChange={event => {
            setBorrador(event.target.value); setError(""); onPendingChange?.(Boolean(event.target.value.trim()));
          }} onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); agregar(); }
          }} />
      </div>
      <AddPersonIconButton label="Añadir destinatario" onClick={agregar} />
    </div>
    {error && <p id={id + "-error"} role="alert">{error}</p>}
    {value.length === 0 ? <div className="empty-state settings-empty-state">
      No hay destinatarios configurados.
    </div> : <table className="settings-table acciones-centradas-table notification-people-table">
      <thead><tr><th>Correo</th><th>Acciones</th></tr></thead>
      <tbody>{value.map(email => <tr key={email}>
        <td className="settings-email">{email}</td>
        <td><DeleteIconButton label={`Eliminar ${email}`} onClick={() => onChange(value.filter(item => item !== email))} /></td>
      </tr>)}</tbody>
    </table>}
  </section>;
}
