import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import DeleteIconButton from "../components/DeleteIconButton";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONFIGURACIONES = {
  compras: {
    endpoint: "/api/configuracion/notificaciones-compras",
    titulo: "Notificaciones de compras",
    descripcion:
      "Destinatarios que recibirán las nuevas solicitudes de compra.",
    inputId: "destinatario-compra",
    placeholder: "compras@esteling.com"
  },
  acceso: {
    endpoint: "/api/configuracion/notificaciones-acceso",
    titulo: "Notificaciones de acceso",
    descripcion:
      "Destinatarios que recibirán las nuevas solicitudes de acceso.",
    inputId: "destinatario-acceso",
    placeholder: "administrador@esteling.com"
  }
};

function Configuracion() {
  const { user } = useContext(AuthContext);
  const [destinatariosCompra, setDestinatariosCompra] = useState([]);
  const [destinatariosAcceso, setDestinatariosAcceso] = useState([]);
  const [emailCompra, setEmailCompra] = useState("");
  const [emailAcceso, setEmailAcceso] = useState("");
  const [mensaje, setMensaje] = useState(null);

  const cargarDestinatarios = async ({ endpoint, setDestinatarios }) => {
    const response = await api.get(endpoint);
    setDestinatarios(response.data);
  };

  useEffect(() => {
    if (user?.rol === "Admin") {
      Promise.all([
        cargarDestinatarios({
          endpoint: CONFIGURACIONES.compras.endpoint,
          setDestinatarios: setDestinatariosCompra
        }),
        cargarDestinatarios({
          endpoint: CONFIGURACIONES.acceso.endpoint,
          setDestinatarios: setDestinatariosAcceso
        })
      ]).catch(error => {
        console.error("Error cargando destinatarios:", error);
        setMensaje({
          tipo: "error",
          texto: "No se pudieron cargar los destinatarios"
        });
      });
    }
  }, [user?.rol]);

  if (user?.rol !== "Admin") {
    return <Navigate to="/nuevasolicitud" replace />;
  }

  const agregarDestinatario = async ({
    event,
    email,
    setEmail,
    endpoint,
    setDestinatarios
  }) => {
    event.preventDefault();
    const emailNormalizado = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(emailNormalizado)) {
      setMensaje({ tipo: "error", texto: "Introduce un email válido" });
      return;
    }

    try {
      const response = await api.post(endpoint, { email: emailNormalizado });

      setDestinatarios(actuales => [response.data, ...actuales]);
      setEmail("");
      setMensaje({
        tipo: "exito",
        texto: "Destinatario añadido correctamente"
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto:
          error.response?.data?.error ||
          "No se pudo añadir el destinatario"
      });
    }
  };

  const eliminarDestinatario = async ({
    destinatario,
    endpoint,
    setDestinatarios
  }) => {
    try {
      await api.delete(`${endpoint}/${destinatario._id}`);

      setDestinatarios(actuales =>
        actuales.filter(item => item._id !== destinatario._id)
      );
      setMensaje({
        tipo: "exito",
        texto: "Destinatario eliminado correctamente"
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto:
          error.response?.data?.error ||
          "No se pudo eliminar el destinatario"
      });
    }
  };

  const formatearFecha = (fecha) =>
    new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(fecha));

  const renderSeccionDestinatarios = ({
    config,
    destinatarios,
    email,
    setEmail,
    setDestinatarios
  }) => (
    <section className="settings-section">
      <div className="settings-section-header">
        <div>
          <h2>{config.titulo}</h2>
          <p>{config.descripcion}</p>
        </div>
      </div>

      <form
        className="settings-form"
        onSubmit={event =>
          agregarDestinatario({
            event,
            email,
            setEmail,
            endpoint: config.endpoint,
            setDestinatarios
          })
        }
      >
        <div>
          <label htmlFor={config.inputId}>Correo electrónico</label>
          <input
            id={config.inputId}
            type="email"
            placeholder={config.placeholder}
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </div>
        <button type="submit">Añadir destinatario</button>
      </form>

      {destinatarios.length === 0 ? (
        <div className="empty-state settings-empty-state">
          No hay destinatarios configurados.
        </div>
      ) : (
        <table className="settings-table acciones-centradas-table">
          <thead>
            <tr>
              <th>Correo</th>
              <th>Fecha de creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {destinatarios.map(destinatario => (
              <tr key={destinatario._id}>
                <td className="settings-email">{destinatario.email}</td>
                <td>{formatearFecha(destinatario.fechaCreacion)}</td>
                <td>
                  <DeleteIconButton
                    label="Eliminar destinatario"
                    onClick={() =>
                      eliminarDestinatario({
                        destinatario,
                        endpoint: config.endpoint,
                        setDestinatarios
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>Configuración</h1>
        <p className="page-subtitle">
          Administra las preferencias generales de la plataforma.
        </p>
      </div>

      <div className="page-content settings-grid">
        {mensaje && (
          <div
            className={`settings-feedback settings-feedback-${mensaje.tipo}`}
            role={mensaje.tipo === "error" ? "alert" : "status"}
          >
            {mensaje.texto}
          </div>
        )}

        {renderSeccionDestinatarios({
          config: CONFIGURACIONES.compras,
          destinatarios: destinatariosCompra,
          email: emailCompra,
          setEmail: setEmailCompra,
          setDestinatarios: setDestinatariosCompra
        })}

        {renderSeccionDestinatarios({
          config: CONFIGURACIONES.acceso,
          destinatarios: destinatariosAcceso,
          email: emailAcceso,
          setEmail: setEmailAcceso,
          setDestinatarios: setDestinatariosAcceso
        })}
      </div>
    </Layout>
  );
}

export default Configuracion;

