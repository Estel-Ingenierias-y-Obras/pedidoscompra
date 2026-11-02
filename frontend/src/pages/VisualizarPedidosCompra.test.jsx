import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../api";
import VisualizarPedidosCompra from "./VisualizarPedidosCompra";
jest.mock("../api", () => ({ get: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
beforeEach(() => jest.clearAllMocks());
test("espera al año, aplica filtros, cambia de página y carga líneas al desplegar", async () => {
  api.get.mockImplementation((url, config) => Promise.resolve({ data: url.endsWith("/lineas") ? [{ id: "linea", Description: "Tornillo", Cantidad: 2 }] : {
    pedidos: [{ number: "PC001", buyFromVendorNumber: "P001", NombreCliente: "Proveedor", documentDate: "2026-02-01", Estado: "Open", amount: 10, amountIncludingVAT: 12.1, Proyecto: "OBRA" }], total: 101, paginas: 2, pagina: config.params.pagina
  } }));
  render(<MemoryRouter><VisualizarPedidosCompra /></MemoryRouter>);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Año de emisión"), { target: { value: "2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Mostrar pedidos" }));
  await screen.findByText("Proveedor");
  expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra", { params: { anio: "2026", pagina: 1, ordenar: "documentDate", direccion: "desc" } });
  fireEvent.click(screen.getByRole("button", { name: "Artículos del pedido PC001" }));
  await screen.findByText("Tornillo");
  expect(screen.queryByText("Acciones")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/api/pedidos-compra", { params: { anio: "2026", pagina: 2, ordenar: "documentDate", direccion: "desc" } }));
  await screen.findByText("Proveedor");
  fireEvent.click(screen.getByRole("button", { name: "Ordenar por Proyecto" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/api/pedidos-compra", { params: { anio: "2026", pagina: 1, ordenar: "Proyecto", direccion: "asc" } }));
  await screen.findByText("Proveedor");
  fireEvent.click(screen.getByRole("button", { name: "Ordenar por Proyecto" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/api/pedidos-compra", { params: { anio: "2026", pagina: 1, ordenar: "Proyecto", direccion: "desc" } }));
  await screen.findByText("Proveedor");
  fireEvent.change(screen.getByLabelText("Año de emisión"), { target: { value: "2025" } });
  expect(screen.queryByText("Proveedor")).not.toBeInTheDocument();
});
