import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxesStacked, faWarehouse } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import "./Almacen.css";

export default function Material() {
  return <Layout>
    <div className="page-header"><h1>Material</h1><p className="page-subtitle">Catálogo de materiales y gestión de almacén.</p></div>
    <div className="page-content module-cards">
      <Link className="module-card" to="/material/catalogo"><FontAwesomeIcon className="module-card-icon" icon={faBoxesStacked} aria-hidden="true" /><h2>Catálogo de Materiales</h2><p>Gestión de materiales</p></Link>
      <Link className="module-card" to="/material/almacen"><FontAwesomeIcon className="module-card-icon" icon={faWarehouse} aria-hidden="true" /><h2>Almacén</h2><p>Gestión de stock</p></Link>
    </div>
  </Layout>;
}
