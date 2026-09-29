import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import DiarioAlmacen from "./DiarioAlmacen";
import * as servicio from "../services/almacen";
jest.mock("../services/almacen", () => ({ obtenerUnidades: jest.fn(), obtenerMovimientosAplicables: jest.fn() }));
const nuevaFila = () => ({ solicitudId: "fila-1", estado: "borrador", numprod: "A", cantidad: "2", codudmedida: "", liqpornumorden: "", tipoproyectocodigo: "INDIRECTO", modoMonetario: "bc", valorMonetario: "" });
const props = fila => ({ filas: [fila], productos: [{ number: "A", displayName: "Cable", baseUnitOfMeasureCode: "M" }, { number: "B", displayName: "Caja", baseUnitOfMeasureCode: "UD" }], tiposProyecto: [{ codigo: "INDIRECTO", nombre: "Estructura", bloqueado: false }, { codigo: "DIRECTO", nombre: "Obra", bloqueado: true }], cambiar: jest.fn(), quitar: jest.fn(), guardar: jest.fn(), corregir: jest.fn(), ocupado: false });
beforeEach(() => { jest.clearAllMocks(); servicio.obtenerUnidades.mockResolvedValue([{ codigo: "M", factor: 1 }]); servicio.obtenerMovimientosAplicables.mockResolvedValue([]); });
test("producto limpia unidad y movimiento; proyectos muestran nombres y respetan bloqueo", async () => {
  const opciones = props(nuevaFila());
  render(<DiarioAlmacen {...opciones} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).not.toBeDisabled());
  expect(screen.getByRole("option", { name: "Estructura (INDIRECTO)" })).toHaveValue("INDIRECTO");
  expect(screen.queryByRole("option", { name: "Obra (DIRECTO)" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Nº producto, fila 1"), { target: { value: "B" } });
  expect(opciones.cambiar).toHaveBeenCalledWith("fila-1", { numprod: "B", codudmedida: "", liqpornumorden: "" });
  expect(screen.queryByLabelText("Importe dto., fila 1")).not.toBeInTheDocument();
});
test("respuesta antigua de catálogos no sobrescribe el producto actual", async () => {
  let resolverA;
  servicio.obtenerUnidades.mockImplementation(producto => producto === "A" ? new Promise(resolve => { resolverA = resolve; }) : Promise.resolve([{ codigo: "CAJA", factor: 10 }]));
  const opciones = props(nuevaFila());
  const { rerender } = render(<DiarioAlmacen {...opciones} />);
  rerender(<DiarioAlmacen {...opciones} filas={[{ ...nuevaFila(), numprod: "B", codudmedida: "CAJA" }]} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeEnabled());
  await act(async () => resolverA([{ codigo: "ANTIGUA", factor: 1 }]));
  expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeEnabled();
  expect(servicio.obtenerMovimientosAplicables).toHaveBeenCalledWith("B");
});
test("resultado incierto bloquea edición y eliminación y ofrece reintento", () => {
  const opciones = props({ ...nuevaFila(), estado: "incierta" });
  render(<DiarioAlmacen {...opciones} />);
  expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Cantidad, fila 1")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado / Reintentar" }));
  expect(opciones.guardar).toHaveBeenCalledWith(opciones.filas[0]);
});

test("selecciona borradores desde texto, cantidad y select sin alterar la edición", async () => {
  const opciones = { ...props(nuevaFila()), seleccionar: jest.fn() };
  const { rerender } = render(<DiarioAlmacen {...opciones} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeEnabled());
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  for (const celda of [screen.getByText("Cable"), screen.getByLabelText("Cantidad, fila 1"), screen.getByLabelText("Nº producto, fila 1")]) {
    opciones.seleccionar.mockClear();
    fireEvent.click(celda);
    expect(opciones.seleccionar).toHaveBeenCalledWith("fila-1");
  }
  const cantidad = screen.getByLabelText("Cantidad, fila 1");
  fireEvent.change(cantidad, { target: { value: "7" } });
  expect(opciones.cambiar).toHaveBeenCalledWith("fila-1", { cantidad: "7" });
  expect(opciones.guardar).not.toHaveBeenCalled();
  expect(opciones.quitar).not.toHaveBeenCalled();
  rerender(<DiarioAlmacen {...opciones} ocupado />);
  opciones.seleccionar.mockClear();
  fireEvent.pointerDown(screen.getByLabelText("Cantidad, fila 1"));
  expect(opciones.seleccionar).toHaveBeenCalledWith("fila-1");
  expect(screen.getByLabelText("Cantidad, fila 1")).toBeDisabled();
});

test("selecciona líneas BC por teclado y no intercepta teclas de los controles", async () => {
  const opciones = { ...props(nuevaFila()), seleccionar: jest.fn(), entradas: [{ id: "bc-1", numdoc: "DOC-1", descripcion: "Cable BC", cantidad: 2 }] };
  const { rerender } = render(<DiarioAlmacen {...opciones} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeEnabled());
  const fila = screen.getByRole("row", { name: "Documento DOC-1" });
  for (const key of ["Enter", " "]) {
    fireEvent.keyDown(fila, { key });
    expect(opciones.seleccionar).toHaveBeenLastCalledWith("bc-1");
  }
  opciones.seleccionar.mockClear();
  fireEvent.keyDown(screen.getByLabelText("Nº producto, fila 1"), { key: " " });
  expect(opciones.seleccionar).not.toHaveBeenCalled();
  rerender(<DiarioAlmacen {...opciones} seleccion="bc-1" />);
  expect(fila).toHaveAttribute("aria-selected", "true");
  expect(fila).toHaveClass("bc-row-selected");
  expect(screen.getByRole("row", { name: "Borrador 1" })).toHaveAttribute("aria-selected", "false");
});
