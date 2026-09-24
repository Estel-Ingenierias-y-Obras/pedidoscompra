import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Sidebar from "./Sidebar";

test("Comprador solo tiene las tres páginas permitidas y cerrar sesión", () => {
  const setUser = jest.fn();
  render(<MemoryRouter><AuthContext.Provider value={{ user: { rol: "Comprador" }, setUser }}>
    <Sidebar />
  </AuthContext.Provider></MemoryRouter>);
  expect(screen.getAllByRole("link").map(link => link.textContent.trim())).toEqual([
    "Gestión de Pedidos", "Histórico de Pedidos", "Material"
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  expect(setUser).toHaveBeenCalledWith(null);
});

test("Encargado solo tiene Nuevo Pedido, Pedidos, Histórico y cerrar sesión", () => {
  render(<MemoryRouter><AuthContext.Provider value={{ user: { rol: "Encargado" }, setUser: jest.fn() }}>
    <Sidebar />
  </AuthContext.Provider></MemoryRouter>);
  expect(screen.getAllByRole("link").map(link => link.textContent.trim())).toEqual([
    "Nuevo Pedido", "Pedidos", "Histórico de Pedidos"
  ]);
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
});
