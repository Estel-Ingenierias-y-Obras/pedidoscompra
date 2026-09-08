import "./Sidebar.css";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { NavLink } from "react-router-dom";
import { paginas } from "../routes/permissions";
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
        {paginas.filter(pagina => pagina.roles.includes(user?.rol)).map(pagina => (
          <li key={pagina.path}>
            <NavLink to={pagina.path} className={navClassName} onClick={onNavigate}>
              {pagina.label}
            </NavLink>
          </li>
        ))}
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

