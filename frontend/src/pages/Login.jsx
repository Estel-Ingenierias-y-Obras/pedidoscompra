import { useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import { useMsal } from "@azure/msal-react";
import logoEstelPositivo from "../assets/ESTEL_LOGO_RGB POSITIVO.png";

function Login() {

  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [estadoSolicitud, setEstadoSolicitud] = useState(null);

const { instance } = useMsal();



  const loginMicrosoft = async () => {

  try {

    const response =
      await instance.loginPopup({
        prompt: "select_account",
        scopes: ["User.Read"]
});

    const email =
      response.account.username;

    const acceso = await api.post(
      "/api/solicitudes-acceso",
      {
        nombre: response.account.name || email,
        email,
        tenantId: response.account.tenantId || ""
      }
    );

    if (!acceso.data.autorizado) {

      setEstadoSolicitud(
        acceso.data.solicitudCreada ? "enviada" : "pendiente"
      );

      return;
    }

    if (response.idToken) {
      localStorage.setItem("microsoftAuthToken", response.idToken);
    }

    setUser(acceso.data.usuario);

    localStorage.setItem(
      "user",
      JSON.stringify(acceso.data.usuario)
    );

    navigate("/nuevasolicitud");

  } catch (error) {

    console.error(
      "Error login Microsoft:",
      error
    );

  }

};

  return (

  <div className="login-container">

    <div className="login-card">

      <img
        src={logoEstelPositivo} 
        alt="Logo Estel" 
        />

      <h1>
        Gestión de Pedidos
      </h1>

      <p>
        Plataforma de solicitudes
        y seguimiento de compras
      </p>

      {estadoSolicitud === "enviada" && (
        <div
          className="login-access-message login-access-message-sent"
          role="status"
          aria-live="polite"
        >
          <h2>✅ Solicitud enviada</h2>
          <p>Tu cuenta todavía no está autorizada.</p>
          <p>
            Se ha enviado una solicitud de acceso a los administradores.
          </p>
          <p>
            Recibirás acceso cuando un administrador apruebe la solicitud.
          </p>
        </div>
      )}

      {estadoSolicitud === "pendiente" && (
        <div
          className="login-access-message login-access-message-pending"
          role="status"
          aria-live="polite"
        >
          <h2>⏳ Solicitud pendiente</h2>
          <p>
            Tu solicitud de acceso ya existe y está pendiente de revisión
            por un administrador.
          </p>
        </div>
      )}

      <button
        className="microsoft-button"
        onClick={loginMicrosoft}
      >
        Iniciar sesión con Microsoft
      </button>

    </div>

  </div>

);
}

export default Login;
