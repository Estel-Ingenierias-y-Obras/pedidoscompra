import { fireEvent, render, screen } from "@testing-library/react";
import LineasMovimiento from "./LineasMovimiento";
test("muestra el catálogo completo sin búsqueda adicional ni límite de 50", () => {
  const articulos = Array.from({ length: 125 }, (_, n) => ({ id: String(n), number: `A${n}`, displayName: `Artículo ${n}` }));
  render(<LineasMovimiento lineas={[{ id: "L1", numprod: "", cantidad: "" }]} articulos={articulos} cambiar={() => {}} quitar={() => {}} />);
  const selector = screen.getByLabelText("Artículo línea 1");
  fireEvent.focus(selector); fireEvent.change(selector, { target: { value: "A124" } });
  expect(screen.getByRole("option", { name: "A124 · Artículo 124" })).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.queryByText(/resultados por búsqueda/)).not.toBeInTheDocument();
  expect(screen.getAllByRole("columnheader").map(el => el.textContent)).toEqual(["Nº artículo", "Descripción", "Inventario", "Cantidad disponible", "Cantidad", "Unidad de medida", "Acciones"]);
});
