import { useRef, useState } from "react";
import Layout from "../components/Layout";
import DeleteIconButton from "../components/DeleteIconButton";
import ProjectSelector from "../components/ProjectSelector";
import { useContext } from "react";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";


function NuevaSolicitud() {

const {
  setSolicitudes
} = useContext(SolicitudesContext);

const { user } = useContext(AuthContext);
const [proyecto, setProyecto] = useState("");
  const [urgente, setUrgente] = useState("No");
  const [motivoUrgencia, setMotivoUrgencia] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const archivoInputRef = useRef(null);

  const agregarArchivos = (event) => {
    const nuevosArchivos = Array.from(
      event.target.files || []
    );

    setArchivos(archivosActuales => {
      const clavesActuales = new Set(
        archivosActuales.map(archivoItem =>
          `${archivoItem.name}-${archivoItem.size}-${archivoItem.lastModified}`
        )
      );

      const archivosSinDuplicar = nuevosArchivos.filter(
        archivoItem =>
          !clavesActuales.has(
            `${archivoItem.name}-${archivoItem.size}-${archivoItem.lastModified}`
          )
      );

      return [...archivosActuales, ...archivosSinDuplicar];
    });

    event.target.value = "";
  };

  const eliminarArchivoSeleccionado = (indice) => {
    setArchivos(archivosActuales =>
      archivosActuales.filter(
        (archivoItem, indiceItem) => indiceItem !== indice
      )
    );
  };

  const limpiarArchivos = () => {
    setArchivos([]);

    if (archivoInputRef.current) {
      archivoInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {

  const nuevaSolicitud = new FormData();

  nuevaSolicitud.append("solicitante", user.nombre);
  nuevaSolicitud.append("compradorAsignado", "");
  nuevaSolicitud.append("email", user.email);
  nuevaSolicitud.append("proyecto", proyecto);
  nuevaSolicitud.append("urgente", urgente === "Sí");
  nuevaSolicitud.append("motivoUrgencia", motivoUrgencia);
  nuevaSolicitud.append("descripcion", descripcion);
  nuevaSolicitud.append("estado", "Pendiente");

  archivos.forEach(archivoItem => {
    nuevaSolicitud.append("archivos", archivoItem);
  });

    try {

  await api.post(
  "/api/pedidos",
  nuevaSolicitud
);


  const response =
  await api.get(
    "/api/pedidos"
  );
  setSolicitudes(response.data);

} catch (error) {

  console.error(
    "Error creando pedido:",
    error
  );

  return;
}

  window.scrollTo({
  top: 0,
  behavior: "smooth"
});

  setProyecto("");
setUrgente("No");
setMotivoUrgencia("");
setDescripcion("");
limpiarArchivos();

setMensaje("Pedido enviado correctamente");
  setTimeout(() => {
  setMensaje("");
}, 3000);
};

  return (
    <Layout>

      <div className="page-header">
        <h1>Nueva solicitud de compra</h1>
        <p className="page-subtitle">
          Completa los datos para registrar una necesidad de compra.
        </p>
      </div>

      {mensaje && (
        <div className="mensaje-exito">
          {mensaje}
        </div>
)}

      <div className="page-content new-request-form">

        <div className="form-group">
          <label>Proyecto</label>
          <br />

          <ProjectSelector value={proyecto} onChange={setProyecto} />
        </div>

        <br />
        <br />

        <div className="form-group urgency-field">
          <label>Prioridad de la solicitud</label>
          <p className="field-help">
            Indica si la compra requiere atención urgente.
          </p>

          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="Sí"
                checked={urgente === "Sí"}
                onChange={(e) => setUrgente(e.target.value)}
              />
              Sí
            </label>

            <label>
              <input
                type="radio"
                value="No"
                checked={urgente === "No"}
                onChange={(e) => setUrgente(e.target.value)}
              />
              No
            </label>
          </div>
        </div>

        <br />
        <br />

        {urgente === "Sí" ? (
          <>
            <div className="form-group">
              <label>Urgente</label>

              <br />

              <textarea
                value={motivoUrgencia}
                placeholder="Elementos urgentes"
                onChange={(e) =>
                  setMotivoUrgencia(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>No urgente</label>

              <br />

              <textarea
                value={descripcion}
                placeholder="Elementos no urgentes"
                onChange={(e) =>
                  setDescripcion(e.target.value)
                }
              />
            </div>
          </>
        ) : (
          <div className="form-group">
            <label>Descripción</label>

            <br />

            <textarea
              value={descripcion}
              placeholder="Elementos solicitados"
              onChange={(e) =>
                setDescripcion(e.target.value)
              }
            />
          </div>
        )}

        <div className="form-group">
          <label>Documentación adjunta</label>
          <p className="field-help">
            Puedes seleccionar varios archivos, hasta 10 MB por archivo.
          </p>

          <br />

          <input
            type="file"
            ref={archivoInputRef}
            multiple
            onChange={agregarArchivos}
          />

          {archivos.length > 0 && (
            <div className="archivo-seleccionado">
              {archivos.map((archivoItem, indice) => (
                <p
                  key={`${archivoItem.name}-${archivoItem.size}-${archivoItem.lastModified}`}
                >
                  📎 <strong>{archivoItem.name}</strong>{" "}
                  <DeleteIconButton
                    label={`Eliminar ${archivoItem.name}`}
                    className="attachment-delete-button"
                    onClick={() =>
                      eliminarArchivoSeleccionado(indice)
                    }
                  />
                </p>
              ))}
            </div>
          )}
        </div>

        <br />
        <br />

        <button className="submit-request-button" onClick={handleSubmit}>
          Enviar Solicitud
        </button>


      </div>

    </Layout>
  );
}

export default NuevaSolicitud;





