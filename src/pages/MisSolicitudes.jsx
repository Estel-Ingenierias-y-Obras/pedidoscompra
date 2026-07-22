import { useContext, useState } from "react";
import Layout from "../components/Layout";
import { SolicitudesContext }
from "../context/SolicitudesContext";
import { AuthContext } from "../context/AuthContext";
import axios from "axios";


function MisSolicitudes() {

  const {
  solicitudes,
  setSolicitudes
} = useContext(SolicitudesContext);

const { user } = useContext(AuthContext);

const [mensaje, setMensaje] = useState("");

const [busquedaProyecto, setBusquedaProyecto] =
  useState("");

const [pedidoAEliminar, setPedidoAEliminar] =
  useState(null);

  const misPedidos =
  solicitudes.filter(
    solicitud =>
      solicitud.email === user.email
  );

  const misPedidosFiltrados =
  misPedidos.filter(solicitud =>
    (solicitud.proyecto || "")
      .toLowerCase()
      .includes(busquedaProyecto.toLowerCase())
  );


const confirmarEliminacion = async () => {

  try {

    await axios.delete(
      `http://localhost:5000/api/pedidos/${pedidoAEliminar._id}`
    );

    const solicitudesFiltradas =
      solicitudes.filter(
        solicitud =>
          solicitud._id !== pedidoAEliminar._id
      );

    setSolicitudes(solicitudesFiltradas);

    setPedidoAEliminar(null);

    setMensaje(
      "Pedido eliminado correctamente"
    );

    setTimeout(() => {
      setMensaje("");
    }, 3000);

  } catch (error) {

    console.error(
      "Error eliminando pedido:",
      error
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

    <div className="page-content">
      <div className="barra-busqueda">
        <label>Buscar por proyecto:</label>
        <input
          type="search"
          placeholder="Buscar proyecto..."
          value={busquedaProyecto}
          onChange={(e) =>
            setBusquedaProyecto(e.target.value)
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
                <button
                  onClick={() =>
                    setPedidoAEliminar(solicitud)
                   }
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}

        </tbody>
        </table>
      )}
    </div>

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
          onClick={() =>
            setPedidoAEliminar(null)
          }
        >
          Cancelar
        </button>

        <button
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
