import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import MovimientosAlmacen, { validarMovimiento } from "./MovimientosAlmacen";
import api from "../api";
jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
const key = "almacen-movimientos-v1:test@example.com";
const montar = () => render(<MemoryRouter><AuthContext.Provider value={{ user: { email: "test@example.com" } }}><MovimientosAlmacen /></AuthContext.Provider></MemoryRouter>);
beforeEach(() => {
  Object.defineProperty(window.crypto, "randomUUID", { configurable: true, value: () => "18f1c681-7651-4b40-aef7-0f4481ec0402" });
  localStorage.clear(); jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/api/proyectos" ? [{ nomProyecto: "P1", descProyecto: "Obra" }] : { almacenes: [{ code: "A1", displayName: "Almacén" }], articulos: [{ id: "item1", number: "1000", displayName: "Cable", inventory: 12, baseUnitOfMeasureCode: "UD" }], recursos: [{ codigo: "R1", nombre: "Solicitante" }], departamentos: [{ code: "D1", displayName: "Departamento" }], tiposProyecto: [{ codigo: "INDIRECTO", nombre: "Indirecto" }], errores: {} } }));
});
test("recupera borrador, completa descripción y unidad sin habilitar registros no soportados", async () => {
  localStorage.setItem(key, JSON.stringify({ serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ id: "l1", numprod: "1000", cantidad: "2", campoAntiguo: "eliminar" }] }));
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: /Nueva línea/ })).toBeEnabled());
  expect(screen.getByText("Cable", { selector: "td" })).toBeInTheDocument();
  expect(screen.getByText("UD", { selector: "td" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Registrar movimiento" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Cantidad línea 1"), { target: { value: "-2" } });
  expect(screen.getByText(/Selecciona un artículo y una cantidad mayor/)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key)).lineas[0].cantidad).toBe("-2");
  expect(Object.keys(JSON.parse(localStorage.getItem(key)).lineas[0])).toEqual(["id", "numprod", "cantidad"]);
  expect(api.get).toHaveBeenCalledWith("/api/proyectos", { params: { soloAbiertos: true } });
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.getAllByRole("columnheader")).toHaveLength(7);
});
test("proyectos no disponibles no se sustituyen por datos inventados", async () => {
  api.get.mockRejectedValue(new Error("404")); montar();
  expect(await screen.findByText(/No se pudieron cargar los proyectos/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Registrar movimiento" })).toBeDisabled();
});
test("muestra SG-ALMACEN cuando BC lo devuelve", async () => {
  const anterior = api.get.getMockImplementation();
  api.get.mockImplementation(async (url, opciones) => {
    const respuesta = await anterior(url, opciones);
    if (url.includes("catalogos")) respuesta.data.departamentos.push({ code: "SG-ALMACEN", displayName: "Almacén" });
    return respuesta;
  });
  montar();
  expect(await screen.findByRole("option", { name: "SG-ALMACEN · Almacén" })).toBeInTheDocument();
});
test("rechaza rutas iguales, líneas vacías y cantidades inválidas", () => {
  const cabecera = { tipoorigen: "Location", origen: "A", tipodestino: "Location", destino: "B", solicitante: "R", departamento: "D", tipoproyectocodigo: "INDIRECTO" };
  expect(validarMovimiento({ cabecera: { ...cabecera, destino: "A" }, lineas: [] })).toMatch(/distintos/);
  expect(validarMovimiento({ cabecera, lineas: [] })).toMatch(/al menos/);
  for (const cantidad of ["", -1, 0, "NaN", Infinity]) expect(validarMovimiento({ cabecera, lineas: [{ numprod: "1", cantidad }] })).toMatch(/mayor que cero/);
});
test("preparación usa una identidad estable y solo llama a la ruta de validación", async () => {
  localStorage.setItem(key, JSON.stringify({ solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ id: "l1", numprod: "1000", cantidad: "2" }] }));
  api.post.mockImplementation(async (url, cuerpo) => ({ data: { estado: "preparado", solicitudId: cuerpo.solicitudId, enviadoBC: false, registrado: false, propuestaBC: { lineas: cuerpo.lineas } } }));
  montar();
  const preparar = screen.getByRole("button", { name: "Preparar movimiento" });
  await waitFor(() => expect(preparar).toBeEnabled()); fireEvent.click(preparar);
  expect(await screen.findByText(/Movimiento preparado · 1 líneas/)).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/api/almacen/movimientos/preparar", expect.objectContaining({ solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", tipoOperacion: "acopio", lineas: [{ id: "l1", numprod: "1000", cantidad: 2 }] }));
  expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Registrar movimiento" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Cantidad línea 1"), { target: { value: "3" } });
  expect(screen.queryByText(/Movimiento preparado ·/)).not.toBeInTheDocument();
});
