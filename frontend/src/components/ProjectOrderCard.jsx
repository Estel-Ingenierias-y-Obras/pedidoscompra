import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faFolderOpen } from "@fortawesome/free-solid-svg-icons";

function ProjectOrderCard({ proyecto, onOpen }) {
  return (
    <button
      type="button"
      className="project-order-card"
      onClick={() => onOpen(proyecto.nombre)}
      aria-label={`Abrir ${proyecto.nombre}, ${proyecto.total} pedidos`}
    >
      <span className="project-order-card-topline">
        <span className="project-order-card-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faFolderOpen} />
        </span>
        <span className="project-order-card-title" title={proyecto.nombre}>
          {proyecto.nombre}
        </span>
      </span>

      <span className="project-order-card-metrics">
        <span className={`estado estado-${proyecto.estadoGeneral.clase}`}>
          {proyecto.estadoGeneral.etiqueta}
        </span>
      </span>

      <span className="project-order-statuses" aria-label="Resumen de estados">
        {proyecto.estados.map(estado => (
          <span className={`project-status-count estado-${estado.clase}`} key={estado.estado}>
            <strong>{estado.cantidad}</strong>{" "}
            {estado.cantidad === 1 ? estado.etiqueta.toLowerCase() : estado.plural}
          </span>
        ))}
      </span>

      <FontAwesomeIcon className="project-order-card-arrow" icon={faArrowRight} aria-hidden="true" />
    </button>
  );
}

export default ProjectOrderCard;
