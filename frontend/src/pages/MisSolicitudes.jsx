import { useContext, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faEye,
  faFile,
  faFileImage,
  faFileLines,
  faFilePdf,
  faPaperclip,
  faPen,
  faArrowLeft,
  faMagnifyingGlass
} from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import AttachmentList, { formatearTamanoArchivo } from "../components/AttachmentList";
import DeleteIconButton from "../components/DeleteIconButton";
import ProjectSelector from "../components/ProjectSelector";
import ProjectOrderCard from "../components/ProjectOrderCard";
import OriginalRequestModal from "../components/OriginalRequestModal";
import ModalShell from "../components/ModalShell";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

const ESTADOS_PROYECTO = {
  pendiente: { etiqueta: "Pendiente", plural: "pendientes", prioridad: 1, clase: "pendiente" },
  "en gestion": { etiqueta: "En gestión", plural: "en gestión", prioridad: 2, clase: "en-curso" },
  pedido: { etiqueta: "Pedido", plural: "pedidos", prioridad: 3, clase: "pedido" },
  recibido: { etiqueta: "Recibido", plural: "recibidos", prioridad: 4, clase: "recibido" },
  archivar: { etiqueta: "Completado", plural: "completados", prioridad: 5, clase: "completado", final: true },
  completado: { etiqueta: "Completado", plural: "completados", prioridad: 5, clase: "completado", final: true }
};

const normalizarEstado = estado =>
  String(estado || "Sin estado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const obtenerDefinicionEstado = estado => {
  const clave = normalizarEstado(estado);
  return ESTADOS_PROYECTO[clave] || {
    etiqueta: estado || "Sin estado",
    plural: String(estado || "sin estado").toLowerCase(),
    prioridad: 3,
    clase: "pedido"
  };
};

function MisSolicitudes() {
  const { solicitudes, setSolicitudes } = useContext(SolicitudesContext);
  const { user } = useContext(AuthContext);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [busquedaProyecto, setBusquedaProyecto] = useState("");
  const [filtroProyectos, setFiltroProyectos] = useState("todos");
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null);
  const [pedidoAEditar, setPedidoAEditar] = useState(null);
  const [pedidoAdjuntosLectura, setPedidoAdjuntosLectura] = useState(null);
  const [pedidoDetalleOriginal, setPedidoDetalleOriginal] = useState(null);
  const [formEdicion, setFormEdicion] = useState({
    proyecto: "",
    urgente: "No",
    motivoUrgencia: "",
    descripcion: ""
  });
  const [adjuntosDescripcionExistentes, setAdjuntosDescripcionExistentes] = useState([]);
  const [adjuntosDescripcionNuevos, setAdjuntosDescripcionNuevos] = useState([]);
  const [adjuntosUrgenteExistentes, setAdjuntosUrgenteExistentes] = useState([]);
  const [adjuntosUrgenteNuevos, setAdjuntosUrgenteNuevos] = useState([]);
  const [adjuntosNoUrgenteExistentes, setAdjuntosNoUrgenteExistentes] = useState([]);
  const [adjuntosNoUrgenteNuevos, setAdjuntosNoUrgenteNuevos] = useState([]);
  const descripcionInputRef = useRef(null);
  const urgenteInputRef = useRef(null);
  const noUrgenteInputRef = useRef(null);

  const esGestor = ["Comprador", "Admin"].includes(user?.rol);
  const pedidosVisibles = esGestor
    ? solicitudes
    : solicitudes.filter(
        solicitud =>
          String(solicitud.email || "").toLowerCase() ===
          String(user?.email || "").toLowerCase()
      );

  const proyectos = useMemo(() => {
    const agrupados = pedidosVisibles.reduce((resultado, pedido) => {
      const nombre = (pedido.proyecto || "Sin proyecto").trim();

      if (!resultado.has(nombre)) {
        resultado.set(nombre, { nombre, total: 0, estados: new Map() });
      }

      const proyecto = resultado.get(nombre);
      proyecto.total += 1;
      const estado = pedido.estado || "Sin estado";
      proyecto.estados.set(estado, (proyecto.estados.get(estado) || 0) + 1);
      return resultado;
    }, new Map());

    return Array.from(agrupados.values())
      .map(proyecto => {
        const estados = Array.from(proyecto.estados, ([estado, cantidad]) => ({
          ...obtenerDefinicionEstado(estado),
          estado,
          cantidad
        })).sort((a, b) => a.prioridad - b.prioridad);
        const estadosActivos = estados.filter(estado => !estado.final);
        const estadoGeneral = estadosActivos[0] || {
          etiqueta: "Completado",
          clase: "completado",
          final: true
        };

        return { ...proyecto, estados, estadoGeneral };
      })
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
      );
  }, [pedidosVisibles]);

  const proyectosFiltrados = proyectos.filter(proyecto => {
    const coincideBusqueda = proyecto.nombre
      .toLowerCase()
      .includes(busquedaProyecto.trim().toLowerCase());
    const coincideEstado =
      filtroProyectos === "todos" ||
      (filtroProyectos === "pendientes" &&
        proyecto.estados.some(estado => normalizarEstado(estado.estado) === "pendiente")) ||
      (filtroProyectos === "completados" && proyecto.estadoGeneral.final);

    return coincideBusqueda && coincideEstado;
  });

  const pedidosProyectoSeleccionado = pedidosVisibles.filter(
    pedido => (pedido.proyecto || "Sin proyecto").trim() === proyectoSeleccionado
  );

  const puedeEditarPedido = pedido =>
    pedido.estado === "Pendiente" &&
    String(pedido.email || "").toLowerCase() === String(user?.email || "").toLowerCase();

  const puedeEliminarPedido = pedido =>
    user?.rol === "Admin" || puedeEditarPedido(pedido);

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    setError("");
    setTimeout(() => setMensaje(""), 3000);
  };

  const mostrarError = (texto) => {
    setError(texto);
    setMensaje("");
  };

  const obtenerAdjuntosDescripcion = (pedido) =>
    Array.isArray(pedido.archivosDescripcion) && pedido.archivosDescripcion.length > 0
      ? pedido.archivosDescripcion
      : !pedido.urgente
        ? pedido.archivos || []
        : [];

  const obtenerAdjuntosUrgente = (pedido) =>
    Array.isArray(pedido.archivosUrgente) ? pedido.archivosUrgente : [];

  const obtenerAdjuntosNoUrgente = (pedido) =>
    Array.isArray(pedido.archivosNoUrgente) && pedido.archivosNoUrgente.length > 0
      ? pedido.archivosNoUrgente
      : pedido.urgente
        ? pedido.archivos || []
        : [];

  const abrirEdicion = (pedido) => {
    setPedidoAEditar(pedido);
    setFormEdicion({
      proyecto: pedido.proyecto || "",
      urgente: pedido.urgente ? "Sí" : "No",
      motivoUrgencia: pedido.motivoUrgencia || "",
      descripcion: pedido.descripcion || ""
    });
    setAdjuntosDescripcionExistentes(obtenerAdjuntosDescripcion(pedido));
    setAdjuntosDescripcionNuevos([]);
    setAdjuntosUrgenteExistentes(obtenerAdjuntosUrgente(pedido));
    setAdjuntosUrgenteNuevos([]);
    setAdjuntosNoUrgenteExistentes(obtenerAdjuntosNoUrgente(pedido));
    setAdjuntosNoUrgenteNuevos([]);
    setError("");

    [descripcionInputRef, urgenteInputRef, noUrgenteInputRef].forEach(ref => {
      if (ref.current) {
        ref.current.value = "";
      }
    });
  };

  const cerrarEdicion = () => {
    setPedidoAEditar(null);
    setAdjuntosDescripcionExistentes([]);
    setAdjuntosDescripcionNuevos([]);
    setAdjuntosUrgenteExistentes([]);
    setAdjuntosUrgenteNuevos([]);
    setAdjuntosNoUrgenteExistentes([]);
    setAdjuntosNoUrgenteNuevos([]);

    [descripcionInputRef, urgenteInputRef, noUrgenteInputRef].forEach(ref => {
      if (ref.current) {
        ref.current.value = "";
      }
    });
  };

  const actualizarCampoEdicion = (campo, valor) => {
    setFormEdicion(actual => ({ ...actual, [campo]: valor }));
  };

  const obtenerClaveArchivo = (archivo) =>
    `${archivo.nombre || archivo.name}-${archivo.tamano || archivo.size}-${archivo.tipoMime || archivo.type}-${archivo.fileId || archivo.lastModified || ""}`;

  const agregarAdjuntosEdicion = (event, existentes, nuevos, setNuevos) => {
    const archivosSeleccionados = Array.from(event.target.files || []);
    const clavesExistentes = new Set([
      ...existentes.map(obtenerClaveArchivo),
      ...nuevos.map(obtenerClaveArchivo)
    ]);

    const nuevosSinDuplicar = archivosSeleccionados.filter(archivo => {
      const clave = obtenerClaveArchivo(archivo);

      if (clavesExistentes.has(clave)) {
        return false;
      }

      clavesExistentes.add(clave);
      return true;
    });

    setNuevos(actuales => [...actuales, ...nuevosSinDuplicar]);
    event.target.value = "";
  };

  const eliminarAdjuntoNuevo = (indice, setNuevos) => {
    setNuevos(actuales =>
      actuales.filter((_, indiceActual) => indiceActual !== indice)
    );
  };

  const eliminarAdjuntoExistente = (fileId, setExistentes) => {
    setExistentes(actuales =>
      actuales.filter(archivo => archivo.fileId.toString() !== fileId.toString())
    );
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

  const appendBloqueAdjuntos = ({
    formData,
    campoExistentes,
    campoArchivos,
    existentes,
    nuevos
  }) => {
    formData.append(
      campoExistentes,
      JSON.stringify(existentes.map(archivo => archivo.fileId))
    );

    nuevos.forEach(archivo => {
      formData.append(campoArchivos, archivo);
    });
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

      if (formEdicion.urgente === "Sí") {
        appendBloqueAdjuntos({
          formData: datosEdicion,
          campoExistentes: "archivosUrgenteExistentes",
          campoArchivos: "archivosUrgente",
          existentes: adjuntosUrgenteExistentes,
          nuevos: adjuntosUrgenteNuevos
        });
        appendBloqueAdjuntos({
          formData: datosEdicion,
          campoExistentes: "archivosNoUrgenteExistentes",
          campoArchivos: "archivosNoUrgente",
          existentes: adjuntosNoUrgenteExistentes,
          nuevos: adjuntosNoUrgenteNuevos
        });
      } else {
        appendBloqueAdjuntos({
          formData: datosEdicion,
          campoExistentes: "archivosDescripcionExistentes",
          campoArchivos: "archivosDescripcion",
          existentes: adjuntosDescripcionExistentes,
          nuevos: adjuntosDescripcionNuevos
        });
      }

      const response = await api.put(
        `/api/pedidos/${pedidoAEditar._id}`,
        datosEdicion
      );

      setSolicitudes(solicitudesActuales =>
        solicitudesActuales.map(solicitud =>
          solicitud._id === response.data._id ? response.data : solicitud
        )
      );

      cerrarEdicion();
      mostrarMensaje("Pedido actualizado correctamente");
    } catch (err) {
      console.error("Error editando pedido:", err);
      mostrarError(
        err.response?.data?.error || "No se pudo actualizar el pedido"
      );
    }
  };

  const confirmarEliminacion = async () => {
    try {
      const ruta = user?.rol === "Admin"
        ? `/api/pedidos/admin/${pedidoAEliminar._id}`
        : `/api/pedidos/${pedidoAEliminar._id}`;
      await api.delete(ruta);
      setSolicitudes(solicitudesActuales =>
        solicitudesActuales.filter(solicitud => solicitud._id !== pedidoAEliminar._id)
      );
      setPedidoAEliminar(null);
      mostrarMensaje("Pedido eliminado correctamente");
    } catch (err) {
      console.error("Error eliminando pedido:", err);
      mostrarError(
        err.response?.data?.error || "No se pudo eliminar el pedido"
      );
    }
  };


  const renderAdjuntosEditables = ({
    existentes,
    nuevos,
    setExistentes,
    setNuevos,
    inputRef,
    inputId
  }) => (
    <div className="block-attachments">
      <span className="block-attachments-label">Adjuntos relacionados</span>
      <input
        id={inputId}
        className="visually-hidden-file-input"
        type="file"
        ref={inputRef}
        multiple
        onChange={(event) =>
          agregarAdjuntosEdicion(event, existentes, nuevos, setNuevos)
        }
      />
      <label className="clean-file-picker" htmlFor={inputId}>
        <FontAwesomeIcon icon={faPaperclip} />
        Elegir archivos
      </label>

      {(existentes.length > 0 || nuevos.length > 0) && (
        <div className="edit-attachments-list new-attachments-list">
          {existentes.map(archivo => {
            const url = obtenerUrlAdjunto(archivo);

            return (
              <div className="edit-attachment-item" key={archivo.fileId}>
                <FontAwesomeIcon
                  className="edit-attachment-icon"
                  icon={obtenerIconoArchivo(archivo.tipoMime)}
                />
                <div className="edit-attachment-info">
                  <strong>{archivo.nombre}</strong>
                  <span>{formatearTamanoArchivo(archivo.tamano)}</span>
                </div>
                <div className="edit-attachment-actions">
                  <button
                    type="button"
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                    title="Visualizar adjunto"
                    aria-label={`Visualizar ${archivo.nombre}`}
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`${url}?download=1`, "_blank", "noopener,noreferrer")}
                    title="Descargar adjunto"
                    aria-label={`Descargar ${archivo.nombre}`}
                  >
                    <FontAwesomeIcon icon={faDownload} />
                  </button>
                  <DeleteIconButton
                    label={`Eliminar ${archivo.nombre}`}
                    onClick={() => eliminarAdjuntoExistente(archivo.fileId, setExistentes)}
                  />
                </div>
              </div>
            );
          })}

          {nuevos.map((archivo, indice) => (
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
                <span>{formatearTamanoArchivo(archivo.size)} · Nuevo</span>
              </div>
              <div className="edit-attachment-actions">
                <DeleteIconButton
                  label={`Eliminar ${archivo.name}`}
                  onClick={() => eliminarAdjuntoNuevo(indice, setNuevos)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>Pedidos</h1>
      </div>

      {mensaje && <div className="mensaje-exito">{mensaje}</div>}

      {error && (
        <div className="settings-feedback settings-feedback-error" role="alert">
          {error}
        </div>
      )}

      <div className="page-content">
        {!proyectoSeleccionado ? (
          <section className="projects-view" aria-labelledby="projects-heading">
            <div className="projects-toolbar">
              <label className="projects-search">
                <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
                <span className="sr-only">Buscar proyectos</span>
                <input
                  type="search"
                  placeholder="Buscar proyectos..."
                  value={busquedaProyecto}
                  onChange={(event) => setBusquedaProyecto(event.target.value)}
                />
              </label>
              <div className="projects-filter" role="group" aria-label="Filtrar proyectos">
                {[
                  ["todos", "Todos"],
                  ["pendientes", "Pendientes"],
                  ["completados", "Completados"]
                ].map(([valor, etiqueta]) => (
                  <button
                    type="button"
                    key={valor}
                    className={filtroProyectos === valor ? "is-active" : ""}
                    onClick={() => setFiltroProyectos(valor)}
                    aria-pressed={filtroProyectos === valor}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
              <span className="projects-count" id="projects-heading">
                {proyectos.length} proyectos
              </span>
            </div>

            {proyectosFiltrados.length === 0 ? (
              <div className="projects-empty">
                <h3>No hay proyectos que coincidan</h3>
                <p>Prueba con otra búsqueda o cambia el filtro seleccionado.</p>
              </div>
            ) : (
              <div className="projects-grid">
                {proyectosFiltrados.map(proyecto => (
                  <ProjectOrderCard
                    key={proyecto.nombre}
                    proyecto={proyecto}
                    onOpen={setProyectoSeleccionado}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="project-orders-view" aria-labelledby="project-orders-heading">
            <button
              type="button"
              className="back-to-projects"
              onClick={() => setProyectoSeleccionado(null)}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Todos los proyectos
            </button>
            <div className="project-orders-heading">
              <div>
                <span>Proyecto</span>
                <h2 id="project-orders-heading">{proyectoSeleccionado}</h2>
              </div>
              <span>{pedidosProyectoSeleccionado.length} pedidos</span>
            </div>

          <table className="mis-pedidos-table acciones-centradas-table">
            <thead>
              <tr>
                <th>Solicitante</th>
                <th>Estado</th>
                <th>Comentarios</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {pedidosProyectoSeleccionado.map(solicitud => (
                <tr
                  key={solicitud._id}
                  className="clickable-order-row"
                  tabIndex="0"
                  role="button"
                  aria-label={`Ver detalles del pedido de ${solicitud.proyecto}`}
                  onClick={() => setPedidoDetalleOriginal(solicitud)}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPedidoDetalleOriginal(solicitud);
                    }
                  }}
                >
                  <td>{solicitud.solicitante}</td>
                  <td>
                    <span className={`estado estado-${solicitud.estado.toLowerCase()}`}>
                      {solicitud.estado}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="attachments-summary-button"
                      onClick={event => {
                        event.stopPropagation();
                        setPedidoAdjuntosLectura(solicitud);
                      }}
                      title="Ver comentarios de Compras"
                    >
                      Ver
                    </button>
                  </td>
                  <td>
                    {(puedeEditarPedido(solicitud) || puedeEliminarPedido(solicitud)) && (
                      <div className="mis-pedidos-actions">
                        {puedeEditarPedido(solicitud) && (
                          <button
                            type="button"
                            className="mis-pedidos-action-button mis-pedidos-edit-button"
                            onClick={event => { event.stopPropagation(); abrirEdicion(solicitud); }}
                            title="Editar pedido"
                            aria-label="Editar pedido"
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                        )}
                        {puedeEliminarPedido(solicitud) && (
                          <DeleteIconButton
                            label="Eliminar pedido"
                            onClick={event => { event.stopPropagation(); setPedidoAEliminar(solicitud); }}
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </section>
        )}
      </div>

      {pedidoAdjuntosLectura && (
        <ModalShell onClose={() => setPedidoAdjuntosLectura(null)} className="edit-order-modal" ariaLabel="Comentarios de Compras">
            <h2>Comentarios de Compras</h2>
            <p><strong>Proyecto:</strong> {pedidoAdjuntosLectura.proyecto}</p>

            <div className="compras-info-readonly">
              <div className="compras-info-block">
                <strong>Comentario:</strong>
                <p>{pedidoAdjuntosLectura.comentarioCompras || "Sin comentario de Compras"}</p>
              </div>
              <div className="compras-info-block">
                <strong>Archivos:</strong>
                <AttachmentList
                  pedido={pedidoAdjuntosLectura}
                  archivos={pedidoAdjuntosLectura.adjuntosCompras || []}
                />
              </div>
            </div>

        </ModalShell>
      )}

      <OriginalRequestModal
        pedido={pedidoDetalleOriginal}
        onClose={() => setPedidoDetalleOriginal(null)}
      />
      {pedidoAEditar && (
        <ModalShell onClose={cerrarEdicion} className="edit-order-modal" ariaLabel="Editar pedido">
            <h2>Editar pedido</h2>

            <form className="edit-order-form" onSubmit={guardarEdicion}>
              <div className="edit-order-card">
                <div className="edit-order-section">
                  <label>Proyecto</label>
                  <ProjectSelector
                    value={formEdicion.proyecto}
                    onChange={(valor) => actualizarCampoEdicion("proyecto", valor)}
                    inputId="editar-proyecto"
                  />
                </div>

                <div className="edit-order-section">
                  <label>Tipo de solicitud</label>
                  <div className="edit-priority-segment edit-request-type-segment" role="group" aria-label="Tipo de solicitud">
                    <label>
                      <input
                        type="radio"
                        name="editarUrgente"
                        value="Sí"
                        checked={formEdicion.urgente === "Sí"}
                        onChange={(event) => actualizarCampoEdicion("urgente", event.target.value)}
                      />
                      <span>Urgente</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="editarUrgente"
                        value="No"
                        checked={formEdicion.urgente === "No"}
                        onChange={(event) => actualizarCampoEdicion("urgente", event.target.value)}
                      />
                      <span>Normal</span>
                    </label>
                  </div>
                </div>

                <div className="edit-order-section edit-order-descriptions">
                  {formEdicion.urgente === "Sí" ? (
                    <>
                      <div className="edit-order-field-block request-block-card request-block-urgent edit-urgent-block">
                        <label>Urgente</label>
                        <textarea
                          value={formEdicion.motivoUrgencia}
                          placeholder="Elementos urgentes"
                          onChange={(event) => actualizarCampoEdicion("motivoUrgencia", event.target.value)}
                        />
                        {renderAdjuntosEditables({
                          existentes: adjuntosUrgenteExistentes,
                          nuevos: adjuntosUrgenteNuevos,
                          setExistentes: setAdjuntosUrgenteExistentes,
                          setNuevos: setAdjuntosUrgenteNuevos,
                          inputRef: urgenteInputRef,
                          inputId: "editar-archivos-urgente"
                        })}
                      </div>

                      <div className="edit-order-field-block request-block-card">
                        <label>No urgente</label>
                        <textarea
                          value={formEdicion.descripcion}
                          placeholder="Elementos no urgentes"
                          onChange={(event) => actualizarCampoEdicion("descripcion", event.target.value)}
                        />
                        {renderAdjuntosEditables({
                          existentes: adjuntosNoUrgenteExistentes,
                          nuevos: adjuntosNoUrgenteNuevos,
                          setExistentes: setAdjuntosNoUrgenteExistentes,
                          setNuevos: setAdjuntosNoUrgenteNuevos,
                          inputRef: noUrgenteInputRef,
                          inputId: "editar-archivos-no-urgente"
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="edit-order-field-block request-block-card">
                      <label>Descripción</label>
                      <textarea
                        value={formEdicion.descripcion}
                        placeholder="Elementos solicitados"
                        onChange={(event) => actualizarCampoEdicion("descripcion", event.target.value)}
                      />
                      {renderAdjuntosEditables({
                        existentes: adjuntosDescripcionExistentes,
                        nuevos: adjuntosDescripcionNuevos,
                        setExistentes: setAdjuntosDescripcionExistentes,
                        setNuevos: setAdjuntosDescripcionNuevos,
                        inputRef: descripcionInputRef,
                        inputId: "editar-archivos-descripcion"
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-buttons edit-order-actions">
                <button type="submit">Guardar cambios</button>
              </div>
            </form>
        </ModalShell>
      )}

      {pedidoAEliminar && (
        <ModalShell onClose={() => setPedidoAEliminar(null)} ariaLabel="Eliminar pedido">
            <h2>Eliminar pedido</h2>
            <p>¿Seguro que quieres eliminar este pedido?</p>
            <p><strong>Proyecto:</strong> {pedidoAEliminar.proyecto}</p>

            <div className="modal-buttons">
              <button type="button" onClick={() => setPedidoAEliminar(null)}>Cancelar</button>
              <button type="button" className="button-danger" onClick={confirmarEliminacion}>
                Eliminar
              </button>
            </div>
        </ModalShell>
      )}
    </Layout>
  );
}

export default MisSolicitudes;



