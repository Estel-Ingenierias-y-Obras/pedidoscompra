import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StockAlmacen from "./StockAlmacen";
import Almacen from "./Almacen";
import { puedeAcceder } from "../routes/permissions";
import { obtenerStock } from "../services/almacen";
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../services/almacen", () => ({ obtenerStock: jest.fn() }));
const producto = (id, inventario = 1) => ({ id, numprod: `COD-${id}`, descripcion: `Descripción ${id}`, codudmedida: "UD", inventario });
const montar = () => render(<MemoryRouter><StockAlmacen /></MemoryRouter>);
beforeEach(() => jest.resetAllMocks());

test("muestra carga y todos los productos, negativos y precisión; busca por código y descripción", async () => {
  obtenerStock.mockResolvedValue([...Array.from({ length: 65 }, (_, i) => producto(String(i))), producto("negativo", -0.1234567)]);
  montar();
  expect(screen.getByRole("status")).toHaveTextContent("Cargando existencias");
  await screen.findByText("COD-64");
  expect(screen.getAllByRole("row")).toHaveLength(67);
  expect(screen.getByText("-0,1234567")).toBeInTheDocument();
  const buscar = screen.getByRole("searchbox", { name: "Buscar por código o descripción" });
  fireEvent.change(buscar, { target: { value: "cod-64" } });
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.change(buscar, { target: { value: "descripcion negativo" } });
  expect(screen.getByText("COD-negativo")).toBeInTheDocument();
  fireEvent.change(buscar, { target: { value: "inexistente" } });
  expect(screen.getByRole("status")).toHaveTextContent("No hay productos que coincidan");
  expect(screen.getAllByRole("button")).toHaveLength(1);
});

test("distingue stock vacío de error y permite reintentar", async () => {
  obtenerStock.mockRejectedValueOnce({ response: { data: { error: "BC sin conexión" } } }).mockResolvedValueOnce([]);
  montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("BC sin conexión");
  expect(screen.queryByText(/No hay productos/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  await screen.findByText("No hay productos con existencias distintas de cero en CENTRAL 3.");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("conserva datos anteriores con aviso si falla la actualización y los reemplaza al recuperar", async () => {
  obtenerStock.mockResolvedValueOnce([producto("primero")]).mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce([producto("nuevo")]);
  montar();
  await screen.findByText("COD-primero");
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("pueden no estar actualizados");
  expect(screen.getByText("COD-primero")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar datos" }));
  await screen.findByText("COD-nuevo");
  expect(screen.queryByText("COD-primero")).not.toBeInTheDocument();
});

test("no presenta cantidades inválidas como stock cero", async () => {
  obtenerStock.mockResolvedValue([{ ...producto("1"), inventario: null }]);
  montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("respuesta de stock no válida");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("navegación y permisos mantienen el acceso de almacén", () => {
  render(<MemoryRouter><Almacen /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /Stock actual/ })).toHaveAttribute("href", "/material/almacen/stock");
  for (const rol of ["Admin", "Comprador"]) expect(puedeAcceder(rol, "/material/almacen/stock")).toBe(true);
  for (const rol of ["Usuario", "Encargado", "Desconocido"]) expect(puedeAcceder(rol, "/material/almacen/stock")).toBe(false);
});
