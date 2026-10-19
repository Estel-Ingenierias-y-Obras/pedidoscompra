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
  Object.defineProperty(window, "crypto", { configurable: true, value: { randomUUID: () => "18f1c681-7651-4b40-aef7-0f4481ec0402" } });
  localStorage.clear(); jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/api/proyectos" ? [{ nomProyecto: "P1", descProyecto: "Obra", status: "Open", blocked: " ", complete: false }] : { almacenes: [{ code: "A1", displayName: "Almacén" }], articulos: [{ id: "item1", number: "1000", displayName: "Cable", inventory: 12, baseUnitOfMeasureCode: "UD" }], recursos: [{ codigo: "R1", nombre: "Solicitante" }], departamentos: [{ code: "D1", displayName: "Departamento" }], tiposProyecto: [{ codigo: "INDIRECTO", nombre: "Indirecto" }], zonas: [{ code: "EM-ESPAÑA", displayName: "España" }], errores: {} } }));
});
test("recupera borrador, completa descripción y unidad sin habilitar registros no soportados", async () => {
  localStorage.setItem(key, JSON.stringify({ serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", zona: "EM-ESPAÑA", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ id: "l1", numprod: "1000", cantidad: "2", campoAntiguo: "eliminar" }] }));
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: /Nueva línea/ })).toBeEnabled());
  expect(screen.getByText("Cable", { selector: "td" })).toBeInTheDocument();
  expect(screen.getByText("UD", { selector: "td" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Registrar movimiento" })).not.toBeInTheDocument();
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
  expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeDisabled();
});

test("el selector solo muestra proyectos abiertos aunque el backend devuelva otros estados", async () => {
  const anterior = api.get.getMockImplementation();
  const abierto = { nomProyecto: "P1", descProyecto: "Obra abierta", status: "Open", blocked: " ", complete: false };
  api.get.mockImplementation((url, opciones) => url === "/api/proyectos"
    ? Promise.resolve({ data: { value: [abierto,
      { ...abierto, nomProyecto: "P2", status: "Completed" },
      { ...abierto, nomProyecto: "P3", status: "Planning" },
      { ...abierto, nomProyecto: "P4", status: "Quote" },
      { ...abierto, nomProyecto: "P5", complete: true },
      { ...abierto, nomProyecto: "P6", blocked: "All" },
      { nomProyecto: "P7", descProyecto: "Sin estado" }
    ] } }) : anterior(url, opciones));
  localStorage.setItem(key, JSON.stringify({ cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P2" }, lineas: [] }));
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: /Nueva línea/ })).toBeEnabled());
  await waitFor(() => expect(JSON.parse(localStorage.getItem(key)).cabecera.destino).toBe(""));
  fireEvent.focus(screen.getByRole("combobox", { name: "Destino código" }));
  expect(screen.getAllByRole("option")).toEqual(expect.arrayContaining([
    screen.getByRole("option", { name: "P1 · Obra abierta" })
  ]));
  for (const codigo of ["P2", "P3", "P4", "P5", "P6", "P7"]) {
    expect(screen.queryByRole("option", { name: new RegExp(`^${codigo} ·`) })).not.toBeInTheDocument();
  }
  expect(api.post).not.toHaveBeenCalled();
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
  const cabecera = { tipoorigen: "Location", origen: "A", tipodestino: "Location", destino: "B", solicitante: "R", departamento: "D", zona: "EM-ESPAÑA", tipoproyectocodigo: "INDIRECTO" };
  expect(validarMovimiento({ cabecera: { ...cabecera, destino: "A" }, lineas: [] })).toMatch(/distintos/);
  expect(validarMovimiento({ cabecera, lineas: [] })).toMatch(/al menos/);
  for (const cantidad of ["", -1, 0, "NaN", Infinity]) expect(validarMovimiento({ cabecera, lineas: [{ numprod: "1", cantidad }] })).toMatch(/mayor que cero/);
});
test("envío conserva el borrador y muestra el error real sin confirmar un envío ficticio", async () => {
  localStorage.setItem(key, JSON.stringify({ solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", zona: "EM-ESPAÑA", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ id: "l1", numprod: "1000", cantidad: "2" }] }));
  api.post.mockRejectedValue({ response: { status: 501, data: { error: "La API AL solo admite consultas." } } });
  montar();
  const enviar = screen.getByRole("button", { name: "Enviar a BC" });
  await waitFor(() => expect(enviar).toBeEnabled()); fireEvent.click(enviar);
  expect(await screen.findByText("La API AL solo admite consultas.")).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/api/almacen/movimientos", expect.objectContaining({ solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", tipoOperacion: "acopio", lineas: [{ id: "l1", numprod: "1000", cantidad: 2 }] }));
  expect(JSON.parse(localStorage.getItem(key)).estado).toBe("error");
  expect(screen.getByRole("link", { name: "Enviados a BC" })).toHaveAttribute("href", "/material/almacen/movimientos/enviados");
  fireEvent.change(screen.getByLabelText("Cantidad línea 1"), { target: { value: "3" } });
  expect(JSON.parse(localStorage.getItem(key)).estado).toBe("borrador");
});
test("un timeout conserva el cuerpo para reintentar sin bloquear la edición", async () => {
  localStorage.setItem(key, JSON.stringify({ solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", zona: "EM-ESPAÑA", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ id: "l1", numprod: "1000", cantidad: "2" }] }));
  api.post.mockRejectedValue(new Error("Conexión interrumpida"));
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Enviar a BC" }));
  expect(await screen.findByText("Conexión interrumpida")).toBeInTheDocument();
  expect(screen.getByLabelText("Cantidad línea 1")).toBeEnabled();
  expect(JSON.parse(localStorage.getItem(key)).resultadoIncierto).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Enviar a BC" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual(api.post.mock.calls[0][1]);
});

test("un error guardado permite editar inmediatamente, desaparece al cambiar y se comprueba al reenviar", async () => {
  const idOriginal = "28f1c681-7651-4b40-aef7-0f4481ec0402";
  const original = { solicitudId: idOriginal, serie: "ACO-ALM", estado: "error", resultadoIncierto: true,
    error: "Status must be equal to 'Open' in Project P2.",
    cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P2", solicitante: "R1", departamento: "D1", zona: "EM-ESPAÑA", tipoproyectocodigo: "INDIRECTO" },
    lineas: [{ id: "l1", numprod: "1000", cantidad: "2" }], cuerpoEnviado: { solicitudId: idOriginal } };
  localStorage.setItem(key, JSON.stringify(original));
  const anterior = api.get.getMockImplementation();
  api.get.mockImplementation((url, opciones) => url.endsWith("/recuperacion")
    ? Promise.resolve({ data: { solicitudId: idOriginal, editable: true } }) : anterior(url, opciones));
  montar();
  await waitFor(() => expect(screen.getByLabelText("Cantidad línea 1")).toBeEnabled());
  expect(screen.queryByRole("button", { name: "Corregir borrador" })).not.toBeInTheDocument();
  expect(screen.getByText(original.error)).toBeInTheDocument();
  fireEvent.focus(screen.getByRole("combobox", { name: "Destino código" }));
  fireEvent.mouseDown(screen.getByRole("option", { name: "P1 · Obra" }));
  expect(screen.queryByText(original.error)).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key)).cabecera.destino).toBe("P1");
  expect(JSON.parse(localStorage.getItem(key)).envioAnterior.cuerpoEnviado).toEqual(original.cuerpoEnviado);
  expect(api.get.mock.calls.some(([url]) => url.endsWith("/recuperacion"))).toBe(false);
  api.post.mockResolvedValue({ data: { estado: "enviadoBC", confirmadoBC: true, solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", bcId: "38f1c681-7651-4b40-aef7-0f4481ec0402", numero: "AC-123", registrado: false } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar a BC" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.get).toHaveBeenCalledWith(`/api/almacen/movimientos/solicitudes/${idOriginal}/recuperacion`);
  expect(api.post.mock.calls[0][1]).toMatchObject({ solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", cabecera: { destino: "P1" } });
  expect(JSON.parse(localStorage.getItem(`${key}:incidencia:${idOriginal}`)).cuerpoEnviado).toEqual(original.cuerpoEnviado);
});

test("permite eliminar líneas tras un error sin botones adicionales", async () => {
  localStorage.setItem(key, JSON.stringify({ solicitudId: "28f1c681-7651-4b40-aef7-0f4481ec0402", estado: "error", resultadoIncierto: true,
    error: "Proyecto cerrado", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1" },
    lineas: [{ id: "l1", numprod: "1000", cantidad: "2" }] }));
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar línea 1" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Eliminar línea 1" }));
  expect(JSON.parse(localStorage.getItem(key)).lineas).toEqual([]);
  expect(screen.queryByText("Proyecto cerrado")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Nueva línea/ })).toBeEnabled();
  expect(api.post).not.toHaveBeenCalled();
});

test("si no se confirma el intento previo no envía otro acopio y sigue permitiendo editar y limpiar el error", async () => {
  const original = { solicitudId: "28f1c681-7651-4b40-aef7-0f4481ec0402", estado: "error", resultadoIncierto: true,
    cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", zona: "EM-ESPAÑA", tipoproyectocodigo: "INDIRECTO" },
    lineas: [{ id: "l1", numprod: "1000", cantidad: "2" }] };
  localStorage.setItem(key, JSON.stringify(original));
  const anterior = api.get.getMockImplementation();
  api.get.mockImplementation((url, opciones) => url.endsWith("/recuperacion")
    ? Promise.reject({ response: { status: 409, data: { error: "Revisar en BC" } } }) : anterior(url, opciones));
  montar();
  await waitFor(() => expect(screen.getByLabelText("Cantidad línea 1")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Cantidad línea 1"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar a BC" }));
  expect(await screen.findByText("Revisar en BC")).toBeInTheDocument();
  expect(screen.getByLabelText("Cantidad línea 1")).toBeEnabled();
  expect(JSON.parse(localStorage.getItem(key)).solicitudId).toBe(original.solicitudId);
  expect(JSON.parse(localStorage.getItem(key)).envioAnterior.solicitudId).toBe(original.solicitudId);
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Cantidad línea 1"), { target: { value: "4" } });
  expect(screen.queryByText("Revisar en BC")).not.toBeInTheDocument();
});
