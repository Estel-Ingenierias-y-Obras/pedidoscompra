import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EnviadosAlmacen from "./EnviadosAlmacen";
import { puedeAcceder } from "../routes/permissions";
import * as servicio from "../services/almacen";
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../services/almacen", () => ({ obtenerRegistrosPendientes: jest.fn(), obtenerEnviados: jest.fn(), obtenerEntradas: jest.fn(), registrarEntrada: jest.fn(), guardarEntrada: jest.fn() }));
const montar = () => render(<MemoryRouter><EnviadosAlmacen /></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); servicio.obtenerRegistrosPendientes.mockResolvedValue([]); servicio.obtenerEntradas.mockResolvedValue(Array.from({ length: 65 }, (_, i) => ({ id: `bc-${i}` }))); });

test("mantiene más de 50 envíos vigentes y abre el modal sin registrar automáticamente", async () => {
  servicio.obtenerEnviados.mockResolvedValue(Array.from({ length: 65 }, (_, i) => ({ solicitudId: `op-${i}`, estado: i === 64 ? "bloqueada" : "creada", respuesta: { id: `bc-${i}`, numdoc: `DOC-${i}`, descripcion: `Producto ${i}` } })));
  montar();
  const ultima = await screen.findByRole("row", { name: "Documento DOC-64" });
  expect(screen.getAllByRole("row")).toHaveLength(66);
  fireEvent.click(ultima);
  expect(ultima).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("dialog", { name: "Registrar entrada en BC" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(servicio.obtenerEntradas).toHaveBeenCalledTimes(1);
  expect(servicio.registrarEntrada).not.toHaveBeenCalled();
  expect(servicio.guardarEntrada).not.toHaveBeenCalled();
});

test("muestra el error de carga y permite recuperar el historial", async () => {
  servicio.obtenerEnviados.mockRejectedValueOnce(new Error("sin red")).mockResolvedValueOnce([{ solicitudId: "op-1", respuesta: { id: "bc-1", numdoc: "DOC-1" } }]);
  montar();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  await screen.findByRole("row", { name: "Documento DOC-1" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("historial vacío informa sin ofrecer creación ni registro", async () => {
  servicio.obtenerEnviados.mockResolvedValue([]);
  montar();
  await waitFor(() => expect(screen.queryByText("Cargando envíos a BC…")).not.toBeInTheDocument());
  expect(screen.getByText("Todavía no hay envíos confirmados a BC.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Volver a entradas" })).toHaveAttribute("href", "/material/almacen/entradas");
});

test("actualizar retira las líneas ausentes de BC y conserva las vigentes", async () => {
  servicio.obtenerEnviados.mockResolvedValue([1, 2].map(i => ({ solicitudId: `op-${i}`, respuesta: { id: `bc-${i}`, numdoc: `DOC-${i}` } })));
  montar();
  fireEvent.click(await screen.findByRole("row", { name: "Documento DOC-1" }));
  servicio.obtenerEntradas.mockResolvedValue([{ id: "BC-2" }]);
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  await waitFor(() => expect(screen.queryByRole("row", { name: "Documento DOC-1" })).not.toBeInTheDocument());
  expect(screen.getByRole("row", { name: "Documento DOC-2" })).toBeInTheDocument();
  servicio.obtenerEntradas.mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  await screen.findByText("Todavía no hay envíos confirmados a BC.");
  expect(servicio.guardarEntrada).not.toHaveBeenCalled();
});

test.each(["conexión", "respuesta inválida"])("un fallo de %s conserva las filas al actualizar", async fallo => {
  servicio.obtenerEnviados.mockResolvedValue([{ solicitudId: "op-1", respuesta: { id: "bc-1", numdoc: "DOC-1" } }]);
  montar();
  await screen.findByRole("row", { name: "Documento DOC-1" });
  if (fallo === "conexión") servicio.obtenerEntradas.mockRejectedValue(new Error("timeout"));
  else servicio.obtenerEntradas.mockResolvedValue({ error: "incompleta" });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("row", { name: "Documento DOC-1" })).toBeInTheDocument();
});

test("historial mantiene los permisos de almacén", () => {
  for (const rol of ["Admin", "Comprador"]) expect(puedeAcceder(rol, "/material/almacen/enviados")).toBe(true);
  for (const rol of ["Usuario", "Encargado", "Desconocido"]) expect(puedeAcceder(rol, "/material/almacen/enviados")).toBe(false);
});

test("clic en una celda registra solo la línea seleccionada y evita envíos duplicados", async () => {
  const entrada = { id: "bc-1", numdoc: "DOC-1", descripcion: "Material", claveintegracion: "clave-1" };
  servicio.obtenerEnviados.mockResolvedValue([{ solicitudId: "op-1", respuesta: entrada }]);
  let confirmar;
  servicio.registrarEntrada.mockImplementation(() => new Promise(resolve => { confirmar = resolve; }));
  montar();
  fireEvent.click(await screen.findByText("Material"));
  expect(servicio.registrarEntrada).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  expect(screen.getByRole("button", { name: "Registrando…" })).toBeDisabled();
  expect(servicio.registrarEntrada).toHaveBeenCalledTimes(1);
  expect(servicio.registrarEntrada.mock.calls[0][0]).toMatchObject(entrada);
  confirmar({ estado: "creada", respuesta: { registrado: true } });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByRole("row", { name: "Documento DOC-1" })).not.toBeInTheDocument();
  expect(screen.getByText("Línea registrada correctamente en Business Central")).toHaveClass("notification-toast-exito");
});

test("Enter abre el modal y un resultado incierto conserva la línea para reintentar", async () => {
  servicio.obtenerEnviados.mockResolvedValue([{ solicitudId: "op-1", claveintegracion: "clave-1", respuesta: { id: "bc-1", numdoc: "DOC-1" } }]);
  servicio.registrarEntrada.mockResolvedValueOnce({ estado: "incierta", error: "Confirma el resultado" }).mockRejectedValueOnce({ response: { data: { error: "BC rechazó el registro" } } });
  montar();
  fireEvent.keyDown(await screen.findByRole("row", { name: "Documento DOC-1" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await screen.findByText("Confirma el resultado");
  expect(screen.getByRole("row", { name: "Documento DOC-1" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await screen.findByText("BC rechazó el registro");
  expect(servicio.registrarEntrada.mock.calls[0][0]).toEqual(servicio.registrarEntrada.mock.calls[1][0]);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("las líneas eliminadas de BC no aparecen aunque tengan registros inciertos", async () => {
 servicio.obtenerEnviados.mockResolvedValue([1,2,3].map(i => ({solicitudId: `op-${i}`,respuesta:{id:`bc-${i}`,numdoc:`DOC-${i}`}})));
 servicio.obtenerEntradas.mockResolvedValue([]);
 servicio.obtenerRegistrosPendientes.mockResolvedValue([{cuerpo:{idlinea:"bc-1"},estado:"incierta"}]);
 montar();
 await screen.findByText("Todavía no hay envíos confirmados a BC.");
 expect(screen.queryByRole("row",{name:/Documento DOC/})).not.toBeInTheDocument();
 expect(servicio.registrarEntrada).not.toHaveBeenCalled();
});
