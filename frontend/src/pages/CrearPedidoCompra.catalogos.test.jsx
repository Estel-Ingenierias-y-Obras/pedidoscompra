import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import CrearPedidoCompra from "./CrearPedidoCompra";
jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../components/LineasMovimiento", () => () => <div>Materiales</div>);

test("selecciona códigos reales, sincroniza proveedor y nombre y descarta usuarios inventados", async () => {
  localStorage.clear();
  Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: () => "12345678-1234-4234-8234-123456789012" } });
  api.get.mockImplementation(async url => ({ data: url.endsWith("/configuracion") ? { entorno: "Production", empresaId: "empresa", empresa: "Empresa" }
    : url === "/api/proyectos" ? [{ nomProyecto: "ACEES24-001", descProyecto: "Proyecto" }]
      : url.endsWith("/usuarios-asignados") ? [{ userId: "JAVIER.GURDIEL" }]
        : url.endsWith("/tareas") ? [{ number: "CAP1", description: "Almacén" }]
          : [{ number: "P0039", displayName: "Traditel S.L." }] }));
  render(<MemoryRouter><AuthContext.Provider value={{ user: { email: "compras@example.test" } }}><CrearPedidoCompra /></AuthContext.Provider></MemoryRouter>);
  await screen.findByText("Production");
  expect(screen.getByRole("combobox", { name: "Tarea" })).toBeDisabled();
  fireEvent.focus(screen.getByRole("combobox", { name: "Nº de proveedor" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "P0039 · Traditel S.L." }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Nº de proveedor" })).toHaveValue("P0039 · Traditel S.L."));
  expect(screen.queryByLabelText("Nombre del proveedor")).not.toBeInTheDocument();
  fireEvent.focus(screen.getByRole("combobox", { name: "Proyecto" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "ACEES24-001 · Proyecto" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Tarea" })).not.toBeDisabled());
  fireEvent.focus(screen.getByRole("combobox", { name: "Tarea" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "CAP1 · Almacén" }));
  expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra/tareas", { params: { proyecto: "ACEES24-001" } });
  const usuario = screen.getByRole("combobox", { name: "Id. usuario asignado" });
  fireEvent.focus(usuario);
  fireEvent.change(usuario, { target: { value: "JAVIER.COSTA" } });
  expect(screen.queryByRole("option", { name: "JAVIER.COSTA" })).not.toBeInTheDocument();
  fireEvent.blur(usuario);
  expect(usuario).toHaveValue("");
  expect(api.post).not.toHaveBeenCalled();
});
