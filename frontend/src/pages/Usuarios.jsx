import Layout from "../components/Layout";
import "./Usuarios.css";
import { useContext, useState } from "react";
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
    <button
      onClick={() =>
        solicitarEliminacion(usuario)
      }
    >
      Eliminar
    </button>
  </td>

</tr>
    ))}
  </tbody>
</table>
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

export default Usuarios;
