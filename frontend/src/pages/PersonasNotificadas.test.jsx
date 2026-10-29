import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NuevaSolicitud from "./NuevaSolicitud";
import MisSolicitudes from "./MisSolicitudes";
import { AuthContext } from "../context/AuthContext";
import { SolicitudesContext } from "../context/SolicitudesContext";
import api from "../api";

jest.mock("../api", () => ({ post: jest.fn(), get: jest.fn(), put: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../components/ProjectSelector", () => ({ value, onChange }) => <input aria-label="Proyecto" value={value} onChange={event => onChange(event.target.value)} />);
jest.mock("../hooks/useProjectCatalog", () => () => []);

const pedido = { _id: "1", proyecto: "Obra", solicitante: "Ana", email: "ana@empresa.com", estado: "Pendiente", personasNotificadas: ["anterior@empresa.com"], elementos: [{ elemento: "Cable", referencia: "CAB-1", cantidad: 1 }] };
function mostrar(page) {
  return render(<AuthContext.Provider value={{ user: { rol: "Usuario", email: pedido.email, nombre: "Ana" } }}>
    <SolicitudesContext.Provider value={{ solicitudes: [pedido], setSolicitudes: jest.fn() }}>{page}</SolicitudesContext.Provider>
  </AuthContext.Provider>);
}
beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  window.scrollTo = jest.fn();
  api.post.mockResolvedValue({ data: pedido });
  api.get.mockResolvedValue({ data: [pedido] });
  api.put.mockResolvedValue({ data: pedido });
});

test("crear envía todos los correos normalizados dentro del formulario multipart", async () => {
  mostrar(<NuevaSolicitud />);
  fireEvent.change(screen.getByLabelText("Proyecto"), { target: { value: "Obra" } });
  fireEvent.change(screen.getByLabelText("Material"), { target: { value: "Cable" } });
  fireEvent.change(screen.getByLabelText("Referencia"), { target: { value: "CAB-1" } });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: " JUAN@empresa.com " } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir destinatario" }));
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "externa@otra.org" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir destinatario" }));
  fireEvent.click(screen.getByRole("button", { name: "Crear solicitud" }));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(JSON.parse(api.post.mock.calls[0][1].get("personasNotificadas"))).toEqual(["externa@otra.org", "juan@empresa.com"]);
});

test("editar carga los destinatarios guardados y permite sustituirlos", async () => {
  mostrar(<MisSolicitudes />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir Obra, 1 pedidos" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar pedido" }));
  fireEvent.click(screen.getByRole("button", { name: "Eliminar anterior@empresa.com" }));
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "nueva@otra.org" } });
  fireEvent.keyDown(screen.getByLabelText("Correo electrónico"), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  expect(JSON.parse(api.put.mock.calls[0][1].get("personasNotificadas"))).toEqual(["nueva@otra.org"]);
});
