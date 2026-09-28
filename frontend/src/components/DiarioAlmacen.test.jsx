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
  await waitFor(() => expect(screen.getByLabelText("Cód. unidad medida, fila 1")).not.toBeDisabled());
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
  rerender(<DiarioAlmacen {...opciones} filas={[{ ...nuevaFila(), numprod: "B" }]} />);
  await screen.findByRole("option", { name: "CAJA · factor 10" });
  await act(async () => resolverA([{ codigo: "ANTIGUA", factor: 1 }]));
  expect(screen.queryByRole("option", { name: /ANTIGUA/ })).not.toBeInTheDocument();
  expect(servicio.obtenerMovimientosAplicables).toHaveBeenCalledWith("B");
});
test("resultado incierto bloquea edición y eliminación y ofrece reintento", () => {
  const opciones = props({ ...nuevaFila(), estado: "incierta" });
  render(<DiarioAlmacen {...opciones} />);
  expect(screen.queryByRole("button", { name: /Quitar/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Cantidad, fila 1")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado / Reintentar" }));
  expect(opciones.guardar).toHaveBeenCalledWith(opciones.filas[0]);
});
