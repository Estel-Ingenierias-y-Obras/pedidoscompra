import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MisSolicitudes from "./MisSolicitudes";
import { AuthContext } from "../context/AuthContext";
import { SolicitudesContext } from "../context/SolicitudesContext";

jest.mock("../api", () => ({ put: jest.fn(), delete: jest.fn() }));
jest.mock("../components/ProjectSelector", () => () => <div>Selector proyecto</div>);

test("Usuario ve pedidos ajenos y sus detalles, con acciones solo en propios pendientes", () => {
  const pedidos = [
    { _id: "1", email: "owner@example.com", solicitante: "Propietario", estado: "Pendiente" },
    { _id: "2", email: "other@example.com", solicitante: "Compañero", estado: "Pendiente", descripcion: "Tornillos", comentarioCompras: "En preparación" },
    { _id: "3", email: "owner@example.com", solicitante: "Propietario", estado: "Pedido" }
  ].map(pedido => ({ ...pedido, proyecto: "Obra común" }));
  render(<MemoryRouter>
    <AuthContext.Provider value={{ user: { rol: "Usuario", email: "OWNER@example.com" } }}>
      <SolicitudesContext.Provider value={{ solicitudes: pedidos, setSolicitudes: jest.fn() }}>
        <MisSolicitudes />
      </SolicitudesContext.Provider>
    </AuthContext.Provider>
  </MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Abrir Obra común, 3 pedidos" }));
  const cards = screen.getAllByRole("listitem").filter(item => item.className === "project-request-card");
  expect(cards).toHaveLength(3);
  expect(within(cards[0]).getByRole("button", { name: "Editar pedido" })).toBeInTheDocument();
  expect(within(cards[0]).getByRole("button", { name: "Eliminar pedido" })).toBeInTheDocument();
  for (const card of cards.slice(1)) {
    expect(within(card).queryByRole("button", { name: "Editar pedido" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Eliminar pedido" })).not.toBeInTheDocument();
    expect(within(card).getByText("Solo lectura")).toBeInTheDocument();
  }
  fireEvent.click(cards[1]);
  expect(screen.getByText("Tornillos")).toBeInTheDocument();
});
