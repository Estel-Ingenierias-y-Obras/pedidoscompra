import Layout from "../components/Layout";

function Configuracion() {
  return (
    <Layout>

      <div className="page-header">
        <h1>Configuración</h1>
      </div>

      <div className="page-content">
        <h2>PedidosCompra</h2>

      <p>Versión: 0.1</p>

      <h3>Integraciones previstas</h3>

      <ul>
        <li>Microsoft Entra ID</li>
        <li>API Business Central</li>
        <li>Power Automate</li>
      </ul>

      <h3>Roles</h3>

      <ul>
        <li>Admin</li>
        <li>Compras</li>
        <li>Jefe de Obra</li>
        </ul>
      </div>

    </Layout>
  );
}

export default Configuracion;
