import { StrictMode, useCallback, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SelectorProducto from "./SelectorProducto";
import { buscarProductos, obtenerProducto } from "../services/almacen";
jest.mock("../services/almacen", () => ({ buscarProductos: jest.fn(), obtenerProducto: jest.fn() }));
const producto = (numprod, referenciaTlm = "20193978") => ({ numprod, number: numprod, referenciaTlm, descripcion: "Cable PRYSMIAN", displayName: "Cable PRYSMIAN", codudmedida: "UD", inventory: 2 });
function Campo() {
  const [value, setValue] = useState(""), [item, setItem] = useState();
  const guardar = useCallback(p => setItem(p), []);
  return <><SelectorProducto label="Referencia" value={value} producto={item?.numprod === value ? item : undefined} onProducto={guardar} onChange={setValue} /><output aria-label="Código">{value}</output></>;
}
const escribir = texto => fireEvent.change(screen.getByRole("combobox"), { target: { value: texto } });
const avanzar = async () => act(async () => { jest.advanceTimersByTime(300); });
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); buscarProductos.mockResolvedValue({ articulos: [], hayMas: false }); });
afterEach(() => jest.useRealTimers());

test("mantiene el campo original y busca desde el tercer carácter con debounce", async () => {
  render(<StrictMode><Campo /></StrictMode>);
  const campo = screen.getByRole("combobox"); fireEvent.focus(campo);
  expect(campo.tagName).toBe("INPUT");
  expect(buscarProductos).not.toHaveBeenCalled();
  escribir("20"); await avanzar(); expect(buscarProductos).not.toHaveBeenCalled();
  escribir("201"); escribir("2019"); await avanzar();
  expect(buscarProductos).toHaveBeenCalledTimes(1);
  expect(buscarProductos).toHaveBeenCalledWith("2019");
});

test("la referencia 20193978 conserva su código interno al seleccionar y permite teclado", async () => {
  buscarProductos.mockResolvedValue({ articulos: [producto("ARTEL-TEST")], hayMas: false });
  render(<Campo />); fireEvent.focus(screen.getByRole("combobox")); escribir("20193978"); await avanzar();
  expect(screen.getByRole("option", { name: "20193978 · Cable PRYSMIAN" })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(screen.getByLabelText("Código")).toHaveTextContent("ARTEL-TEST");
  expect(screen.getByRole("combobox")).toHaveValue("20193978 · Cable PRYSMIAN");
  expect(obtenerProducto).not.toHaveBeenCalled();
});

test("ignora respuestas antiguas y muestra un aviso cuando hay más coincidencias", async () => {
  let anterior;
  buscarProductos.mockImplementation(texto => texto === "201" ? new Promise(resolve => { anterior = resolve; }) : Promise.resolve({ articulos: [producto("B", "20200000")], hayMas: true }));
  render(<Campo />); fireEvent.focus(screen.getByRole("combobox")); escribir("201"); await avanzar();
  escribir("202"); await avanzar();
  await act(async () => anterior({ articulos: [producto("A")], hayMas: false }));
  expect(screen.getByRole("option", { name: "20200000 · Cable PRYSMIAN" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "20193978 · Cable PRYSMIAN" })).not.toBeInTheDocument();
  expect(screen.getByText(/Hay más coincidencias/)).toBeInTheDocument();
});

test("un fallo termina la carga y no se disfraza como falta de coincidencias", async () => {
  buscarProductos.mockRejectedValue(new Error("El servidor necesita actualizarse"));
  render(<Campo />); fireEvent.focus(screen.getByRole("combobox")); escribir("201"); await avanzar();
  expect(screen.getByRole("alert")).toHaveTextContent("El servidor necesita actualizarse");
  expect(screen.queryByText("Buscando artículos…")).not.toBeInTheDocument();
  expect(screen.queryByText("Sin coincidencias")).not.toBeInTheDocument();
});

test("desmontar antes del debounce no consulta el servidor", async () => {
  const view = render(<Campo />); escribir("201"); view.unmount(); await avanzar();
  expect(buscarProductos).not.toHaveBeenCalled();
});
