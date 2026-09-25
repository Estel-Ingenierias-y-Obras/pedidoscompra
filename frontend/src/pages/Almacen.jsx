import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import "./Almacen.css";

export default function Almacen() {
  return <Layout>
    <div className="page-header"><Link className="back-link" to="/material">← Material</Link><h1>Almacén</h1><p className="page-subtitle">Almacén CENTRAL 3 · Departamento SG-ALMACEN</p></div>
    <div className="page-content module-cards">
      <Link className="module-card" to="/material/almacen/entradas"><h2>Añadir Material al Almacén</h2><p>Crear entradas en el diario de productos.</p></Link>
      <div className="module-card module-card-disabled"><h2>Movimientos de Almacén</h2><p>Próximamente</p></div>
      <div className="module-card module-card-disabled"><h2>Stock Actual</h2><p>Próximamente</p></div>
    </div>
  </Layout>;
}
