import Layout from "../components/Layout";
import DeleteIconButton from "../components/DeleteIconButton";
import "./Usuarios.css";
import { useContext, useEffect, useState } from "react";
import { UsuariosContext } from "../context/UsuariosContext";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

function Usuarios() {
  const {
     usuarios,
     setUsuarios
    } = useContext(UsuariosContext);

  const { user } = useContext(AuthContext);
  
  const [busqueda, setBusqueda] = useState("");

  const [mostrarModal, setMostrarModal] =
  useState(false);

  const [usuarioAEliminar, setUsuarioAEliminar] =
  useState(null);

  const [mensaje, setMensaje] = useState("");

  const [nombreNuevo, setNombreNuevo] =
  useState("");

  const [emailNuevo, setEmailNuevo] =
  useState("");

  const [rolNuevo, setRolNuevo] =
  useState("Usuario");

  const [solicitudes, setSolicitudes] = useState([]);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [nombreAprobacion, setNombreAprobacion] = useState("");
  const [rolAprobacion, setRolAprobacion] = useState("Usuario");

  const cargarSolicitudes = async () => {
    const response = await api.get("/api/solicitudes-acceso");
    setSolicitudes(response.data);
  };

  useEffect(() => {
    cargarSolicitudes().catch(error =>
      console.error(
        "Error cargando solicitudes de acceso:", error
      )
    );
  }, []);

  const cambiarRol = async (
  id,
  nuevoRol
) => {

  try {

    await api.put(
      `/api/usuarios/${id}`,
      {
        rol: nuevoRol
      }
    );

    const response =
      await api.get(
        "/api/usuarios"
      );

    setUsuarios(response.data);

    mostrarNotificacion(
      "Rol actualizado correctamente"
    );

  } catch (error) {

    console.error(
      "Error actualizando rol:",
      error
    );

  }

};

const agregarUsuario = async () => {

  try {

    const nuevoUsuario = {
      nombre: nombreNuevo,
      email: emailNuevo,
      rol: rolNuevo
    };

    await api.post(
      "/api/usuarios",
      nuevoUsuario
    );

    const response =
      await api.get(
        "/api/usuarios"
      );

    setUsuarios(response.data);

    setNombreNuevo("");
    setEmailNuevo("");
    setRolNuevo("Usuario");

    setMostrarModal(false);

  } catch (error) {

    console.error(
      "Error creando usuario:",
      error
    );

  }

};

const mostrarNotificacion = (texto) => {
  setMensaje(texto);

  setTimeout(() => {
    setMensaje("");
  }, 3000);
};

const solicitarEliminacion = (usuario) => {
  if (usuario.email === user?.email) {
    mostrarNotificacion(
      "No puedes eliminar tu propio usuario"
    );
    return;
  }

  setUsuarioAEliminar(usuario);
};

const confirmarEliminacion = async () => {

  if (!usuarioAEliminar) {
    return;
  }

  try {

    await api.delete(
      `/api/usuarios/${usuarioAEliminar._id}`
    );

    const response =
      await api.get(
        "/api/usuarios"
      );

    setUsuarios(response.data);

    setUsuarioAEliminar(null);

    mostrarNotificacion(
      "Usuario eliminado correctamente"
    );

  } catch (error) {

    console.error(
      "Error eliminando usuario:",
      error
    );

  }

};

const abrirSolicitud = (solicitud) => {
  setSolicitudSeleccionada(solicitud);
  setNombreAprobacion(solicitud.nombre);
  setRolAprobacion("Usuario");
};

const aprobarSolicitud = async () => {
  if (!solicitudSeleccionada || !nombreAprobacion.trim()) {
    mostrarNotificacion("El nombre es obligatorio");
    return;
  }

  try {
    await api.patch(
      `/api/solicitudes-acceso/${solicitudSeleccionada._id}/aprobar`,
      {
        nombre: nombreAprobacion.trim(),
        rol: rolAprobacion
      }
    );

    const [usuariosResponse] = await Promise.all([
      api.get("/api/usuarios"),
      cargarSolicitudes()
    ]);

    setUsuarios(usuariosResponse.data);
    setSolicitudSeleccionada(null);
    mostrarNotificacion("Solicitud aprobada y usuario creado correctamente");
  } catch (error) {
    console.error("Error aprobando solicitud de acceso:", error);
    mostrarNotificacion(
      error.response?.data?.error || "No se pudo aprobar la solicitud"
    );
  }
};

const rechazarSolicitud = async (solicitud) => {
  try {
    await api.patch(
      `/api/solicitudes-acceso/${solicitud._id}/rechazar`
    );
    await cargarSolicitudes();
    setSolicitudSeleccionada(null);
    mostrarNotificacion("Solicitud rechazada");
  } catch (error) {
    console.error("Error rechazando solicitud de acceso:", error);
    mostrarNotificacion(
      error.response?.data?.error || "No se pudo rechazar la solicitud"
    );
  }
};

const formatearFecha = (fecha) =>
  new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(fecha));

  return (
    <Layout>
      <div className="page-header">
        <h1>Gestión de Usuarios</h1>
      </div>

      {mensaje && (
        <div className="mensaje-exito">
          {mensaje}
        </div>
      )}

      <div className="page-content">

<div className="usuarios-toolbar">

  <input
    type="text"
    placeholder=" Buscar usuario..."
    value={busqueda}
    onChange={(e) =>
      setBusqueda(e.target.value)
    }
  />

  <button
    onClick={() => setMostrarModal(true)}
  >
    Añadir usuario
  </button>

</div>

<br />

<table>
  <thead>
    <tr>
      <th>Nombre</th>
      <th>Email</th>
      <th>Rol</th>
      <th>Acciones</th>
    </tr>
  </thead>

  <tbody>
    {usuarios
  .filter(usuario => {

    return (
      usuario.nombre
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        ) ||

      usuario.email
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        ) ||

      usuario.rol
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        )
    );

  })
  .map(usuario => (
      <tr key={usuario._id}>

  <td>{usuario.nombre}</td>

  <td>{usuario.email}</td>

  <td>

    <select
      value={usuario.rol}
        onChange={(e) =>
        cambiarRol(
          usuario._id,
          e.target.value
         )
      }
    >
      <option value="Admin">
        Admin
      </option>

      <option value="Comprador">
        Comprador
      </option>

      <option value="Usuario">
        Usuario
      </option>

    </select>

  </td>

  <td>
    <DeleteIconButton
      label="Eliminar usuario"
      onClick={() =>
        solicitarEliminacion(usuario)
      }
    />
  </td>

</tr>
    ))}
  </tbody>
</table>

<section className="usuarios-section">
  <h2>Solicitudes de acceso</h2>

  <table>
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Email</th>
        <th>Fecha solicitud</th>
        <th>Estado</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
      {solicitudes.map(solicitud => (
        <tr key={solicitud._id}>
          <td>{solicitud.nombre}</td>
          <td>{solicitud.email}</td>
          <td>{formatearFecha(solicitud.fechaSolicitud)}</td>
          <td>
            <span className={`estado-solicitud estado-${solicitud.estado}`}>
              {solicitud.estado}
            </span>
          </td>
          <td>
            {solicitud.estado === "pendiente" ? (
              <button onClick={() => abrirSolicitud(solicitud)}>
                Abrir
              </button>
            ) : (
              "—"
            )}
          </td>
        </tr>
      ))}
      {solicitudes.length === 0 && (
        <tr>
          <td colSpan="5" className="tabla-vacia">
            No hay solicitudes de acceso
          </td>
        </tr>
      )}
    </tbody>
  </table>
</section>
      </div>

    {mostrarModal && (

  <div className="modal-overlay">

    <div className="modal">

      <h2>Añadir usuario</h2>

      <label>Nombre</label>

      <input
        type="text"
        value={nombreNuevo}
        onChange={(e) =>
          setNombreNuevo(e.target.value)
        }
      />

      <label>Email</label>

      <input
        type="email"
        value={emailNuevo}
        onChange={(e) =>
          setEmailNuevo(e.target.value)
        }
      />

      <label>Rol</label>

      <select
        value={rolNuevo}
        onChange={(e) =>
          setRolNuevo(e.target.value)
        }
      >
        <option>Usuario</option>
        <option>Comprador</option>
        <option>Admin</option>
      </select>

      <div className="modal-buttons">

        <button
          onClick={() =>
            setMostrarModal(false)
          }
        >
          Cancelar
        </button>

        <button
          onClick={agregarUsuario}
        >
          Guardar
        </button>

      </div>

    </div>

  </div>

)}

    {usuarioAEliminar && (

  <div className="modal-overlay">

    <div className="modal">

      <h2>Eliminar usuario</h2>

      <p>
        ¿Está seguro de que desea eliminar este usuario?
      </p>
      <p>

        <strong>Nombre:</strong>{" "}
        {usuarioAEliminar.nombre}
      </p>

      <p>
        <strong>Email:</strong>{" "}
        {usuarioAEliminar.email}
      </p>

      <div className="modal-buttons">

        <button
          onClick={() =>
            setUsuarioAEliminar(null)
          }
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

    {solicitudSeleccionada && (
      <div className="modal-overlay">
        <div className="modal">
          <h2>Solicitud de acceso</h2>

          <p>
            <strong>Email:</strong>{" "}
            {solicitudSeleccionada.email}
          </p>

          <label>Nombre</label>
          <input
            type="text"
            value={nombreAprobacion}
            onChange={(e) => setNombreAprobacion(e.target.value)}
          />

          <label>Rol</label>
          <select
            value={rolAprobacion}
            onChange={(e) => setRolAprobacion(e.target.value)}
          >
            <option value="Usuario">Usuario</option>
            <option value="Comprador">Comprador</option>
            <option value="Admin">Admin</option>
          </select>

          <div className="modal-buttons solicitud-buttons">
            <button onClick={() => setSolicitudSeleccionada(null)}>
              Cancelar
            </button>
            <button
              className="button-danger"
              onClick={() => rechazarSolicitud(solicitudSeleccionada)}
            >
              Rechazar
            </button>
            <button onClick={aprobarSolicitud}>
              Aprobar y crear usuario
            </button>
          </div>
        </div>
      </div>
    )}

    </Layout>
  );
}

export default Usuarios;




