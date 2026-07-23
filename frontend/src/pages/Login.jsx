import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { UsuariosContext } from "../context/UsuariosContext";
import { useMsal } from "@azure/msal-react";
import logoEstelPositivo from "../assets/ESTEL_LOGO_RGB POSITIVO.png";

function Login() {

  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

const { instance } = useMsal();

const { usuarios } = useContext(UsuariosContext);


  const loginMicrosoft = async () => {

  try {

    const response =
      await instance.loginPopup({
        prompt: "select_account",
        scopes: ["User.Read"]
});

    const email =
      response.account.username;

    const usuarioEncontrado =
      usuarios.find(
        usuario =>
          usuario.email.toLowerCase() ===
          email.toLowerCase()
      );

    if (!usuarioEncontrado) {

      alert(
        "No tiene permisos para acceder a esta aplicación."
      );

      return;
    }

    setUser(usuarioEncontrado);

    localStorage.setItem(
      "user",
      JSON.stringify(usuarioEncontrado)
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
