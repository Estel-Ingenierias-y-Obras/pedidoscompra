import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import EntradasAlmacen from "./EntradasAlmacen";
import EnviadosAlmacen from "./EnviadosAlmacen";
import * as servicio from "../services/almacen";
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../services/almacen", () => ({ obtenerProductos: jest.fn(), obtenerTiposProyecto: jest.fn(), obtenerEntradas: jest.fn(), obtenerOperaciones: jest.fn(), obtenerEnviados: jest.fn(), obtenerUnidades: jest.fn(), obtenerMovimientosAplicables: jest.fn(), guardarEntrada: jest.fn(), obtenerRegistrosPendientes: jest.fn(), registrarEntrada: jest.fn() }));
const key = "almacen-entradas-v2:test@example.com";
const draft = { solicitudId: "a8c7ab30-7013-4a4b-8d19-1c392a571251", estado: "borrador", numprod: "1000", cantidad: "2", codudmedida: "", liqpornumorden: "", tipoproyectocodigo: "INDIRECTO", modoMonetario: "bc", valorMonetario: "" };
const montar = () => render(<MemoryRouter initialEntries={["/material/almacen/entradas"]}><AuthContext.Provider value={{ user: { email: "test@example.com", rol: "Admin" } }}><Routes><Route path="/material/almacen/entradas" element={<EntradasAlmacen />} /><Route path="/material/almacen/enviados" element={<EnviadosAlmacen />} /></Routes></AuthContext.Provider></MemoryRouter>);
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  localStorage.setItem(key, JSON.stringify([draft]));
  servicio.obtenerProductos.mockResolvedValue([{ number: "1000", displayName: "Producto", baseUnitOfMeasureCode: "UD" }]);
  servicio.obtenerTiposProyecto.mockResolvedValue([{ codigo: "INDIRECTO", nombre: "Estructura", bloqueado: false }]);
  servicio.obtenerEntradas.mockResolvedValue([]); servicio.obtenerOperaciones.mockResolvedValue([]); servicio.obtenerEnviados.mockResolvedValue([]);
  servicio.obtenerRegistrosPendientes.mockResolvedValue([]);
  servicio.obtenerUnidades.mockResolvedValue([{ codigo: "UD", factor: 1 }]); servicio.obtenerMovimientosAplicables.mockResolvedValue([]);
});
test("un borrador antiguo con importe manual se envía usando los valores de BC", async () => {
  localStorage.setItem(key, JSON.stringify([{ ...draft, modoMonetario: "importe", valorMonetario: "120" }]));
  servicio.guardarEntrada.mockResolvedValue({ estado: "creada", respuesta: { numdoc: "BC-DEFAULT" } });
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeEnabled());
  expect(screen.queryByLabelText("Modo monetario, fila 1")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enviar a BC" }));
  await waitFor(() => expect(screen.queryByRole("row", { name: "Borrador 1" })).not.toBeInTheDocument());
  expect(servicio.guardarEntrada).toHaveBeenCalledWith({ solicitudId: draft.solicitudId, numprod: "1000", cantidad: 2, tipoproyectocodigo: "INDIRECTO" });
});

test("doble clic envía una sola vez; timeout y recarga conservan cuerpo y operación", async () => {
  let rechazar;
  servicio.guardarEntrada.mockImplementation(() => new Promise((resolve, reject) => { rechazar = reject; }));
  const vista = montar();
  const crear = await screen.findByRole("button", { name: "Enviar a BC" });
  await waitFor(() => expect(crear).not.toBeDisabled());
  fireEvent.click(crear); fireEvent.click(crear);
  expect(servicio.guardarEntrada).toHaveBeenCalledTimes(1);
  const cuerpo = servicio.guardarEntrada.mock.calls[0][0];
  expect(JSON.parse(localStorage.getItem(key))[0].cuerpoEnviado).toEqual(cuerpo);
  await act(async () => rechazar(new Error("timeout")));
  expect(screen.getByRole("button", { name: "Confirmar resultado / Reintentar" })).toBeInTheDocument();
  vista.unmount();
  servicio.guardarEntrada.mockResolvedValue({ estado: "creada", respuesta: { id: "bc-id", numdoc: "T00099", importe: 12.34, cantidad: 2, codalmacen: "CENTRAL 3" } });
  montar();
  const reintentar = screen.getByRole("button", { name: "Confirmar resultado / Reintentar" });
  await waitFor(() => expect(reintentar).not.toBeDisabled());
  fireEvent.click(reintentar);
  await waitFor(() => expect(screen.queryByRole("row", { name: "Borrador 1" })).not.toBeInTheDocument());
  expect(servicio.guardarEntrada.mock.calls[1][0]).toEqual(cuerpo);
  expect(screen.queryByRole("row", { name: "Documento T00099" })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key))).toEqual([]);
  expect(screen.queryByRole("button", { name: /Eliminar|Editar/ })).not.toBeInTheDocument();
});
test.each(["GM_KEY_CONFLICT", "GM_ENTRY_GONE"])("%s conserva fila bloqueada sin ofrecer sustitución", async codigoError => {
  servicio.guardarEntrada.mockRejectedValue({ response: { data: { estado: "bloqueada", codigoError, error: "Requiere revisión en BC" } } });
  montar();
  const crear = await screen.findByRole("button", { name: "Enviar a BC" });
  await waitFor(() => expect(crear).not.toBeDisabled());
  fireEvent.click(crear);
  await screen.findByText("Requiere revisión en BC");
  expect(screen.queryByRole("button", { name: /Corregir|Eliminar|Reintentar/ })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key))[0].estado).toBe("bloqueada");
});

test("permite eliminar un borrador y conserva la eliminación al recargar sin llamar a BC", async () => {
  const vista = montar();
  const eliminar = await screen.findByRole("button", { name: "Eliminar borrador 1" });
  await waitFor(() => expect(eliminar).toBeEnabled());
  expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Registrar" })).not.toBeInTheDocument();
  fireEvent.click(eliminar);
  expect(screen.queryByRole("row", { name: "Borrador 1" })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key))).toEqual([]);
  vista.unmount();
  montar();
  await waitFor(() => expect(screen.queryByText("Cargando diario y catálogos…")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
  expect(servicio.guardarEntrada).not.toHaveBeenCalled();
  expect(servicio.registrarEntrada).not.toHaveBeenCalled();
});

test("un envío confirmado sale del diario y se consulta desde el botón de historial, sin registrar", async () => {
  const respuesta = { id: "bc-id", numdoc: "T00100", numprod: "1000", cantidad: 2, descripcion: "Producto enviado" };
  const operacion = { solicitudId: draft.solicitudId, estado: "creada", cuerpo: { numprod: "1000", cantidad: 2 }, respuesta };
  servicio.guardarEntrada.mockImplementation(async () => {
    servicio.obtenerEnviados.mockResolvedValue([operacion]);
    servicio.obtenerEntradas.mockResolvedValue([respuesta]);
    return operacion;
  });
  montar();
  const enviar = await screen.findByRole("button", { name: "Enviar a BC" });
  await waitFor(() => expect(enviar).toBeEnabled());
  fireEvent.click(enviar);
  await waitFor(() => expect(screen.queryByRole("row", { name: "Borrador 1" })).not.toBeInTheDocument());
  expect(screen.queryByRole("row", { name: "Borrador 1" })).not.toBeInTheDocument();
  expect(screen.queryByRole("row", { name: "Documento T00100" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Enviados a BC" }));
  const enviada = await screen.findByRole("row", { name: "Documento T00100" });
  fireEvent.click(enviada);
  expect(enviada).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("button", { name: /Eliminar|Enviar a BC|Registrar/ })).not.toBeInTheDocument();
  expect(servicio.registrarEntrada).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link", { name: "Volver a entradas" }));
  await waitFor(() => expect(screen.queryByText("Cargando diario y catálogos…")).not.toBeInTheDocument());
  expect(screen.queryByRole("row", { name: "Borrador 1" })).not.toBeInTheDocument();
});

test("recupera la confirmación del servidor tras perder la respuesta sin reenviar ni reintroducir la fila", async () => {
  localStorage.setItem(key, JSON.stringify([{ ...draft, estado: "incierta", cuerpoEnviado: { solicitudId: draft.solicitudId, numprod: "1000", cantidad: 2 } }]));
  servicio.obtenerEnviados.mockResolvedValue([{ solicitudId: draft.solicitudId, respuesta: { id: "bc-1", numdoc: "DOC-1" } }]);
  montar();
  await waitFor(() => expect(screen.queryByText("Cargando diario y catálogos…")).not.toBeInTheDocument());
  expect(screen.queryByRole("row", { name: "Borrador 1" })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key))).toEqual([]);
  expect(servicio.guardarEntrada).not.toHaveBeenCalled();
});

test("no permite eliminar un envío incierto y no descarta datos si falla el historial", async () => {
  localStorage.setItem(key, JSON.stringify([{ ...draft, estado: "incierta", cuerpoEnviado: { solicitudId: draft.solicitudId, numprod: "1000", cantidad: 2 } }]));
  servicio.obtenerEnviados.mockRejectedValue(new Error("sin conexión"));
  montar();
  await waitFor(() => expect(screen.queryByText("Cargando diario y catálogos…")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Confirmar resultado / Reintentar" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key))[0].solicitudId).toBe(draft.solicitudId);
  expect(servicio.guardarEntrada).not.toHaveBeenCalled();
});
