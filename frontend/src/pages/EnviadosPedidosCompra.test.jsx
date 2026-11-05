import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../api";
import EnviadosPedidosCompra from "./EnviadosPedidosCompra";
jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
const id = "12345678-1234-4234-8234-123456789012";
let estado;
beforeEach(() => {
  jest.clearAllMocks(); estado = "Open";
  api.get.mockImplementation(async url => ({ data: url.endsWith("/enviados") ? {
    pedidos: estado === "Deleted" ? [] : [{ solicitudId: id, numero: "PC001", estado, proveedor: "P0039", nombreProveedor: "Traditel", proyecto: "OBRA", enviadoPor: "compras@example.test", gestionable: true }], pagina: 1, paginas: estado === "Deleted" ? 0 : 1
  } : {
    resultado: { solicitudId: id, id: "bc-id", numero: "PC001", estado }, cuerpo: { proveedor: "P0039", proyecto: "OBRA", tarea: "CAP1", usuarioAsignado: "COMPRAS", fechaRecepcion: "2026-11-10", lineas: [{ articulo: "1000", cantidad: 2 }] },
    cabecera: { buyFromVendorNumber: "P0039", NombreCliente: "Traditel", Proyecto: "OBRA" }, lineas: [{ id: "L1", Referencia: "REF001", Description: "Material prueba", Cantidad: 2, CantidadRecivida: 0, quantityInvoiced: 0, unitOfMeasureCode: "UD" }], enviadoPor: "compras@example.test"
  } }));
  api.post.mockImplementation(async () => { estado = "Released"; return { data: { solicitudId: id, numero: "PC001", estado } }; });
  api.delete.mockImplementation(async () => { estado = "Deleted"; return { data: { solicitudId: id, numero: "PC001", estado } }; });
});
test("abre detalles, lanza y exige confirmación antes de eliminar de BC", async () => {
  render(<MemoryRouter><EnviadosPedidosCompra /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "PC001" }));
  await screen.findByText("Material prueba");
  fireEvent.click(screen.getByRole("button", { name: "Lanzar" }));
  await screen.findByText("Pedido PC001 lanzado.");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Lanzar" })).not.toBeInTheDocument());
  expect(api.post).toHaveBeenCalledWith(`/api/pedidos-compra/solicitudes/${id}/lanzar`, {});
});

test("exige confirmar la eliminacion de un pedido abierto", async () => {
  render(<MemoryRouter><EnviadosPedidosCompra /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "PC001" }));
  await screen.findByText("Material prueba");
  fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  expect(api.delete).not.toHaveBeenCalled();
  const dialogo = within(screen.getByRole("dialog", { name: "Confirmar eliminación de pedido" }));
  fireEvent.click(dialogo.getByRole("button", { name: "Cancelar" }));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar eliminación" }));
  await screen.findByText("Pedido PC001 eliminado de BC.");
  expect(api.delete).toHaveBeenCalledWith(`/api/pedidos-compra/solicitudes/${id}`, { data: { numero: "PC001" } });
  await waitFor(() => expect(screen.queryByRole("button", { name: "PC001" })).not.toBeInTheDocument());
});
test("abre automáticamente el envío indicado por la URL", async () => {
  render(<MemoryRouter initialEntries={[`/pedidos-compra/enviados?pedido=${id}`]}><EnviadosPedidosCompra /></MemoryRouter>);
  await screen.findByRole("dialog", { name: "Detalles del pedido" });
  expect(api.get).toHaveBeenCalledWith(`/api/pedidos-compra/solicitudes/${id}/detalles`);
});

 test("actualiza los datos y permite cerrar ambos modales con la equis o el fondo", async () => {
  render(<MemoryRouter><EnviadosPedidosCompra /></MemoryRouter>);
  await screen.findByRole("button", { name: "PC001" });
  expect(screen.queryByText("Mostrar eliminados")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Crear pedido" })).not.toBeInTheDocument();
  api.get.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra/enviados", { params: { pagina: 1, buscar: "" } }));
  fireEvent.click(await screen.findByRole("button", { name: "PC001" }));
  await screen.findByText("Material prueba");
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar modal" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "PC001" }));
  await screen.findByText("Material prueba");
  // eslint-disable-next-line testing-library/no-node-access
  fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "PC001" }));
  await screen.findByText("Material prueba");
  fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar modal" }));
  await screen.findByText("Material prueba");
  fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  // eslint-disable-next-line testing-library/no-node-access
  fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
  await screen.findByText("Material prueba");
  expect(api.delete).not.toHaveBeenCalled();
 });

test("Lanzados busca por numero y solo permite reabrir el pedido", async () => {
  estado = "Released";
  api.post.mockImplementation(async () => { estado = "Open"; return { data: { solicitudId: id, numero: "PC001", estado } }; });
  render(<MemoryRouter><EnviadosPedidosCompra lanzados /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "PC001" }));
  await screen.findByText("Material prueba");
  const modal = within(screen.getByRole("dialog"));
  expect(modal.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  expect(modal.queryByRole("button", { name: "Lanzar" })).not.toBeInTheDocument();
  fireEvent.click(modal.getByRole("button", { name: "Abrir" }));
  await screen.findByText("Pedido PC001 abierto.");
  expect(api.post).toHaveBeenCalledWith(`/api/pedidos-compra/solicitudes/${id}/abrir`, {});
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "PC123" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra/enviados", { params: { pagina: 1, buscar: "PC123", estado: "Released" } }));
});
