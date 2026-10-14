import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovimientosEnviados from "./MovimientosEnviados";
import * as servicio from "../services/movimientosAlmacen";
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../services/movimientosAlmacen", () => ({ obtenerMovimientosEnviados: jest.fn(), obtenerDetalleMovimiento: jest.fn(), registrarMovimiento: jest.fn() }));
const envio = { bcId: "18f1c681-7651-4b40-aef7-0f4481ec0402", solicitudId: "28f1c681-7651-4b40-aef7-0f4481ec0402", numero: "AC-000011", estado: "enviadoBC", confirmadoBC: true, fechaEnvio: "2026-10-14T10:00:00Z", cabecera: { origen: "CENTRAL 3", destino: "P1", solicitante: "R1", departamento: "D1", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ numprod: "ART1", cantidad: 2, codudmedida: "UD" }], datosEnviados: { serie: "ACO-ALM", departamento: "D1" } };
const montar = () => render(<MemoryRouter><MovimientosEnviados /></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); servicio.obtenerMovimientosEnviados.mockResolvedValue([envio]); servicio.obtenerDetalleMovimiento.mockResolvedValue(envio); });
test("fila sin botones abre dos acciones; visualizar abre detalle de solo lectura y vuelve con X", async () => {
  montar();
  const fila = await screen.findByRole("row", { name: "Abrir movimiento AC-000011" });
  expect(within(fila).queryByRole("button")).not.toBeInTheDocument(); fireEvent.click(fila);
  let modal = screen.getByRole("dialog");
  expect(within(modal).getByRole("button", { name: "Visualizar" })).toBeInTheDocument();
  expect(within(modal).getByRole("button", { name: "Registrar" })).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Visualizar" }));
  modal = await screen.findByRole("dialog", { name: "Visualizar movimiento AC-000011" });
  expect(await within(modal).findByText("ART1")).toBeInTheDocument();
  expect(within(modal).queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Cerrar modal" }));
  expect(screen.getByRole("dialog", { name: "Movimiento AC-000011" })).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("registro muestra el error recibido y no inventa un éxito", async () => {
  servicio.registrarMovimiento.mockRejectedValue({ response: { data: { error: "Falta dimensión ZONA." } } });
  montar(); fireEvent.click(await screen.findByRole("row", { name: "Abrir movimiento AC-000011" }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Falta dimensión ZONA.");
  expect(servicio.registrarMovimiento).toHaveBeenCalledWith({ id: envio.bcId, claveintegracion: envio.solicitudId });
  expect(screen.queryByText(/registrado correctamente/)).not.toBeInTheDocument();
});
test("registro necesita comprobante verificable antes de actualizar el estado", async () => {
  servicio.registrarMovimiento.mockResolvedValue({ estado: "registrado", registrado: true, bcId: envio.bcId, solicitudId: envio.solicitudId, fechaRegistro: "2026-10-14T11:00:00Z", comprobanteRegistro: { id: "comprobante" } });
  montar(); fireEvent.click(await screen.findByRole("row", { name: "Abrir movimiento AC-000011" })); fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(within(screen.getByRole("row", { name: "Abrir movimiento AC-000011" })).getByText("Registrado")).toBeInTheDocument();
});
