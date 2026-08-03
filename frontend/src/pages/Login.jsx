import { useNavigate } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import { useMsal } from "@azure/msal-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import logoEstelPositivo from "../assets/ESTEL_LOGO_RGB POSITIVO.png";

function Login() {

  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [estadoSolicitud, setEstadoSolicitud] = useState(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);

const { instance } = useMsal();

  useEffect(() => {
    const sesionCaducada = sessionStorage.getItem("sessionExpired") === "1";

    if (sesionCaducada) {
      sessionStorage.removeItem("sessionExpired");
      setSesionExpirada(true);
    }
  }, []);



  const loginMicrosoft = async () => {

  setSesionExpirada(false);

  try {

    const response =
      await instance.loginPopup({
        prompt: "select_account",
        scopes: ["User.Read"]
});

    if (response.account) {
      instance.setActiveAccount(response.account);
    }

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

      {sesionExpirada && (
        <div
          className="login-access-message login-session-expired-message"
          role="alert"
          aria-live="assertive"
        >
          <div className="login-session-icon"><FontAwesomeIcon icon={faShieldHalved} /></div>
          <h2>Sesión expirada</h2>
          <p>Tu sesión ha expirado por motivos de seguridad.</p>
          <p>
            Por favor, vuelve a iniciar sesión para continuar utilizando la aplicación.
          </p>
        </div>
      )}

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
        {sesionExpirada ? "Iniciar sesión de nuevo" : "Iniciar sesión con Microsoft"}
      </button>

    </div>

  </div>

);
}

export default Login;
