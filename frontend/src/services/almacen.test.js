import api from "../api";
import { obtenerProductos } from "./almacen";
jest.mock("../api", () => ({ get: jest.fn() }));
test.each([
  { numprod: "MAT-1", descripcion: "Cable", codudmedida: "M", inventario: 0 },
  { number: "MAT-1", displayName: "Cable", baseUnitOfMeasureCode: "M", inventario: 0 }
])("catálogo muestra código, descripción y unidad en ambos formatos", async producto => {
 api.get.mockResolvedValue({ data: [producto] });
 expect(await obtenerProductos()).toEqual([expect.objectContaining({ numprod: "MAT-1", descripcion: "Cable", codudmedida: "M", inventario: 0 })]);
});
test("catálogo sin códigos muestra error en vez de opciones vacías", async () => {
 api.get.mockResolvedValue({ data: [{ id: "sin-codigo" }] });
 await expect(obtenerProductos()).rejects.toThrow("sin código");
});
