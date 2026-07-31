import "./Sidebar.css";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { NavLink } from "react-router-dom";
import logo from "../assets/ESTEL_LOGO_RGB_GRANDE_NEGATIVO.png";

function Sidebar() {
  const { user, setUser } = useContext(AuthContext);
  
  const logout = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("microsoftAuthToken");
  setUser(null);
};
  const navClassName = ({ isActive }) =>
    isActive ? "nav-link-active" : undefined;


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
          <NavLink to="/nuevasolicitud" className={navClassName}>
            Nuevo Pedido
          </NavLink>
        </li>
        <li>
          <NavLink to="/missolicitudes" className={navClassName}>
            Mis Pedidos
          </NavLink>
        </li>

        {user?.rol === "Comprador" && (
          <>
         <li>
            <NavLink to="/validar-solicitudes" className={navClassName}>
              Gestión de Pedidos
            </NavLink>
        </li>
        <li>
          <NavLink to="/historico-pedidos" className={navClassName}>
            Histórico de Pedidos
          </NavLink>
        </li>
            </>
        )}

        {user?.rol === "Admin" && (
          <>
            <li>
              <NavLink to="/usuarios" className={navClassName}>
                Usuarios
              </NavLink>
            </li>

            <li>
              <NavLink to="/configuracion" className={navClassName}>
                Configuración
              </NavLink>
            </li>

            <li>
              <NavLink to="/validar-solicitudes" className={navClassName}>
                Gestión de Pedidos
              </NavLink>
            </li>
            <li>
              <NavLink to="/historico-pedidos" className={navClassName}>
                Histórico de Pedidos
              </NavLink>
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
