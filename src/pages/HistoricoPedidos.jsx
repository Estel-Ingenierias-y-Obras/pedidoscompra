import { useContext } from "react";
import Layout from "../components/Layout";
import { SolicitudesContext } from "../context/SolicitudesContext";

function HistoricoPedidos() {

  const { solicitudes } =
    useContext(SolicitudesContext);

  return (
    <Layout>

      <div className="page-header">
        <h1>Histórico de Pedidos</h1>
      </div>

      <div className="page-content">

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Solicitante</th>
              <th>Proyecto</th>
              <th>Comprador</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>

            {solicitudes
              .filter(
                solicitud =>
                  solicitud.estado === "Entregado"
              )
              .map(solicitud => (

                <tr key={solicitud._id}>
                  <td>{solicitud._id.slice(-6)}</td>
                  <td>{solicitud.solicitante}</td>
                  <td>{solicitud.proyecto}</td>
                  <td>{solicitud.compradorAsignado}</td>
                  <td>{solicitud.estado}</td>
                </tr>

            ))}

          </tbody>
        </table>

      </div>

    </Layout>
  );
}

export default HistoricoPedidos;