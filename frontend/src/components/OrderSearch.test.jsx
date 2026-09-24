import { act, fireEvent, render, screen } from "@testing-library/react";
import OrderSearch, { predecirOpcion } from "./OrderSearch";

const opciones = [
  { id: "p1", tipo: "Proyecto", label: "P1 - Energía Mallorca", terminos: ["Energía Mallorca", "P1"] },
  { id: "p2", tipo: "Proyecto", label: "P2 - Energía Ibiza", terminos: ["Energía Ibiza", "P2"] },
  { id: "u1", tipo: "Solicitante", label: "Juan Pérez" }
];

test("prioriza inicio, exactitud dentro del prefijo y luego coincidencia parcial", () => {
  expect(predecirOpcion(opciones, "ENER").opcion.id).toBe("p1");
  expect(predecirOpcion(opciones, "ibiza").opcion.id).toBe("p2");
  expect(predecirOpcion(opciones, "p2").opcion.id).toBe("p2");
  expect(predecirOpcion(opciones, "perez").opcion.id).toBe("u1");
  const extra = [...opciones, { id: "exacta", tipo: "Solicitante", label: "Ener" }];
  expect(predecirOpcion(extra, "ener").opcion.id).toBe("exacta");
  expect(predecirOpcion([...opciones].reverse(), "ener").opcion.id).toBe("p1");
  expect(predecirOpcion(opciones, "")).toBeNull();
  expect(predecirOpcion(opciones, "xyz")).toBeNull();
});

test("texto gris sin desplegable y aceptación con Tab; Shift+Tab mantiene navegación", () => {
  const onChange = jest.fn();
  const { container } = render(<OrderSearch opciones={opciones} onChange={onChange} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Ener" } });
  expect(input).toHaveValue("Ener");
  expect(container.querySelector(".order-search-ghost")).toHaveTextContent("Energía Mallorca");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(false);
  expect(onChange).toHaveBeenCalledWith("p1");
});

test("sin sugerencia Tab no se intercepta; Escape, edición intermedia y composición ocultan la predicción", () => {
  const onChange = jest.fn();
  render(<OrderSearch opciones={opciones} onChange={onChange} />);
  const input = screen.getByRole("textbox");
  expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
  fireEvent.change(input, { target: { value: "Ener" } });
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  input.setSelectionRange(1, 1);
  act(() => fireEvent.select(input));
  expect(screen.queryByRole("button", { name: /Completar/ })).not.toBeInTheDocument();
  input.setSelectionRange(4, 4);
  act(() => fireEvent.select(input));
  fireEvent.keyDown(input, { key: "Escape" });
  expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
});

test("permite aceptar una coincidencia parcial con Enter sin botones", () => {
  const onChange = jest.fn();
  render(<OrderSearch opciones={opciones} onChange={onChange} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "mallorca" } });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith("p1");
});
