import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import CrearPedidoCompra from "./CrearPedidoCompra";
jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../components/BuscadorMovimiento", () => props => <input aria-label={props.label} disabled={props.disabled} value={props.value} onChange={e => props.onChange(e.target.value)} />);
jest.mock("../components/LineasMovimiento", () => {
  const React = require("react");
  return props => {
    const { onProducto } = props;
    React.useEffect(() => { onProducto({ number: "1000", baseUnitOfMeasureCode: "UD" }); }, [onProducto]);
    return props.lineas.map((l, i) => <input key={l.id} aria-label={`Artículo línea ${i + 1}`} value={l.numprod} onChange={e => props.cambiar(l.id, { numprod: e.target.value, cantidad: 1 })} />);
  };
});
const clave = "pedido-compra-v2:Sandbox:empresa:compras@example.test";
beforeEach(() => {
  localStorage.clear(); jest.clearAllMocks();
  Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: () => "12345678-1234-4234-8234-123456789012" } });
  api.get.mockImplementation(async url => ({ data: url.endsWith("/configuracion") ? { entorno: "Sandbox", empresaId: "empresa", empresa: "Empresa prueba" } : url === "/api/proyectos" ? [{ nomProyecto: "OBRA", descProyecto: "Obra" }] : url.endsWith("/usuarios-asignados") ? [{ userId: "COMPRAS" }] : url.endsWith("/tareas") ? [{ number: "100", description: "Tarea" }] : [] }));
});
const montar = () => render(<MemoryRouter><AuthContext.Provider value={{ user: { email: "compras@example.test" } }}><CrearPedidoCompra /></AuthContext.Provider></MemoryRouter>);
const rellenar = async () => {
  await screen.findByText("Sandbox");
  await waitFor(() => expect(screen.getByLabelText("Nº de proveedor")).not.toBeDisabled());
  for (const [label, valor] of [["Nº de proveedor", "PROV1"], ["Proyecto", "OBRA"], ["Tarea", "100"], ["Id. usuario asignado", "COMPRAS"], ["Nombre de entrega", "Obra"], ["Dirección", "Calle 1"], ["Ciudad", "Palma"], ["Código postal", "07001"], ["Artículo línea 1", "1000"]]) { await waitFor(() => expect(screen.getByLabelText(label)).not.toBeDisabled()); fireEvent.change(screen.getByLabelText(label), { target: { value: valor } }); await waitFor(() => expect(screen.getByLabelText(label)).toHaveValue(valor)); }
};
test("crea abierto, bloquea el formulario enviado y solo lanza al pulsar Lanzar", async () => {
  api.post.mockImplementation(async url => ({ data: { solicitudId: "12345678-1234-4234-8234-123456789012", id: "12345678-1234-4234-8234-123456789013", numero: "PC001", estado: url.endsWith("/lanzar") ? "Released" : "Open" } }));
  montar();
  await rellenar();
  fireEvent.click(screen.getByRole("button", { name: "Crear pedido en BC" }));
  await screen.findByText("Abierto");
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Nº de proveedor")).toBeDisabled();
  expect(screen.queryByLabelText("Fecha de emisión")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(clave)).enviado).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Lanzar" }));
  await screen.findByText("Lanzado");
  expect(api.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/lanzar$/), {});
  expect(screen.queryByRole("button", { name: "Lanzar" })).not.toBeInTheDocument();
});
test("un fallo de red conserva la solicitud para reintentar y recuperar estado", async () => {
  api.post.mockRejectedValue(new Error("Sin conexión"));
  montar();
  await rellenar();
  fireEvent.click(screen.getByRole("button", { name: "Crear pedido en BC" }));
  await screen.findByText("Sin conexión");
  const guardado = JSON.parse(localStorage.getItem(clave));
  expect(guardado.enviado).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar creación" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[0]).toEqual(api.post.mock.calls[1]);
  expect(screen.queryByRole("button", { name: "Nuevo pedido" })).not.toBeInTheDocument();
});
