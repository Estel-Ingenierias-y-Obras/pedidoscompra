import { useContext } from "react";
import Layout from "../components/Layout";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { UsuariosContext } from "../context/UsuariosContext";
import { useState } from "react";
import api from "../api";

function ValidarSolicitudes() {

  const {
    solicitudes,
    setSolicitudes
  } = useContext(SolicitudesContext);

  const { usuarios } = useContext(UsuariosContext);

  const [filtroEstado, setFiltroEstado] =
  useState("Todas");

  const [busquedaProyecto, setBusquedaProyecto] =
  useState("");

  const [pedidoAEntregar, setPedidoAEntregar] =
  useState(null);

  const [pedidoSeleccionado, setPedidoSeleccionado] =
  useState(null);

  const compradores = usuarios.filter(
    usuario => usuario.rol === "Comprador"
  );

  const cambiarEstado = async (
  id,
  nuevoEstado
) => {

  try {

    await api.put(
      `/api/pedidos/${id}`,
      {
        estado: nuevoEstado
      }
    );

    const response =
      await api.get(
        "/api/pedidos"
      );

    setSolicitudes(response.data);

  } catch (error) {

    console.error(
      "Error cambiando estado:",
      error
    );

  }

};

const confirmarEntrega = () => {

  cambiarEstado(
    pedidoAEntregar._id,
    "Entregado"
  );

  setPedidoAEntregar(null);
};

const asignarComprador = async (
  id,
  comprador
) => {

  try {

    await api.put(
      `/api/pedidos/${id}`,
      {
        compradorAsignado: comprador
      }
    );

    const response =
      await api.get(
        "/api/pedidos"
      );

    setSolicitudes(response.data);

  } catch (error) {

    console.error(
      "Error asignando comprador:",
      error
    );

  }

};

  return (
    <Layout>

      <div className="page-header">
        <h1>Gestión de Pedidos</h1>
      </div>

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

        <label>Filtrar por estado:</label>

<select
  value={filtroEstado}
  onChange={(e) =>
    setFiltroEstado(e.target.value)
  }
>
  <option>Todas</option>
  <option>Pendiente</option>
  <option>Pedido</option>
  <option>Recibido</option>
  <option>Entregado</option>
</select>

<br />
<br />

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Solicitante</th>
            <th>Proyecto</th>
            <th>Comprador</th>
            <th>Estado</th>
            <th>Detalles</th>
          </tr>
        </thead>

        <tbody>



          {solicitudes
            .filter(
              solicitud =>
                solicitud.estado !== "Entregado"
            )

.filter(solicitud => {

  if (filtroEstado === "Todas") {
    return true;
  }

return (
solicitud.estado ===
filtroEstado
);
})
  .filter(solicitud =>
    (solicitud.proyecto || "")
      .toLowerCase()
      .includes(busquedaProyecto.toLowerCase())
  )
  .map(solicitud => (
            <tr key={solicitud._id}>
              <td>{solicitud._id.slice(-6)}</td>
              <td>{solicitud.solicitante}</td>
              <td>{solicitud.proyecto}</td>
              <td>
  <select
    value={solicitud.compradorAsignado}
    onChange={(e) =>
      asignarComprador(
        solicitud._id,
        e.target.value
      )
    }
  >
    <option value="">
      Sin asignar
    </option>

    {compradores.map(comprador => (
      <option
        key={comprador._id}
        value={comprador.nombre}
      >
        {comprador.nombre}
      </option>
    ))}
  </select>
</td>
              <td>
  <select
  className={`estado estado-select estado-${solicitud.estado.toLowerCase()}`}
  value={solicitud.estado}
  onChange={(e) => {

    const nuevoEstado =
      e.target.value;

    if (nuevoEstado === "Entregado") {

      setPedidoAEntregar(
        solicitud
      );

      return;
    }

    cambiarEstado(
      solicitud._id,
      nuevoEstado
    );
  }}
>
    <option value="Pendiente">
      Pendiente
    </option>

    <option value="Pedido">
      Pedido
    </option>

    <option value="Recibido">
      Recibido
    </option>

    <option value="Entregado">
      Entregado
    </option>

  </select>
</td>

<td>
  <button
    onClick={() =>
      setPedidoSeleccionado(
        solicitud)
    }
  >
    👁 Ver
  </button>
</td>

            </tr>
          ))}

        </tbody>
        </table>
      </div>

       {pedidoAEntregar && (

  <div className="modal-overlay">

    <div className="modal">

      <h2>Marcar pedido como entregado</h2>

      <p>
        ¿Desea marcar este pedido como entregado?
      </p>

      <div className="modal-buttons">

        <button
          onClick={() =>
            setPedidoAEntregar(null)
          }
        >
          Cancelar
        </button>

        <button
          onClick={confirmarEntrega}
        >
          Confirmar
        </button>

      </div>

    </div>

  </div>

)} 

{pedidoSeleccionado && (

  <div className="modal-overlay">

    <div className="modal">

      <h2>Detalles del pedido</h2>

      <p>
        <strong>Proyecto:</strong>{" "}
        {pedidoSeleccionado.proyecto}
      </p>

      <p>
        <strong>Solicitante:</strong>{" "}
        {pedidoSeleccionado.solicitante}
      </p>

      <p>
        <strong>Comprador:</strong>{" "}
        {pedidoSeleccionado.compradorAsignado ||
          "Sin asignar"}
      </p>

      <p>
        <strong>Estado:</strong>{" "}
        {pedidoSeleccionado.estado}
      </p>

      <p>
        <strong>Urgente:</strong>{" "}
        {pedidoSeleccionado.urgente}
      </p>

      <p>
        <strong>Descripción:</strong>
      </p>

      <div className="descripcion-pedido">
        {pedidoSeleccionado.descripcion}
      </div>

      <p>
        <strong>Archivo:</strong>{" "}
        {pedidoSeleccionado.archivo
          ? "Adjunto disponible"
          : "Sin archivo"}
      </p>

      <div className="modal-buttons">

        <button
          onClick={() =>
            setPedidoSeleccionado(null)
          }
        >
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
