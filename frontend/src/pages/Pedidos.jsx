import Layout from "../components/Layout";

function Pedidos() {

  const pedidos = [
    {
      id: 1,
      descripcion: "Portátil Dell",
      importe: 1200,
      estado: "Pendiente"
    },
    {
      id: 2,
      descripcion: "Monitor Samsung",
      importe: 300,
      estado: "Aprobado"
    },
    {
      id: 3,
      descripcion: "Ratón Logitech",
      importe: 40,
      estado: "Rechazado"
    }
  ];

  return (
    <Layout>

      <h1>Pedidos</h1>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Importe</th>
            <th>Estado</th>
          </tr>
        </thead>

        <tbody>
          {pedidos.map(pedido => (
            <tr key={pedido_id}>
              <td>{pedido.id}</td>
              <td>{pedido.descripcion}</td>
              <td>{pedido.importe} €</td>
              <td>{pedido.estado}</td>
            </tr>
          ))}
        </tbody>

      </table>

    </Layout>
  );
}

export default Pedidos;
