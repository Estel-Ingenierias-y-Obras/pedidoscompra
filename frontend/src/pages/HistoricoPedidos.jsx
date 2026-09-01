import { useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import ModalShell from "../components/ModalShell";

function HistoricoPedidos() {
  const { user } = useContext(AuthContext);
  const { solicitudes, setSolicitudes } =
    useContext(SolicitudesContext);
  const [pedidoARecuperar, setPedidoARecuperar] = useState(null);
  const [mensaje, setMensaje] = useState("");

  if (!["Admin", "Comprador"].includes(user?.rol)) {
    return <Navigate to="/nuevasolicitud" replace />;
  }

  const pedidosArchivados = solicitudes.filter(
    solicitud => solicitud.estado === "Archivar"
  );

  const confirmarRecuperacion = async () => {
    if (!pedidoARecuperar) {
      return;
    }

    try {
      const response = await api.put(
        `/api/pedidos/${pedidoARecuperar._id}`,
        { estado: "Pendiente" }
      );

      setSolicitudes(solicitudesActuales =>
        solicitudesActuales.map(solicitud =>
          solicitud._id === response.data._id
            ? response.data
            : solicitud
        )
      );
      setPedidoARecuperar(null);
      setMensaje(
        "Pedido recuperado y devuelto a Gestión de Pedidos"
      );

      setTimeout(() => setMensaje(""), 3000);
    } catch (error) {
      console.error("Error recuperando pedido histórico:", error);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Histórico de Pedidos</h1>
      </div>

      {mensaje && (
        <div className="mensaje-exito">
          {mensaje}
        </div>
      )}

      <div className="page-content">
        {pedidosArchivados.length === 0 ? (
          <div className="empty-state">
            No hay pedidos en el histórico.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Solicitante</th>
                <th>Proyecto</th>
                <th>Comprador</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidosArchivados.map(solicitud => (
                <tr key={solicitud._id}>
                  <td>{solicitud._id.slice(-6)}</td>
                  <td>{solicitud.solicitante}</td>
                  <td>{solicitud.proyecto}</td>
                  <td>
                    {solicitud.compradorAsignado || "Sin asignar"}
                  </td>
                  <td>
                    <span className="estado estado-archivar">
                      {solicitud.estado}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setPedidoARecuperar(solicitud)}
                    >
                      Recuperar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pedidoARecuperar && (
        <ModalShell onClose={() => setPedidoARecuperar(null)} ariaLabel="Recuperar pedido">
            <h2>Recuperar pedido</h2>
            <p>
              El pedido volverá a Gestión de Pedidos con estado
              <strong> Pendiente</strong>.
            </p>
            <p>
              <strong>Proyecto:</strong>{" "}
              {pedidoARecuperar.proyecto}
            </p>

            <div className="modal-buttons">
              <button
                type="button"
                onClick={() => setPedidoARecuperar(null)}
              >
                Cancelar
              </button>
              <button type="button" onClick={confirmarRecuperacion}>
                Recuperar pedido
              </button>
            </div>
        </ModalShell>
      )}
    </Layout>
  );
}

export default HistoricoPedidos;
