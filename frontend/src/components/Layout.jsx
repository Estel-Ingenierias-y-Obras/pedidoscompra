import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faXmark } from "@fortawesome/free-solid-svg-icons";
import Sidebar from "./Sidebar";

function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cerrarMenuMovil = () => setMobileMenuOpen(false);

  return (
    <div className={`layout${mobileMenuOpen ? " mobile-menu-open" : ""}`}>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Abrir navegación"
        aria-expanded={mobileMenuOpen}
      >
        <FontAwesomeIcon icon={faBars} aria-hidden="true" />
      </button>

      <div
        className="mobile-sidebar-overlay"
        onClick={cerrarMenuMovil}
        aria-hidden="true"
      />

      <button
        type="button"
        className="mobile-menu-close"
        onClick={cerrarMenuMovil}
        aria-label="Cerrar navegación"
      >
        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
      </button>

      <Sidebar onNavigate={cerrarMenuMovil} />

      <div className="contenido">
        {children}
      </div>
    </div>
  );
}

export default Layout;
