import { render, screen } from "@testing-library/react";
import { AuthContext } from "./context/AuthContext";
import App from "./App";

jest.mock("./pages/Login", () => () => <div>Login</div>);
jest.mock("./pages/Usuarios", () => () => <div>Usuarios</div>);
jest.mock("./pages/NuevaSolicitud", () => () => <div>Nuevo Pedido</div>);
jest.mock("./pages/MisSolicitudes", () => () => <div>Pedidos</div>);
jest.mock("./pages/ValidarSolicitudes", () => () => <div>Gestión de Pedidos</div>);
jest.mock("./pages/Configuracion", () => () => <div>Configuración</div>);
jest.mock("./pages/HistoricoPedidos", () => () => <div>Histórico de Pedidos</div>);
jest.mock("./pages/Materiales", () => () => <div>Material</div>);

test.each(["/usuarios", "/configuracion", "/nuevasolicitud", "/pedidos", "/missolicitudes", "/desconocida", "/USUARIOS/"])(
  "Comprador es redirigido desde %s a gestión", path => {
    window.history.replaceState({}, "", path);
    render(<AuthContext.Provider value={{ user: { rol: "Comprador" } }}><App /></AuthContext.Provider>);
    expect(screen.getByText("Gestión de Pedidos")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/validar-solicitudes");
  }
);
test.each([
  ["Comprador", "/material", "Material"],
  ["Comprador", "/historico-pedidos", "Histórico de Pedidos"],
  ["Usuario", "/pedidos", "Pedidos"],
  ["Usuario", "/missolicitudes", "Pedidos"],
  ["Usuario", "/usuarios", "Nuevo Pedido"],
  ["Usuario", "/validar-solicitudes", "Nuevo Pedido"],
  ["Admin", "/usuarios", "Usuarios"],
  ["Admin", "/configuracion", "Configuración"]
])("%s accede a %s según su rol", (rol, path, expected) => {
  window.history.replaceState({}, "", path);
  render(<AuthContext.Provider value={{ user: { rol } }}><App /></AuthContext.Provider>);
  expect(screen.getByText(expected)).toBeInTheDocument();
});
test("sin sesión las rutas requieren login", () => {
  window.history.replaceState({}, "", "/pedidos");
  render(<AuthContext.Provider value={{ user: null }}><App /></AuthContext.Provider>);
  expect(screen.getByText("Login")).toBeInTheDocument();
});
