import { useContext, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faEye,
  faFile,
  faFileImage,
  faFileLines,
  faFilePdf,
  faPen
} from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import DeleteIconButton from "../components/DeleteIconButton";
import ProjectSelector from "../components/ProjectSelector";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

function MisSolicitudes() {
  const { solicitudes, setSolicitudes } = useContext(SolicitudesContext);
  const { user } = useContext(AuthContext);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [busquedaProyecto, setBusquedaProyecto] = useState("");
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null);
  const [pedidoAEditar, setPedidoAEditar] = useState(null);
  const [formEdicion, setFormEdicion] = useState({
    proyecto: "",
    urgente: "No",
    motivoUrgencia: "",
    descripcion: ""
  });
  const [adjuntosExistentes, setAdjuntosExistentes] = useState([]);
  const [adjuntosNuevos, setAdjuntosNuevos] = useState([]);
  const archivoEdicionInputRef = useRef(null);

  const misPedidos = solicitudes.filter(
    solicitud => solicitud.email === user.email
  );

  const misPedidosFiltrados = misPedidos.filter(solicitud =>
    (solicitud.proyecto || "")
      .toLowerCase()
      .includes(busquedaProyecto.toLowerCase())
  );

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    setError("");

    setTimeout(() => {
      setMensaje("");
    }, 3000);
  };

  const mostrarError = (texto) => {
    setError(texto);
    setMensaje("");
  };

  const abrirEdicion = (pedido) => {
    setPedidoAEditar(pedido);
    setFormEdicion({
      proyecto: pedido.proyecto || "",
      urgente: pedido.urgente ? "Sí" : "No",
      motivoUrgencia: pedido.motivoUrgencia || "",
      descripcion: pedido.descripcion || ""
    });
    setAdjuntosExistentes(Array.isArray(pedido.archivos) ? pedido.archivos : []);
    setAdjuntosNuevos([]);
    setError("");

    if (archivoEdicionInputRef.current) {
      archivoEdicionInputRef.current.value = "";
    }
  };

  const cerrarEdicion = () => {
    setPedidoAEditar(null);
    setAdjuntosExistentes([]);
    setAdjuntosNuevos([]);

    if (archivoEdicionInputRef.current) {
      archivoEdicionInputRef.current.value = "";
    }
  };

  const actualizarCampoEdicion = (campo, valor) => {
    setFormEdicion(actual => ({
      ...actual,
      [campo]: valor
    }));
  };

  const obtenerClaveArchivo = (archivo) =>
    `${archivo.nombre || archivo.name}-${archivo.tamano || archivo.size}-${archivo.tipoMime || archivo.type}`;

  const agregarAdjuntosEdicion = (event) => {
    const archivosSeleccionados = Array.from(event.target.files || []);
    const clavesExistentes = new Set([
      ...adjuntosExistentes.map(obtenerClaveArchivo),
      ...adjuntosNuevos.map(obtenerClaveArchivo)
    ]);

    const nuevosSinDuplicar = archivosSeleccionados.filter(archivo => {
      const clave = obtenerClaveArchivo(archivo);

      if (clavesExistentes.has(clave)) {
        return false;
      }

      clavesExistentes.add(clave);
      return true;
    });

    setAdjuntosNuevos(actuales => [...actuales, ...nuevosSinDuplicar]);
    event.target.value = "";
  };

  const eliminarAdjuntoExistente = (fileId) => {
    setAdjuntosExistentes(actuales =>
      actuales.filter(archivo => archivo.fileId.toString() !== fileId.toString())
    );
  };

  const eliminarAdjuntoNuevo = (indice) => {
    setAdjuntosNuevos(actuales =>
      actuales.filter((_, indiceActual) => indiceActual !== indice)
    );
  };

  const formatearTamano = (bytes = 0) => {
    if (!bytes) {
      return "0 KB";
    }

    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const obtenerIconoArchivo = (tipoMime = "") => {
    if (tipoMime.includes("pdf")) return faFilePdf;
    if (tipoMime.startsWith("image/")) return faFileImage;
    if (tipoMime.startsWith("text/") || tipoMime.includes("word")) {
      return faFileLines;
    }

    return faFile;
  };

  const obtenerUrlAdjunto = (archivo) => {
    const ruta = `/api/pedidos/${pedidoAEditar._id}/archivos/${archivo.fileId}`;
    return `${api.defaults.baseURL || ""}${ruta}`;
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();

    if (!pedidoAEditar) {
      return;
    }

    try {
      const datosEdicion = new FormData();
      datosEdicion.append("proyecto", formEdicion.proyecto);
      datosEdicion.append("urgente", formEdicion.urgente === "Sí");
      datosEdicion.append(
        "motivoUrgencia",
        formEdicion.urgente === "Sí" ? formEdicion.motivoUrgencia : ""
      );
      datosEdicion.append("descripcion", formEdicion.descripcion);
      datosEdicion.append(
        "archivosExistentes",
        JSON.stringify(adjuntosExistentes.map(archivo => archivo.fileId))
      );

      adjuntosNuevos.forEach(archivo => {
        datosEdicion.append("archivos", archivo);
      });

      const response = await api.put(
        `/api/pedidos/${pedidoAEditar._id}`,
        datosEdicion
      );

      setSolicitudes(solicitudesActuales =>
        solicitudesActuales.map(solicitud =>
          solicitud._id === response.data._id
            ? response.data
            : solicitud
        )
      );

      cerrarEdicion();
      mostrarMensaje("Pedido actualizado correctamente");
    } catch (err) {
      console.error("Error editando pedido:", err);
      mostrarError(
        err.response?.data?.error ||
          "No se pudo actualizar el pedido"
      );
    }
  };

  const confirmarEliminacion = async () => {
    try {
      await api.delete(`/api/pedidos/${pedidoAEliminar._id}`);

      const solicitudesFiltradas = solicitudes.filter(
        solicitud => solicitud._id !== pedidoAEliminar._id
      );

      setSolicitudes(solicitudesFiltradas);
      setPedidoAEliminar(null);
      mostrarMensaje("Pedido eliminado correctamente");
    } catch (err) {
      console.error("Error eliminando pedido:", err);
      mostrarError(
        err.response?.data?.error ||
          "No se pudo eliminar el pedido"
      );
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Mis Pedidos</h1>
      </div>

      {mensaje && (
        <div className="mensaje-exito">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="settings-feedback settings-feedback-error" role="alert">
          {error}
        </div>
      )}

      <div className="page-content">
        <div className="barra-busqueda">
          <label>Buscar por proyecto:</label>
          <input
            type="search"
            placeholder="Buscar proyecto..."
            value={busquedaProyecto}
            onChange={(event) =>
              setBusquedaProyecto(event.target.value)
            }
          />
        </div>

        {misPedidosFiltrados.length === 0 ? (
          <p>No existen pedidos.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Proyecto</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {misPedidosFiltrados.map(solicitud => (
                <tr key={solicitud._id}>
                  <td>
                    {solicitud._id
                      ? solicitud._id.slice(-6)
                      : "Sin ID"}
                  </td>
                  <td>{solicitud.proyecto}</td>
                  <td>
                    <span
                      className={`estado estado-${solicitud.estado.toLowerCase()}`}
                    >
                      {solicitud.estado}
                    </span>
                  </td>
                  <td>
                    {solicitud.estado === "Pendiente" && (
                      <div className="mis-pedidos-actions">
                        <button
                          type="button"
                          className="mis-pedidos-action-button mis-pedidos-edit-button"
                          onClick={() => abrirEdicion(solicitud)}
                          title="Editar pedido"
                          aria-label="Editar pedido"
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        <DeleteIconButton
                          label="Eliminar pedido"
                          onClick={() => setPedidoAEliminar(solicitud)}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pedidoAEditar && (
        <div className="modal-overlay">
          <div className="modal edit-order-modal">
            <h2>Editar pedido</h2>

            <form className="edit-order-form" onSubmit={guardarEdicion}>
              <div className="edit-order-card">
                <div className="edit-order-section">
                  <label>Proyecto</label>
                  <ProjectSelector
                    value={formEdicion.proyecto}
                    onChange={(valor) =>
                      actualizarCampoEdicion("proyecto", valor)
                    }
                    inputId="editar-proyecto"
                  />
                </div>

                <div className="edit-order-section">
                  <label>Prioridad urgente</label>
                  <div
                    className="edit-priority-segment"
                    role="group"
                    aria-label="Prioridad urgente"
                  >
                    <label>
                      <input
                        type="radio"
                        name="editarUrgente"
                        value="Sí"
                        checked={formEdicion.urgente === "Sí"}
                        onChange={(event) =>
                          actualizarCampoEdicion("urgente", event.target.value)
                        }
                      />
                      <span>Sí</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="editarUrgente"
                        value="No"
                        checked={formEdicion.urgente === "No"}
                        onChange={(event) =>
                          actualizarCampoEdicion("urgente", event.target.value)
                        }
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>

                <div className="edit-order-section edit-order-descriptions">
                  {formEdicion.urgente === "Sí" ? (
                    <>
                      <div className="edit-order-field-block">
                        <label>Urgente</label>
                        <textarea
                          value={formEdicion.motivoUrgencia}
                          placeholder="Elementos urgentes"
                          onChange={(event) =>
                            actualizarCampoEdicion(
                              "motivoUrgencia",
                              event.target.value
                            )
                          }
                        />
                      </div>

                      <div className="edit-order-field-block">
                        <label>No urgente</label>
                        <textarea
                          value={formEdicion.descripcion}
                          placeholder="Elementos no urgentes"
                          onChange={(event) =>
                            actualizarCampoEdicion(
                              "descripcion",
                              event.target.value
                            )
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div className="edit-order-field-block">
                      <label>Descripción</label>
                      <textarea
                        value={formEdicion.descripcion}
                        placeholder="Elementos solicitados"
                        onChange={(event) =>
                          actualizarCampoEdicion(
                            "descripcion",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="edit-order-section">
                  <label>Adjuntos</label>
                  <div className="edit-attachments-list">
                    {adjuntosExistentes.length === 0 && adjuntosNuevos.length === 0 ? (
                      <div className="edit-attachments-empty">
                        Sin archivos adjuntos
                      </div>
                    ) : (
                      <>
                        {adjuntosExistentes.map(archivo => {
                          const url = obtenerUrlAdjunto(archivo);

                          return (
                            <div
                              className="edit-attachment-item"
                              key={archivo.fileId}
                            >
                              <FontAwesomeIcon
                                className="edit-attachment-icon"
                                icon={obtenerIconoArchivo(archivo.tipoMime)}
                              />
                              <div className="edit-attachment-info">
                                <strong>{archivo.nombre}</strong>
                                <span>{formatearTamano(archivo.tamano)}</span>
                              </div>
                              <div className="edit-attachment-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    window.open(url, "_blank", "noopener,noreferrer")
                                  }
                                  title="Visualizar adjunto"
                                  aria-label={`Visualizar ${archivo.nombre}`}
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    window.open(
                                      `${url}?download=1`,
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                  title="Descargar adjunto"
                                  aria-label={`Descargar ${archivo.nombre}`}
                                >
                                  <FontAwesomeIcon icon={faDownload} />
                                </button>
                                <DeleteIconButton
                                  label={`Eliminar ${archivo.nombre}`}
                                  onClick={() =>
                                    eliminarAdjuntoExistente(archivo.fileId)
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}

                        {adjuntosNuevos.map((archivo, indice) => (
                          <div
                            className="edit-attachment-item"
                            key={`${archivo.name}-${archivo.size}-${archivo.lastModified}`}
                          >
                            <FontAwesomeIcon
                              className="edit-attachment-icon"
                              icon={obtenerIconoArchivo(archivo.type)}
                            />
                            <div className="edit-attachment-info">
                              <strong>{archivo.name}</strong>
                              <span>{formatearTamano(archivo.size)} · Nuevo</span>
                            </div>
                            <div className="edit-attachment-actions">
                              <DeleteIconButton
                                label={`Eliminar ${archivo.name}`}
                                onClick={() => eliminarAdjuntoNuevo(indice)}
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={archivoEdicionInputRef}
                    multiple
                    onChange={agregarAdjuntosEdicion}
                  />
                </div>
              </div>

              <div className="modal-buttons edit-order-actions">
                <button
                  type="button"
                  onClick={cerrarEdicion}
                >
                  Cancelar
                </button>

                <button type="submit">
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pedidoAEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Eliminar pedido</h2>

            <p>
              ¿Seguro que quieres eliminar este pedido?
            </p>

            <p>
              <strong>Proyecto:</strong>{" "}
              {pedidoAEliminar.proyecto}
            </p>

            <div className="modal-buttons">
              <button
                type="button"
                onClick={() => setPedidoAEliminar(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button-danger"
                onClick={confirmarEliminacion}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default MisSolicitudes;
