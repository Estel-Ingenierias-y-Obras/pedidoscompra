import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCirclePlus, faList } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import "./Almacen.css";

export default function PedidosCompra() {
  return <Layout>
    <div className="page-header"><h1>Pedidos Compra</h1><p className="page-subtitle">Pedidos de compra en Business Central.</p></div>
    <div className="page-content module-cards">
      <Link className="module-card" to="/pedidos-compra/crear"><FontAwesomeIcon className="module-card-icon" icon={faFileCirclePlus} aria-hidden="true" /><h2>Crear en BC</h2><p>Crear pedidos de compra en Business Central.</p></Link>
      <Link className="module-card" to="/pedidos-compra/visualizar"><FontAwesomeIcon className="module-card-icon" icon={faList} aria-hidden="true" /><h2>Visualizar</h2><p>Consultar los pedidos de compra de Business Central.</p></Link>
    </div>
  </Layout>;
}

export function ApartadoPedidosCompra({ crear = false }) {
  return <Layout>
    <div className="page-header"><Link className="back-link" to="/pedidos-compra">← Pedidos Compra</Link><h1>{crear ? "Crear en BC" : "Visualizar"}</h1></div>
    <div className="page-content">
      <p>{crear ? "La creación de pedidos de compra estará disponible cuando se conecte la API de Business Central y se definan los campos del formulario." : "La consulta de pedidos de compra estará disponible cuando se conecte la API de Business Central y se definan los campos del listado."}</p>
      <p>Integración pendiente de configuración.</p>
    </div>
  </Layout>;
}
