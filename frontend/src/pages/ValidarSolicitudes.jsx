import { useContext, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus, faClipboardList, faFile, faPaperclip } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import AttachmentList, {
  formatearTamanoArchivo,
  obtenerIconoArchivo
} from "../components/AttachmentList";
import DeleteIconButton from "../components/DeleteIconButton";
import { AuthContext } from "../context/AuthContext";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { UsuariosContext } from "../context/UsuariosContext";
import api from "../api";
import { Navigate } from "react-router-dom";

function ValidarSolicitudes() {
  const { user } = useContext(AuthContext);
  const { solicitudes, setSolicitudes } = useContext(SolicitudesContext);
  const { usuarios } = useContext(UsuariosContext);

  const [filtroEstado, setFiltroEstado] = useState("Todas");
  const [busquedaProyecto, setBusquedaProyecto] = useState("");
  const [pedidoAArchivar, setPedidoAArchivar] = useState(null);
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [pedidoInfoCompras, setPedidoInfoCompras] = useState(null);
  const [comentarioCompras, setComentarioCompras] = useState("");
  const [adjuntosComprasNuevos, setAdjuntosComprasNuevos] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const archivoComprasInputRef = useRef(null);

  useEffect(() => {
    if (!["Admin", "Comprador"].includes(user?.rol)) {
      return;
    }

    const cargarProyectos = async () => {
      try {
        const response = await api.get("/api/proyectos");

        setProyectos(
          Array.isArray(response.data)
            ? response.data
            : response.data.value || []
        );
      } catch (error) {
        console.error("Error cargando proyectos:", error);
      }
    };

    cargarProyectos();
  }, [user?.rol]);

  const obtenerProyectoCompleto = (codigoProyecto) => {
    const proyectoEncontrado = proyectos.find(
      proyectoItem => proyectoItem.nomProyecto === codigoProyecto
    );

    if (!proyectoEncontrado?.descProyecto) {
      return codigoProyecto;
    }

    return `${codigoProyecto} - ${proyectoEncontrado.descProyecto}`;
  };

  if (!["Admin", "Comprador"].includes(user?.rol)) {
    return <Navigate to="/nuevasolicitud" replace />;
  }

  const compradores = usuarios.filter(usuario => usuario.rol === "Comprador");
  const esAdmin = user?.rol === "Admin";

  const refrescarPedidoEnListado = (pedidoActualizado) => {
    setSolicitudes(solicitudesActuales =>
      solicitudesActuales.map(solicitud =>
        solicitud._id === pedidoActualizado._id
          ? pedidoActualizado
          : solicitud
      )
    );

    setPedidoInfoCompras(actual =>
      actual?._id === pedidoActualizado._id ? pedidoActualizado : actual
    );

    setPedidoSeleccionado(actual =>
      actual?._id === pedidoActualizado._id ? pedidoActualizado : actual
    );
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.put(`/api/pedidos/${id}`, { estado: nuevoEstado });
      const response = await api.get("/api/pedidos");
      setSolicitudes(response.data);
    } catch (error) {
      console.error("Error cambiando estado:", error);
    }
  };

  const confirmarArchivo = () => {
    cambiarEstado(pedidoAArchivar._id, "Archivar");
    setPedidoAArchivar(null);
  };

  const asignarComprador = async (id, comprador) => {
    try {
      await api.put(`/api/pedidos/${id}`, { compradorAsignado: comprador });
      const response = await api.get("/api/pedidos");
      setSolicitudes(response.data);
    } catch (error) {
      console.error("Error asignando comprador:", error);
    }
  };
  const confirmarEliminacionAdmin = async () => {
    if (!pedidoAEliminar) {
      return;
    }

    try {
      await api.delete(`/api/pedidos/admin/${pedidoAEliminar._id}`);
      setSolicitudes(solicitudesActuales =>
        solicitudesActuales.filter(solicitud => solicitud._id !== pedidoAEliminar._id)
      );
      setPedidoAEliminar(null);
      setMensaje("Pedido eliminado correctamente");
      setTimeout(() => setMensaje(""), 3000);
    } catch (error) {
      console.error("Error eliminando pedido:", error);
    }
  };

  const cerrarInfoCompras = () => {
    setPedidoInfoCompras(null);
    setComentarioCompras("");
    setAdjuntosComprasNuevos([]);

    if (archivoComprasInputRef.current) {
      archivoComprasInputRef.current.value = "";
    }
  };

  const abrirDetallePedido = (pedido) => {
    setPedidoSeleccionado(pedido);
    setPedidoInfoCompras(pedido);
    setComentarioCompras(pedido.comentarioCompras || "");
    setAdjuntosComprasNuevos([]);

    if (archivoComprasInputRef.current) {
      archivoComprasInputRef.current.value = "";
    }
  };

  const cerrarDetallePedido = () => {
    setPedidoSeleccionado(null);
    cerrarInfoCompras();
  };

  const obtenerClaveArchivo = (archivo) =>
    `${archivo.nombre || archivo.name}-${archivo.tamano || archivo.size}-${archivo.tipoMime || archivo.type}`;

  const agregarAdjuntosCompras = (event) => {
    const archivosSeleccionados = Array.from(event.target.files || []);
    const clavesExistentes = new Set([
      ...(pedidoInfoCompras?.adjuntosCompras || []).map(obtenerClaveArchivo),
      ...adjuntosComprasNuevos.map(obtenerClaveArchivo)
    ]);

    const nuevosSinDuplicar = archivosSeleccionados.filter(archivo => {
      const clave = obtenerClaveArchivo(archivo);

      if (clavesExistentes.has(clave)) {
        return false;
      }

      clavesExistentes.add(clave);
      return true;
    });

    setAdjuntosComprasNuevos(actuales => [...actuales, ...nuevosSinDuplicar]);
    event.target.value = "";
  };

  const eliminarAdjuntoNuevoCompras = (indice) => {
    setAdjuntosComprasNuevos(actuales =>
      actuales.filter((_, indiceActual) => indiceActual !== indice)
    );
  };

  const guardarInfoCompras = async (adjuntosConservados) => {
    if (!pedidoInfoCompras) {
      return;
    }

    const datosInfoCompras = new FormData();
    datosInfoCompras.append("comentarioCompras", comentarioCompras);
    datosInfoCompras.append(
      "adjuntosComprasExistentes",
      JSON.stringify(adjuntosConservados.map(archivo => archivo.fileId))
    );

    adjuntosComprasNuevos.forEach(archivo => {
      datosInfoCompras.append("archivos", archivo);
    });

    const response = await api.put(
      `/api/pedidos/${pedidoInfoCompras._id}`,
      datosInfoCompras
    );

    refrescarPedidoEnListado(response.data);
    setPedidoSeleccionado(response.data);
    setPedidoInfoCompras(response.data);
    setAdjuntosComprasNuevos([]);

    if (archivoComprasInputRef.current) {
      archivoComprasInputRef.current.value = "";
    }

    setMensaje("Adjuntado con éxito");
    setTimeout(() => setMensaje(""), 3000);
  };

  const guardarInformacionCompras = async () => {
    if (!pedidoInfoCompras) {
      return;
    }

    try {
      await guardarInfoCompras(pedidoInfoCompras.adjuntosCompras || []);
    } catch (error) {
      console.error("Error guardando información de Compras:", error);
    }
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

  const renderBloqueDetalle = ({ titulo, texto, archivos, pedido }) => (
    <div className="compras-info-readonly">
      <h3>{titulo}</h3>
      <div className="compras-info-block">
        <p>{texto || "Sin contenido"}</p>
      </div>
      <div className="compras-info-block">
        <strong>Archivos:</strong>
        <AttachmentList pedido={pedido} archivos={archivos} />
      </div>
    </div>
  );
  const solicitudesVisibles = solicitudes
    .filter(solicitud =>
      filtroEstado === "Todas" || solicitud.estado === filtroEstado
    )
    .filter(solicitud =>
      (solicitud.proyecto || "")
        .toLowerCase()
        .includes(busquedaProyecto.toLowerCase())
    );

  return (
    <Layout>
      <div className="page-header">
        <h1>Gestión de Pedidos</h1>
      </div>

      {mensaje && (
        <div className="mensaje-exito">
          {mensaje}
        </div>
      )}

      <div className="page-content">
        <div className="barra-busqueda">
          <label>Buscar por proyecto:</label>
          <input
            type="search"
            placeholder="Buscar proyecto..."
            value={busquedaProyecto}
            onChange={(event) => setBusquedaProyecto(event.target.value)}
          />
        </div>

        <label>Filtrar por estado:</label>
        <select
          value={filtroEstado}
          onChange={(event) => setFiltroEstado(event.target.value)}
        >
          <option>Todas</option>
          <option>Pendiente</option>
          <option>Pedido</option>
          <option>Archivar</option>
        </select>

        <br />
        <br />

        <table className="gestion-pedidos-table">
          <colgroup>
            <col className="gestion-col-solicitante" />
            <col className="gestion-col-proyecto" />
            <col className="gestion-col-comprador" />
            <col className="gestion-col-estado" />
            {esAdmin && <col className="gestion-col-eliminar" />}
          </colgroup>
          <thead>
            <tr>
              <th>Solicitante</th>
              <th>Proyecto</th>
              <th>Comprador</th>
              <th>Estado</th>
              {esAdmin && <th>Eliminar</th>}
            </tr>
          </thead>

          <tbody>
            {solicitudesVisibles.map(solicitud => (
              <tr key={solicitud._id} className="clickable-order-row" onClick={() => abrirDetallePedido(solicitud)}>
                <td>{solicitud.solicitante}</td>
                <td className="gestion-project-cell">
                  <span
                    title={obtenerProyectoCompleto(solicitud.proyecto)}
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {solicitud.proyecto}
                  </span>
                </td>
                <td>
                  <select
                    value={solicitud.compradorAsignado}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      asignarComprador(solicitud._id, event.target.value)
                    }
                  >
                    <option value="">Sin asignar</option>
                    {compradores.map(comprador => (
                      <option key={comprador._id} value={comprador.nombre}>
                        {comprador.nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={`estado estado-select estado-${solicitud.estado.toLowerCase()}`}
                    value={solicitud.estado}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const nuevoEstado = event.target.value;

                      if (nuevoEstado === "Archivar") {
                        setPedidoAArchivar(solicitud);
                        return;
                      }

                      cambiarEstado(solicitud._id, nuevoEstado);
                    }}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Pedido">Pedido</option>
                    <option value="Archivar">Archivar</option>
                  </select>
                </td>
                {esAdmin && (
                  <td className="admin-delete-cell">
                    <DeleteIconButton
                      label="Eliminar pedido"
                      onClick={(event) => { event.stopPropagation(); setPedidoAEliminar(solicitud); }}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pedidoAArchivar && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Archivar pedido</h2>
            <p>¿Desea archivar este pedido?</p>

            <div className="modal-buttons">
              <button onClick={() => setPedidoAArchivar(null)}>
                Cancelar
              </button>
              <button onClick={confirmarArchivo}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {pedidoAEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Eliminar pedido</h2>
            <p>¿Deseas eliminar este pedido?</p>
            <p>Esta acción eliminará también sus archivos asociados.</p>
            <p>
              <strong>Proyecto:</strong>{" "}
              {obtenerProyectoCompleto(pedidoAEliminar.proyecto)}
            </p>

            <div className="modal-buttons">
              <button type="button" onClick={() => setPedidoAEliminar(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={confirmarEliminacionAdmin}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {pedidoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal order-detail-modal">
            <h2>Detalles del pedido</h2>

            <div className="order-detail-meta">
              <div>
                <span>Proyecto</span>
                <strong>{obtenerProyectoCompleto(pedidoSeleccionado.proyecto)}</strong>
              </div>
              <div>
                <span>Solicitante</span>
                <strong>{pedidoSeleccionado.solicitante}</strong>
              </div>
              <div>
                <span>Comprador</span>
                <strong>{pedidoSeleccionado.compradorAsignado || "Sin asignar"}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{pedidoSeleccionado.estado}</strong>
              </div>
            </div>

            <div className="profile-info-grid">
              <section className="profile-info-panel obra-panel">
                <div className="profile-panel-header">
                  <span className="profile-panel-icon"><FontAwesomeIcon icon={faClipboardList} /></span>
                  <div>
                    <h3>Información del solicitante</h3>
                    <p>Solicitud original y documentación asociada.</p>
                  </div>
                </div>

                {pedidoSeleccionado.urgente ? (
                  <>
                    {renderBloqueDetalle({
                      titulo: "Urgente",
                      texto: pedidoSeleccionado.motivoUrgencia,
                      archivos: obtenerAdjuntosUrgente(pedidoSeleccionado),
                      pedido: pedidoSeleccionado
                    })}
                    {renderBloqueDetalle({
                      titulo: "No urgente",
                      texto: pedidoSeleccionado.descripcion,
                      archivos: obtenerAdjuntosNoUrgente(pedidoSeleccionado),
                      pedido: pedidoSeleccionado
                    })}
                  </>
                ) : (
                  renderBloqueDetalle({
                    titulo: "Descripción",
                    texto: pedidoSeleccionado.descripcion,
                    archivos: obtenerAdjuntosDescripcion(pedidoSeleccionado),
                    pedido: pedidoSeleccionado
                  })
                )}
              </section>

              <section className="profile-info-panel compras-panel">
                <div className="profile-panel-header">
                  <span className="profile-panel-icon"><FontAwesomeIcon icon={faCirclePlus} /></span>
                  <div>
                    <h3>Añadir información</h3>
                    <p>Comentario y archivos que verá el solicitante.</p>
                  </div>
                </div>

                <div className="edit-order-section compras-info-section">
                  <label>Comentario para el solicitante</label>
                  <textarea
                    value={comentarioCompras}
                    placeholder="Escribe la información que verá el solicitante"
                    onChange={(event) => setComentarioCompras(event.target.value)}
                  />
                </div>

                <div className="compras-info-block">
                  <strong>Archivos actuales de Compras:</strong>
                  {(pedidoInfoCompras?.adjuntosCompras || pedidoSeleccionado.adjuntosCompras || []).length > 0 ? (
                    <AttachmentList
                      pedido={pedidoSeleccionado}
                      archivos={pedidoInfoCompras?.adjuntosCompras || pedidoSeleccionado.adjuntosCompras || []}
                    />
                  ) : (
                    <div className="edit-attachments-empty">Sin archivos adjuntos de Compras</div>
                  )}
                </div>

                <div className="edit-order-section compras-info-section">
                  <span className="block-attachments-label">Añadir archivos de Compras</span>
                  <input
                    id="compras-detail-files"
                    className="visually-hidden-file-input"
                    type="file"
                    ref={archivoComprasInputRef}
                    multiple
                    onChange={agregarAdjuntosCompras}
                  />
                  <label className="clean-file-picker" htmlFor="compras-detail-files">
                    <FontAwesomeIcon icon={faPaperclip} />
                    Elegir archivos
                  </label>

                  {adjuntosComprasNuevos.length > 0 && (
                    <div className="edit-attachments-list new-attachments-list">
                      {adjuntosComprasNuevos.map((archivo, indice) => (
                        <div
                          className="edit-attachment-item"
                          key={`${archivo.name}-${archivo.size}-${archivo.lastModified}`}
                        >
                          <FontAwesomeIcon
                            className="edit-attachment-icon"
                            icon={obtenerIconoArchivo(archivo.type) || faFile}
                          />
                          <div className="edit-attachment-info">
                            <strong>{archivo.name}</strong>
                            <span>{formatearTamanoArchivo(archivo.size)} · Nuevo</span>
                          </div>
                          <div className="edit-attachment-actions">
                            <DeleteIconButton
                              label={`Eliminar ${archivo.name}`}
                              onClick={() => eliminarAdjuntoNuevoCompras(indice)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-buttons edit-order-actions compras-detail-actions">
                  <button
                    type="button"
                    onClick={guardarInformacionCompras}
                    disabled={
                      adjuntosComprasNuevos.length === 0 &&
                      comentarioCompras === ((pedidoInfoCompras || pedidoSeleccionado).comentarioCompras || "")
                    }
                  >
                    Guardar información de Compras
                  </button>
                </div>
              </section>
            </div>

            <div className="modal-buttons order-detail-sticky-footer">
              <button type="button" onClick={cerrarDetallePedido}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default ValidarSolicitudes;









