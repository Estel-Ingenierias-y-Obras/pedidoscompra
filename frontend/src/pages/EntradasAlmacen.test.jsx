import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import EntradasAlmacen from "./EntradasAlmacen";
import * as servicio from "../services/almacen";
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../services/almacen", () => ({ obtenerProductos: jest.fn(), obtenerTiposProyecto: jest.fn(), obtenerEntradas: jest.fn(), obtenerOperaciones: jest.fn(), obtenerUnidades: jest.fn(), obtenerMovimientosAplicables: jest.fn(), guardarEntrada: jest.fn(), obtenerRegistrosPendientes: jest.fn(), registrarEntrada: jest.fn() }));
const key = "almacen-entradas-v2:test@example.com";
const draft = { solicitudId: "a8c7ab30-7013-4a4b-8d19-1c392a571251", estado: "borrador", numprod: "1000", cantidad: "2", codudmedida: "", liqpornumorden: "", tipoproyectocodigo: "INDIRECTO", modoMonetario: "bc", valorMonetario: "" };
const montar = () => render(<MemoryRouter><AuthContext.Provider value={{ user: { email: "test@example.com", rol: "Admin" } }}><EntradasAlmacen /></AuthContext.Provider></MemoryRouter>);
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  localStorage.setItem(key, JSON.stringify([draft]));
  servicio.obtenerProductos.mockResolvedValue([{ number: "1000", displayName: "Producto", baseUnitOfMeasureCode: "UD" }]);
  servicio.obtenerTiposProyecto.mockResolvedValue([{ codigo: "INDIRECTO", nombre: "Estructura", bloqueado: false }]);
  servicio.obtenerEntradas.mockResolvedValue([]); servicio.obtenerOperaciones.mockResolvedValue([]);
  servicio.obtenerRegistrosPendientes.mockResolvedValue([]);
  servicio.obtenerUnidades.mockResolvedValue([{ codigo: "UD", factor: 1 }]); servicio.obtenerMovimientosAplicables.mockResolvedValue([]);
});
test("doble clic envía una sola vez; timeout y recarga conservan cuerpo y operación", async () => {
  let rechazar;
  servicio.guardarEntrada.mockImplementation(() => new Promise((resolve, reject) => { rechazar = reject; }));
  const vista = montar();
  const crear = await screen.findByRole("button", { name: "Crear entrada pendiente" });
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
  await screen.findByText("Entrada creada en el diario, pendiente de registrar. Documento T00099.");
  expect(servicio.guardarEntrada.mock.calls[1][0]).toEqual(cuerpo);
  expect(screen.getByText("12.34")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key))).toEqual([]);
  expect(screen.queryByRole("button", { name: /Eliminar|Editar/ })).not.toBeInTheDocument();
});
test.each(["GM_KEY_CONFLICT", "GM_ENTRY_GONE"])("%s conserva fila bloqueada sin ofrecer sustitución", async codigoError => {
  servicio.guardarEntrada.mockRejectedValue({ response: { data: { estado: "bloqueada", codigoError, error: "Requiere revisión en BC" } } });
  montar();
  const crear = await screen.findByRole("button", { name: "Crear entrada pendiente" });
  await waitFor(() => expect(crear).not.toBeDisabled());
  fireEvent.click(crear);
  await screen.findByText("Requiere revisión en BC");
  expect(screen.queryByRole("button", { name: /Corregir|Quitar|Reintentar/ })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key))[0].estado).toBe("bloqueada");
});

test("muestra más de 50 entradas sin paginar y permite seleccionar la última", async () => {
  localStorage.setItem(key, "[]");
  servicio.obtenerEntradas.mockResolvedValue(Array.from({ length: 65 }, (_, indice) => ({
    id: `bc-${indice}`, claveintegracion: `clave-${indice}`, numdoc: `DOC-${indice}`, descripcion: `Producto ${indice}`
  })));
  montar();
  const ultima = await screen.findByRole("radio", { name: "Seleccionar documento DOC-64" });
  expect(screen.getAllByRole("radio")).toHaveLength(65);
  expect(screen.queryByRole("button", { name: /Anterior|Siguiente/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Página \d/)).not.toBeInTheDocument();
  fireEvent.click(ultima);
  expect(ultima).toBeChecked();
  expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
  expect(servicio.guardarEntrada).not.toHaveBeenCalled();
  expect(servicio.registrarEntrada).not.toHaveBeenCalled();
});

test("un solo diario; Registrar exige selección y confirmación", async () => {
  localStorage.setItem(key, "[]");
  const entrada = { id: "id-bc", claveintegracion: "clave-bc", numdoc: "T00100", numprod: "1000", cantidad: 3 };
  servicio.obtenerEntradas.mockResolvedValue([entrada]);
  servicio.registrarEntrada.mockResolvedValue({ estado: "creada", respuesta: { registrado: true, numdoc: "T00100" } });
  montar();
  await screen.findByText("T00100");
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: "Seleccionar documento T00100" }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  expect(servicio.registrarEntrada).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));
  await screen.findByText("Documento T00100 registrado en Business Central. BC ha contabilizado la entrada.");
  expect(servicio.registrarEntrada).toHaveBeenCalledWith(entrada);
  expect(screen.queryByRole("radio", { name: "Seleccionar documento T00100" })).not.toBeInTheDocument();
});

test("registro incierto se conserva al recargar aunque BC ya no devuelva la línea", async () => {
  localStorage.setItem(key, "[]");
  const entrada = { id: "id-bc", claveintegracion: "clave-bc", numdoc: "T00101", numprod: "1000", cantidad: 1 };
  servicio.obtenerEntradas.mockResolvedValue([entrada]);
  servicio.registrarEntrada.mockRejectedValue(new Error("timeout"));
  const vista = montar();
  await screen.findByText("T00101");
  fireEvent.click(screen.getByRole("radio", { name: "Seleccionar documento T00101" }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));
  await screen.findByText(/Resultado pendiente de confirmar. Reintenta esta misma línea/);
  vista.unmount();
  servicio.obtenerEntradas.mockResolvedValue([]);
  servicio.registrarEntrada.mockResolvedValue({ estado: "creada", respuesta: { registrado: true, numdoc: "T00101" } });
  montar();
  await waitFor(() => expect(screen.queryByText("Cargando diario y catálogos…")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("radio", { name: "Seleccionar documento T00101" }));
  fireEvent.click(screen.getByRole("button", { name: "Reintentar registro" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));
  await screen.findByText(/Documento T00101 registrado en Business Central/);
  expect(servicio.registrarEntrada.mock.calls[1][0].id).toBe(entrada.id);
  expect(servicio.registrarEntrada.mock.calls[1][0].claveintegracion).toBe(entrada.claveintegracion);
});
