import "./Sidebar.css";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { NavLink } from "react-router-dom";
import logo from "../assets/ESTEL_LOGO_RGB_GRANDE_NEGATIVO.png";

function Sidebar({ onNavigate }) {
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
          <NavLink to="/nuevasolicitud" className={navClassName} onClick={onNavigate}>
            Nuevo Pedido
          </NavLink>
        </li>
        <li>
          <NavLink to="/missolicitudes" className={navClassName} onClick={onNavigate}>
            Pedidos
          </NavLink>
        </li>

        {user?.rol === "Comprador" && (
          <>
         <li>
            <NavLink to="/validar-solicitudes" className={navClassName} onClick={onNavigate}>
              Gestión de Pedidos
            </NavLink>
        </li>
        <li>
          <NavLink to="/historico-pedidos" className={navClassName} onClick={onNavigate}>
            Histórico de Pedidos
          </NavLink>
        </li>
            </>
        )}

        {user?.rol === "Admin" && (
          <>
            <li>
              <NavLink to="/usuarios" className={navClassName} onClick={onNavigate}>
                Usuarios
              </NavLink>
            </li>

            <li>
              <NavLink to="/configuracion" className={navClassName} onClick={onNavigate}>
                Configuración
              </NavLink>
            </li>

            <li>
              <NavLink to="/validar-solicitudes" className={navClassName} onClick={onNavigate}>
                Gestión de Pedidos
              </NavLink>
            </li>
            <li>
              <NavLink to="/historico-pedidos" className={navClassName} onClick={onNavigate}>
                Histórico de Pedidos
              </NavLink>
          </li>
          </>
        )}
      </ul>
    </div>

      <div className="sidebar-footer">
        <button onClick={() => { logout(); onNavigate?.(); }}>
        Cerrar sesión
      </button>
      </div>

    </div>
  );
}

export default Sidebar;

