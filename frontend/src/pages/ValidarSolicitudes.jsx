import { useContext, useEffect } from "react";
import Layout from "../components/Layout";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { UsuariosContext } from "../context/UsuariosContext";
import { useState } from "react";
import api from "../api";

function AdjuntosPedido({ pedido }) {
  const archivos = Array.isArray(pedido?.archivos)
    ? pedido.archivos
    : [];

  if (archivos.length === 0) {
    return <span>Sin archivos adjuntos</span>;
  }
//hola
  return (
    <div>
      {archivos.map(archivo => {
        const ruta =
          `/api/pedidos/${pedido._id}/archivos/${archivo.fileId}`;
        const url = `${api.defaults.baseURL || ""}${ruta}`;

        return (
          <div
            key={archivo.fileId}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid #e0e0e0"
            }}
          >
            <div>
              📎 <strong>{archivo.nombre}</strong>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px"
              }}
            >
              <button
                type="button"
                onClick={() =>
                  window.open(
                    url,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                Abrir
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
              >
                Descargar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
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

  const [proyectos, setProyectos] = useState([]);

  useEffect(() => {
    const cargarProyectos = async () => {
      try {
        const response = await api.get("/api/proyectos");

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

  const obtenerProyectoCompleto = (codigoProyecto) => {
    const proyectoEncontrado = proyectos.find(
      proyectoItem =>
        proyectoItem.nomProyecto === codigoProyecto
    );

    if (!proyectoEncontrado?.descProyecto) {
      return codigoProyecto;
    }

    return `${codigoProyecto} - ${proyectoEncontrado.descProyecto}`;
  };

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
              <td style={{ maxWidth: "280px" }}>
                <span
                  title={obtenerProyectoCompleto(
                    solicitud.proyecto
                  )}
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

    <div
      className="modal"
      style={{
        width: "min(90vw, 760px)",
        maxWidth: "760px",
        maxHeight: "85vh",
        overflowY: "auto"
      }}
    >

      <h2>Detalles del pedido</h2>

      <p>
        <strong>Proyecto:</strong>{" "}
        {obtenerProyectoCompleto(
          pedidoSeleccionado.proyecto
        )}
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

      {pedidoSeleccionado.urgente ? (
        <>
          <p>
            <strong>Urgente:</strong>
          </p>

          <div className="descripcion-pedido">
            {pedidoSeleccionado.motivoUrgencia ||
              "Sin elementos urgentes"}
          </div>

          <p>
            <strong>No urgente:</strong>
          </p>

          <div className="descripcion-pedido">
            {pedidoSeleccionado.descripcion ||
              "Sin elementos no urgentes"}
          </div>
        </>
      ) : (
        <>
          <p>
            <strong>Descripción:</strong>
          </p>

          <div className="descripcion-pedido">
            {pedidoSeleccionado.descripcion}
          </div>
        </>
      )}

      <p>
        <strong>Adjuntos:</strong>
      </p>

      <AdjuntosPedido pedido={pedidoSeleccionado} />

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

