import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BuscadorMovimiento from "./BuscadorMovimiento";
const opciones = [{ codigo: "X1", nombre: "Tubo central" }, { codigo: "CENTRAL 3", nombre: "Almacén Palma" }, { codigo: "R1", nombre: "Martín Pérez" }];
function Campo() {
  const [valor, cambiar] = useState("");
  return <><BuscadorMovimiento label="Origen código" opciones={opciones} value={valor} onChange={cambiar} /><output aria-label="Código seleccionado">{valor}</output><button>Siguiente</button></>;
}
test("TAB completa la coincidencia relevante y avanza al campo siguiente", () => {
  render(<Campo />);
  const campo = screen.getByRole("combobox");
  userEvent.click(campo); userEvent.type(campo, "cent");
  expect(screen.getAllByRole("option")[0]).toHaveTextContent("CENTRAL 3");
  userEvent.tab();
  expect(screen.getByLabelText("Código seleccionado")).toHaveTextContent("CENTRAL 3");
  expect(campo).toHaveValue("CENTRAL 3 · Almacén Palma");
  expect(screen.getByRole("button", { name: "Siguiente" })).toHaveFocus();
});
test("encuentra nombres con tildes y permite flechas y Enter", () => {
  render(<Campo />); const campo = screen.getByRole("combobox");
  fireEvent.focus(campo); fireEvent.change(campo, { target: { value: "martin" } });
  expect(screen.getByRole("option")).toHaveTextContent("Martín Pérez");
  fireEvent.keyDown(campo, { key: "ArrowDown" }); fireEvent.keyDown(campo, { key: "Enter" });
  expect(screen.getByLabelText("Código seleccionado")).toHaveTextContent("R1");
});
test("texto sin coincidencias no selecciona un código inventado", () => {
  render(<Campo />); const campo = screen.getByRole("combobox");
  fireEvent.focus(campo); fireEvent.change(campo, { target: { value: "desconocido" } }); fireEvent.keyDown(campo, { key: "Tab" }); fireEvent.blur(campo);
  expect(screen.getByLabelText("Código seleccionado")).toBeEmptyDOMElement();
  expect(campo).toHaveValue("");
});
