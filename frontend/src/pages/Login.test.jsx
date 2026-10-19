import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import Login from "./Login";
jest.mock("@azure/msal-react", () => ({ useMsal: jest.fn() }));
jest.mock("../api", () => ({ post: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });
test("guarda el token Microsoft antes de solicitar acceso y conserva el login autorizado", async () => {
  const setUser = jest.fn();
  const account = { username: "persona@example.com", name: "Persona" };
  useMsal.mockReturnValue({ instance: { loginPopup: jest.fn().mockResolvedValue({ account, idToken: "token-de-prueba" }), setActiveAccount: jest.fn() } });
  api.post.mockImplementation(async () => {
    expect(localStorage.getItem("microsoftAuthToken")).toBe("token-de-prueba");
    return { data: { autorizado: true, usuario: { email: account.username, rol: "Usuario" } } };
  });
  render(<MemoryRouter><AuthContext.Provider value={{ setUser }}><Login /></AuthContext.Provider></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión con Microsoft" }));
  await waitFor(() => expect(setUser).toHaveBeenCalledWith({ email: account.username, rol: "Usuario" }));
});
test("un error de login muestra un mensaje útil sin detalles del proveedor", async () => {
  useMsal.mockReturnValue({ instance: { loginPopup: jest.fn().mockRejectedValue(new Error("token o detalle privado")) } });
  render(<MemoryRouter><AuthContext.Provider value={{ setUser: jest.fn() }}><Login /></AuthContext.Provider></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión con Microsoft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo iniciar sesión");
  expect(screen.queryByText("token o detalle privado")).not.toBeInTheDocument();
});
