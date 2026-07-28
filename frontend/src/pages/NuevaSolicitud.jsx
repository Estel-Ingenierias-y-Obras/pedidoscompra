import { useRef, useState } from "react";
import Layout from "../components/Layout";
import { useContext } from "react";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import { useEffect } from "react";


function NuevaSolicitud() {

const {
  setSolicitudes
} = useContext(SolicitudesContext);

const { user } = useContext(AuthContext);

  const [proyectos, setProyectos] =
  useState([]);

  const [proyecto, setProyecto] = useState("");
  const [busquedaProyecto, setBusquedaProyecto] = useState("");
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [urgente, setUrgente] = useState("No");
  const [motivoUrgencia, setMotivoUrgencia] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const archivoInputRef = useRef(null);

  useEffect(() => {

  const cargarProyectos = async () => {

    try {

      const response =
        await api.get(
          "/api/proyectos"
        );

      setProyectos(
  Array.isArray(response.data)
    ? response.data
    : response.data.value || []
);

    } catch (error) {

      console.error(
        "Error cargando proyectos:",
        error
      );

    }

  };

  cargarProyectos();

}, []);

  const terminoBusqueda =
    proyecto ? "" : busquedaProyecto.trim().toLowerCase();

  const proyectosFiltrados = terminoBusqueda
    ? proyectos
        .map(proyectoItem => {
          const codigo =
            (proyectoItem.nomProyecto || "").toLowerCase();
          const descripcionProyecto =
            (proyectoItem.descProyecto || "").toLowerCase();

          let prioridad = 3;

          if (codigo.startsWith(terminoBusqueda)) {
            prioridad = 0;
          } else if (codigo.includes(terminoBusqueda)) {
            prioridad = 1;
          } else if (descripcionProyecto.includes(terminoBusqueda)) {
            prioridad = 2;
          }

          return {
            proyecto: proyectoItem,
            prioridad
          };
        })
        .filter(resultado => resultado.prioridad < 3)
        .sort((a, b) => a.prioridad - b.prioridad)
        .slice(0, 50)
        .map(resultado => resultado.proyecto)
    : proyectos.slice(0, 50);

  const seleccionarProyecto = (proyectoSeleccionado) => {
    setProyecto(proyectoSeleccionado.nomProyecto);
    setBusquedaProyecto(
      `${proyectoSeleccionado.nomProyecto} - ${proyectoSeleccionado.descProyecto}`
    );
    setMostrarResultados(false);
    setIndiceActivo(-1);
  };

  const manejarTecladoProyecto = (e) => {
    if (!mostrarResultados || proyectosFiltrados.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceActivo(indiceActual =>
        Math.min(indiceActual + 1, proyectosFiltrados.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceActivo(indiceActual =>
        Math.max(indiceActual - 1, 0)
      );
    } else if (e.key === "Enter" && indiceActivo >= 0) {
      e.preventDefault();
      seleccionarProyecto(proyectosFiltrados[indiceActivo]);
    } else if (e.key === "Escape") {
      setMostrarResultados(false);
      setIndiceActivo(-1);
    }
  };

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
setBusquedaProyecto("");
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

          <div className="buscador-proyectos">
            <input
              type="search"
              placeholder="Buscar por código o descripción..."
              value={busquedaProyecto}
              onFocus={(e) => {
                setMostrarResultados(true);
                setIndiceActivo(-1);
                e.target.select();
              }}
              onChange={(e) => {
                setBusquedaProyecto(e.target.value);
                setProyecto("");
                setMostrarResultados(true);
                setIndiceActivo(-1);
              }}
              onKeyDown={manejarTecladoProyecto}
              onBlur={() => setMostrarResultados(false)}
              role="combobox"
              aria-expanded={mostrarResultados}
              aria-controls="resultados-proyectos"
              aria-autocomplete="list"
            />

            {mostrarResultados && (
              <div
                id="resultados-proyectos"
                className="resultados-proyectos"
                role="listbox"
              >
                {proyectosFiltrados.length === 0 ? (
                  <div className="sin-resultados-proyectos">
                    No se encontraron proyectos
                  </div>
                ) : (
                  proyectosFiltrados.map((proyectoItem, indice) => (
                    <button
                      type="button"
                      key={proyectoItem.id}
                      className={`resultado-proyecto${
                        indice === indiceActivo ? " resultado-proyecto-activo" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        seleccionarProyecto(proyectoItem);
                      }}
                      role="option"
                      aria-selected={indice === indiceActivo}
                    >
                      {proyectoItem.nomProyecto} - {proyectoItem.descProyecto}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
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
                  <button
                    type="button"
                    aria-label={`Eliminar ${archivoItem.name}`}
                    title="Eliminar archivo"
                    onClick={() =>
                      eliminarArchivoSeleccionado(indice)
                    }
                    style={{
                      marginLeft: "6px",
                      padding: "2px 8px",
                      minWidth: "auto"
                    }}
                  >
                    ×
                  </button>
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
