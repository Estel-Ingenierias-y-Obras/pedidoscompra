import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovimientosEnviados from "./MovimientosEnviados";
import * as servicio from "../services/movimientosAlmacen";
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../services/movimientosAlmacen", () => ({ obtenerMovimientosEnviados: jest.fn(), obtenerDetalleMovimiento: jest.fn(), registrarMovimiento: jest.fn() }));
const envio = { bcId: "18f1c681-7651-4b40-aef7-0f4481ec0402", solicitudId: "28f1c681-7651-4b40-aef7-0f4481ec0402", numero: "AC-000011", estado: "enviadoBC", confirmadoBC: true, fechaEnvio: "2026-10-14T10:00:00Z", cabecera: { origen: "CENTRAL 3", destino: "P1", solicitante: "R1", departamento: "D1", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ numprod: "ART1", cantidad: 2, codudmedida: "UD" }], datosEnviados: { serie: "ACO-ALM", departamento: "D1" } };
const montar = () => render(<MemoryRouter><MovimientosEnviados /></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); servicio.obtenerMovimientosEnviados.mockResolvedValue([envio]); servicio.obtenerDetalleMovimiento.mockResolvedValue(envio); });
afterEach(() => jest.useRealTimers());
test("fila sin botones abre dos acciones; visualizar abre detalle de solo lectura y vuelve con X", async () => {
  montar();
  const fila = await screen.findByRole("row", { name: "Abrir movimiento AC-000011" });
  expect(within(fila).queryByRole("button")).not.toBeInTheDocument(); fireEvent.click(fila);
  let modal = screen.getByRole("dialog");
  expect(within(modal).getByRole("button", { name: "Visualizar" })).toBeInTheDocument();
  expect(within(modal).getByRole("button", { name: "Registrar" })).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Visualizar" }));
  modal = await screen.findByRole("dialog", { name: "Visualizar movimiento AC-000011" });
  expect(await within(modal).findByText("Tipo de origen")).toBeInTheDocument();
  expect(within(modal).getByText("Zona")).toBeInTheDocument();
  expect(within(modal).getByText("Nº solicitante")).toBeInTheDocument();
  expect(within(modal).getByText("Nombre del solicitante")).toBeInTheDocument();
  expect(within(modal).queryByText("ART1")).not.toBeInTheDocument();
  expect(within(modal).queryByText("Información enviada a BC")).not.toBeInTheDocument();
  expect(within(modal).queryByText("Serie")).not.toBeInTheDocument();
  expect(within(modal).queryByText("Referencia de integración")).not.toBeInTheDocument();
  expect(within(modal).queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Cerrar modal" }));
  expect(screen.getByRole("dialog", { name: "Movimiento AC-000011" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
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
  expect(screen.queryByRole("row", { name: "Abrir movimiento AC-000011" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Historial de registros" }));
  expect(screen.getByRole("row", { name: "Abrir movimiento AC-000011" })).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("row", { name: "Abrir movimiento AC-000011" }));
  const modal = screen.getByRole("dialog", { name: "Visualizar movimiento AC-000011" });
  expect(await within(modal).findByText("Tipo de origen")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Visualizar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Registrar" })).not.toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Cerrar modal" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("separa los registros confirmados y muestra únicamente los nueve campos solicitados", async () => {
  const registrado = { ...envio, bcId: "historico", numero: "AC-000010", estado: "registrado", fechaRegistro: "2026-10-15T10:00:00Z", comprobanteRegistro: { id: "recibo" } };
  servicio.obtenerMovimientosEnviados.mockResolvedValue([envio, registrado]);
  servicio.obtenerDetalleMovimiento.mockResolvedValue({ ...envio,
    cabecera: { ...envio.cabecera, tipoorigen: "Location", tipodestino: "Job", nombresolicitante: "Persona solicitante", serie: "NO MOSTRAR", usuario: "USUARIO OCULTO" },
    datosEnviados: { cabecera: { zona: "EM-ESPAÑA" } }
  });
  montar();
  fireEvent.click(await screen.findByRole("row", { name: "Abrir movimiento AC-000011" }));
  expect(screen.getByRole("button", { name: "Actualizar datos" })).toBeEnabled();
  const visualizar = screen.getByRole("button", { name: "Visualizar" });
  expect(visualizar).toHaveAttribute("title", "Visualizar");
  expect(screen.getByRole("button", { name: "Registrar" })).toHaveAttribute("title", "Registrar");
  fireEvent.click(visualizar);
  const modal = screen.getByRole("dialog");
  expect(await within(modal).findByText("Persona solicitante")).toBeInTheDocument();
  expect(within(modal).getByText("EM-ESPAÑA")).toBeInTheDocument();
  expect(within(modal).getAllByRole("term")).toHaveLength(9);
  expect(within(modal).queryByText("NO MOSTRAR")).not.toBeInTheDocument();
  expect(within(modal).queryByText("USUARIO OCULTO")).not.toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Cerrar modal" }));
  fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
  fireEvent.click(screen.getByRole("tab", { name: "Historial de registros" }));
  expect(screen.getByRole("row", { name: "Abrir movimiento AC-000010" })).toBeInTheDocument();
  expect(screen.queryByRole("row", { name: "Abrir movimiento AC-000011" })).not.toBeInTheDocument();
});

test("actualiza automáticamente cada 15 segundos y al recuperar el foco; limpia el temporizador al salir", async () => {
  jest.useFakeTimers();
  const { unmount } = montar();
  await screen.findByRole("row", { name: "Abrir movimiento AC-000011" });
  expect(servicio.obtenerMovimientosEnviados).toHaveBeenCalledTimes(1);
  servicio.obtenerMovimientosEnviados.mockResolvedValue([{ ...envio, numero: "AC-000012" }]);
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(screen.getByRole("row", { name: "Abrir movimiento AC-000012" })).toBeInTheDocument();
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(servicio.obtenerMovimientosEnviados).toHaveBeenCalledTimes(3);
  unmount();
  await act(async () => { jest.advanceTimersByTime(30000); });
  fireEvent.focus(window);
  expect(servicio.obtenerMovimientosEnviados).toHaveBeenCalledTimes(3);
});

test("actualizar datos recarga pendientes e historial independientemente de la pestaña activa", async () => {
  const historico = { ...envio, bcId: "historial", numero: "AC-000010", estado: "registrado", fechaRegistro: "2026-10-15T10:00:00Z", comprobanteRegistro: { id: "recibo" } };
  servicio.obtenerMovimientosEnviados.mockResolvedValueOnce([envio, historico])
    .mockResolvedValueOnce([{ ...envio, numero: "AC-000012" }, { ...historico, numero: "AC-000013" }])
    .mockResolvedValueOnce([{ ...envio, numero: "AC-000014" }, { ...historico, numero: "AC-000015" }]);
  montar();
  expect(screen.getByRole("button", { name: "Actualizar datos" })).toBeDisabled();
  await screen.findByRole("row", { name: "Abrir movimiento AC-000011" });
  const boton = screen.getByRole("button", { name: "Actualizar datos" });
  expect(boton).toHaveAttribute("type", "button");
  fireEvent.click(boton);
  await screen.findByRole("row", { name: "Abrir movimiento AC-000012" });
  fireEvent.click(screen.getByRole("tab", { name: "Historial de registros" }));
  expect(screen.getByRole("row", { name: "Abrir movimiento AC-000013" })).toBeInTheDocument();
  fireEvent.click(boton);
  await screen.findByRole("row", { name: "Abrir movimiento AC-000015" });
  expect(screen.getByRole("tab", { name: "Historial de registros" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("tab", { name: "Enviados a BC" }));
  expect(screen.getByRole("row", { name: "Abrir movimiento AC-000014" })).toBeInTheDocument();
  expect(servicio.obtenerMovimientosEnviados).toHaveBeenCalledTimes(3);
});

test("una actualización antigua no devuelve a pendientes un acopio que acaba de registrarse", async () => {
  let terminarConsulta;
  montar();
  fireEvent.click(await screen.findByRole("row", { name: "Abrir movimiento AC-000011" }));
  servicio.obtenerMovimientosEnviados.mockImplementationOnce(() => new Promise(resolve => { terminarConsulta = resolve; }));
  fireEvent.focus(window);
  servicio.registrarMovimiento.mockResolvedValue({ estado: "registrado", registrado: true, bcId: envio.bcId, solicitudId: envio.solicitudId, fechaRegistro: "2026-10-14T11:00:00Z", comprobanteRegistro: { id: "comprobante" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await act(async () => { terminarConsulta([envio]); });
  expect(screen.queryByRole("row", { name: "Abrir movimiento AC-000011" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Historial de registros" }));
  expect(screen.getByRole("row", { name: "Abrir movimiento AC-000011" })).toBeInTheDocument();
});
