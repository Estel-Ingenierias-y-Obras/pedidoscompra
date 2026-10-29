import { fireEvent, render, screen } from "@testing-library/react";
import LineasMovimiento from "./LineasMovimiento";
test("muestra el catálogo completo sin búsqueda adicional ni límite de 50", () => {
  const articulos = Array.from({ length: 125 }, (_, n) => ({ id: String(n), number: `A${n}`, referenciaTlm: `TLM${n}`, displayName: `Artículo ${n}` }));
  render(<LineasMovimiento lineas={[{ id: "L1", numprod: "", cantidad: "" }]} articulos={articulos} cambiar={() => {}} quitar={() => {}} />);
  const selector = screen.getByLabelText("Artículo línea 1");
  fireEvent.focus(selector); fireEvent.change(selector, { target: { value: "TLM124" } });
  expect(screen.getByRole("option", { name: "TLM124 · Artículo 124" })).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.queryByText(/resultados por búsqueda/)).not.toBeInTheDocument();
  expect(screen.getAllByRole("columnheader").map(el => el.textContent)).toEqual(["Referencia", "Descripción", "Inventario", "Cantidad disponible", "Cantidad", "Unidad de medida", "Acciones"]);
});

test("referencias duplicadas mantienen la selección del número interno correcto", () => {
  const cambiar = jest.fn();
  render(<LineasMovimiento lineas={[{ id: "L1", numprod: "", cantidad: "" }]}
    articulos={[{ number: "INTERNO-A", referenciaTlm: "REF-1", displayName: "Cable fino" }, { number: "INTERNO-B", referenciaTlm: "REF-1", displayName: "Cable grueso" }]}
    cambiar={cambiar} quitar={() => {}} />);
  const input = screen.getByLabelText("Artículo línea 1");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "REF-1" } });
  fireEvent.click(screen.getByRole("option", { name: "REF-1 · Cable grueso" }));
  expect(cambiar).toHaveBeenCalledWith("L1", { numprod: "INTERNO-B", cantidad: "" });
  expect(input).toHaveValue("REF-1 · Cable grueso");
});
