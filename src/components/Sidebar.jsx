import "./Sidebar.css";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Link } from "react-router-dom";
import logo from "../assets/ESTEL_LOGO_RGB_GRANDE_NEGATIVO.png";

function Sidebar() {
  const { user, setUser } = useContext(AuthContext);
  
  const logout = () => {
  localStorage.removeItem("user");
  setUser(null);
};

  return (
    <div className = "sidebar">

      <div>
      <img
        src={logo}
        alt="Logo Estel"
        className="sidebar-logo"
      />


      <hr />

      <ul>
        <li>
          <Link to="/nuevasolicitud">Nuevo Pedido</Link>
        </li>
        <li>
          <Link to="/missolicitudes">Mis Pedidos</Link>
        </li>

        {user?.rol === "Comprador" && (
          <>
         <li>
            <Link to="/validar-solicitudes">Gestión de Pedidos</Link>
        </li>
        <li>
          <Link to="/historico-pedidos">Histórico de Pedidos</Link>
        </li>
            </>
        )}

        {user?.rol === "Admin" && (
          <>
            <li>
              <Link to="/usuarios">Usuarios</Link>
            </li>

            <li>
              <Link to="/configuracion">Configuración</Link>
            </li>

            <li>
            <Link to="/validar-solicitudes">Gestión de Pedidos</Link>
            </li>
            <li>
          <Link to="/historico-pedidos">Histórico de Pedidos</Link>
          </li>
          </>
        )}
      </ul>
    </div>

      <div className="sidebar-footer">
        <button onClick={logout}>
        Cerrar sesión
      </button>
      </div>

    </div>
  );
}

export default Sidebar;
