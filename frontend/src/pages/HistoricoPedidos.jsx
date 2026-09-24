import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import MisSolicitudes from "./MisSolicitudes";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import ModalShell from "../components/ModalShell";
import NotificationToast from "../components/NotificationToast";

function HistoricoPedidos() {
  const { user } = useContext(AuthContext);
  const { setSolicitudes } = useContext(SolicitudesContext);
  const [archivados, setArchivados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pedidoARecuperar, setPedidoARecuperar] = useState(null);
  const [recuperando, setRecuperando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!["Admin", "Comprador", "Encargado"].includes(user?.rol)) return;
    let vigente = true;
    setCargando(true);
    setError("");
    api.get("/api/pedidos", { params: { estado: "Archivar" } })
      .then(response => { if (vigente) setArchivados(response.data); })
      .catch(() => { if (vigente) setError("No se pudo cargar el histórico de pedidos"); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [user]);

  if (!["Admin", "Comprador", "Encargado"].includes(user?.rol)) {
    return <Navigate to="/nuevasolicitud" replace />;
  }

  const confirmarRecuperacion = async () => {
    if (!pedidoARecuperar || recuperando || !["Admin", "Comprador"].includes(user?.rol)) return;
    setRecuperando(true);
    try {
      const response = await api.put(`/api/pedidos/${pedidoARecuperar._id}`, { estado: "Pendiente" });
      setSolicitudes(actuales => [
        ...actuales.filter(pedido => pedido._id !== response.data._id),
        response.data
      ]);
      setArchivados(actuales => actuales.filter(pedido => pedido._id !== response.data._id));
      setPedidoARecuperar(null);
      setError("");
      setMensaje("Pedido recuperado y devuelto a Gestión de Pedidos");
    } catch (error) {
      setError("No se pudo recuperar el pedido");
    } finally {
      setRecuperando(false);
    }
  };

  return (
    <>
      <SolicitudesContext.Provider value={{ solicitudes: archivados, setSolicitudes: setArchivados }}>
        <MisSolicitudes historico onRecuperar={["Admin", "Comprador"].includes(user?.rol) ? setPedidoARecuperar : undefined} cargando={cargando} errorCarga={error} />
      </SolicitudesContext.Provider>
      <NotificationToast message={error || mensaje} type={error ? "error" : "exito"} onClose={() => { setError(""); setMensaje(""); }} />
      {pedidoARecuperar && (
        <ModalShell onClose={() => setPedidoARecuperar(null)} ariaLabel="Recuperar pedido">
          <h2>Recuperar pedido</h2>
          <p>El pedido volverá a Gestión de Pedidos con estado <strong>Pendiente</strong>.</p>
          <p><strong>Proyecto:</strong> {pedidoARecuperar.proyecto}</p>
          <div className="modal-buttons">
            <button type="button" onClick={() => setPedidoARecuperar(null)}>Cancelar</button>
            <button type="button" disabled={recuperando} onClick={confirmarRecuperacion}>Recuperar pedido</button>
          </div>
        </ModalShell>
      )}
    </>
  );
}

export default HistoricoPedidos;
