import api from "../api";
import { obtenerProductos, obtenerProducto, buscarProductos } from "./almacen";
jest.mock("../api", () => ({ get: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); localStorage.setItem("microsoftAuthToken", String(Math.random())); });
test.each([
  { numprod: "MAT-1", descripcion: "Cable", codudmedida: "M", inventario: 0 },
  { number: "MAT-1", displayName: "Cable", baseUnitOfMeasureCode: "M", inventario: 0 }
])("catálogo muestra código, descripción y unidad en ambos formatos", async producto => {
 api.get.mockResolvedValue({ data: [producto] });
 expect(await obtenerProductos()).toEqual([expect.objectContaining({ numprod: "MAT-1", descripcion: "Cable", codudmedida: "M", inventario: 0 })]);
});

test("el inventario consulta solo el producto seleccionado y comparte peticiones simultáneas", async () => {
 api.get.mockClear();
 api.get.mockImplementation(url => Promise.resolve({ data: url.endsWith("configuracion") ? { busquedaProductos: true } : [{ number: "OTRO", inventory: 10 }, { number: "ARTEL-1", referenciaTlm: "20193978", inventory: 0 }] }));
 const resultados = await Promise.all([obtenerProducto("ARTEL-1"), obtenerProducto("ARTEL-1")]);
 expect(resultados[0]).toMatchObject({ numprod: "ARTEL-1", inventory: 0 });
 expect(api.get.mock.calls.filter(([url]) => url.endsWith("/productos"))).toHaveLength(1);
 expect(api.get).toHaveBeenCalledWith("/api/almacen/productos", { params: { numprod: "ARTEL-1" }, timeout: 20000 });
});

test("no consulta nada con dos caracteres y comparte búsqueda y caché desde el tercero", async () => {
 api.get.mockImplementation(url => Promise.resolve({ data: url.endsWith("configuracion") ? { busquedaProductos: true } : { articulos: [{ number: "A", referenciaTlm: "20193978", displayName: "Cable" }], hayMas: false } }));
 await buscarProductos("20"); expect(api.get).not.toHaveBeenCalled();
 await Promise.all([buscarProductos("201"), buscarProductos("201")]); await buscarProductos("201");
 expect(api.get.mock.calls.filter(([url]) => url.endsWith("/productos"))).toHaveLength(1);
 expect(api.get).toHaveBeenCalledWith("/api/almacen/productos", { params: { buscar: "201" }, timeout: 20000 });
});

test("un backend antiguo se detecta sin descargar el catálogo y permite reintentar tras actualizarlo", async () => {
 api.get.mockResolvedValue({ data: {} });
 await expect(buscarProductos("201")).rejects.toThrow("actualizarse");
 expect(api.get.mock.calls.some(([url]) => url.endsWith("/productos"))).toBe(false);
 api.get.mockImplementation(url => Promise.resolve({ data: url.endsWith("configuracion") ? { busquedaProductos: true } : { articulos: [], hayMas: false } }));
 await expect(buscarProductos("201")).resolves.toEqual({ articulos: [], hayMas: false });
});
test("catálogo sin códigos muestra error en vez de opciones vacías", async () => {
 api.get.mockResolvedValue({ data: [{ id: "sin-codigo" }] });
 await expect(obtenerProductos()).rejects.toThrow("sin código");
});
