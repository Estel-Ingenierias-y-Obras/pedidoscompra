import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import DiarioAlmacen from "./DiarioAlmacen";
import * as servicio from "../services/almacen";
jest.mock("../services/almacen", () => ({ obtenerUnidades: jest.fn(), obtenerMovimientosAplicables: jest.fn() }));
const nuevaFila = () => ({ solicitudId: "fila-1", estado: "borrador", numprod: "A", cantidad: "2", codudmedida: "M", tipoproyectocodigo: "INDIRECTO", modoMonetario: "bc", valorMonetario: "" });
const props = fila => ({ filas: [fila], productos: [{ numprod: "A", referenciaTlm: "TLM-A", descripcion: "Cable", codudmedida: "M" }, { numprod: "B", referenciaTlm: "TLM-B", descripcion: "Caja", codudmedida: "UD" }], tiposProyecto: [{ codigo: "INDIRECTO", nombre: "Estructura", bloqueado: false }, { codigo: "DIRECTO", nombre: "Obra", bloqueado: true }], cambiar: jest.fn(), quitar: jest.fn(), guardar: jest.fn(), corregir: jest.fn(), ocupado: false });
beforeEach(() => { jest.clearAllMocks(); servicio.obtenerUnidades.mockResolvedValue([{ codigo: "M", factor: 1 }]); servicio.obtenerMovimientosAplicables.mockResolvedValue([]); });

test("avisa de un material guardado fuera del catálogo y no permite enviarlo como selección vacía", async () => {
  const opciones = { ...props(nuevaFila()), productos: [] };
  render(<DiarioAlmacen {...opciones} />);
  await waitFor(() => expect(servicio.obtenerUnidades).toHaveBeenCalled());
  expect(screen.getByRole("alert")).toHaveTextContent("catálogo con referencia");
  expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeDisabled();
});
test("producto limpia unidad y movimiento; proyectos muestran nombres y respetan bloqueo", async () => {
  const opciones = props(nuevaFila());
  render(<DiarioAlmacen {...opciones} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).not.toBeDisabled());
  expect(screen.getByRole("option", { name: "Estructura (INDIRECTO)" })).toHaveValue("INDIRECTO");
  expect(screen.queryByRole("option", { name: "Obra (DIRECTO)" })).not.toBeInTheDocument();
  const buscador = screen.getByRole("combobox", { name: "Referencia, fila 1" });
  fireEvent.focus(buscador);
  fireEvent.change(buscador, { target: { value: "caja" } });
  expect(screen.queryByRole("option", { name: "TLM-A · Cable" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: "TLM-B · Caja" }));
  expect(opciones.cambiar).toHaveBeenCalledWith("fila-1", { numprod: "B", codudmedida: "", liqpornumorden: 0 });
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
  expect(servicio.obtenerUnidades).toHaveBeenCalledWith("B");
});
test("resultado incierto bloquea edición y eliminación y ofrece reintento", () => {
  const opciones = props({ ...nuevaFila(), estado: "incierta" });
  render(<DiarioAlmacen {...opciones} />);
  expect(screen.getByText("TLM-A")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Cantidad, fila 1")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado / Reintentar" }));
  expect(opciones.guardar).toHaveBeenCalledWith(opciones.filas[0]);
});

test("selecciona borradores desde cantidad y select sin alterar la edición", async () => {
  const opciones = { ...props(nuevaFila()), seleccionar: jest.fn() };
  const { rerender } = render(<DiarioAlmacen {...opciones} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a BC" })).toBeEnabled());
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  for (const celda of [screen.getByLabelText("Cantidad, fila 1"), screen.getByLabelText("Referencia, fila 1")]) {
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
  fireEvent.keyDown(screen.getByLabelText("Referencia, fila 1"), { key: " " });
  expect(opciones.seleccionar).not.toHaveBeenCalled();
  rerender(<DiarioAlmacen {...opciones} seleccion="bc-1" />);
  expect(fila).toHaveAttribute("aria-selected", "true");
  expect(fila).toHaveClass("bc-row-selected");
  expect(screen.getByRole("row", { name: "Borrador 1" })).toHaveAttribute("aria-selected", "false");
});

test("oculta campos calculados y selectores vacíos; oculta siempre los controles monetarios", async () => {
 servicio.obtenerUnidades.mockResolvedValue([]);
 const opciones = props({...nuevaFila(), codudmedida: ""});
 const {rerender} = render(<DiarioAlmacen {...opciones} />);
 await waitFor(() => expect(servicio.obtenerUnidades).toHaveBeenCalled());
 expect(screen.queryByRole("columnheader", {name: "Descripción"})).not.toBeInTheDocument();
 expect(screen.queryByRole("columnheader", {name: "Unidad"})).not.toBeInTheDocument();
 expect(screen.queryByRole("columnheader", {name: "Movimiento aplicado"})).not.toBeInTheDocument();
 expect(screen.queryByRole("columnheader", {name: "Precio unitario"})).not.toBeInTheDocument();
 rerender(<DiarioAlmacen {...opciones} filas={[{...opciones.filas[0], modoMonetario: "importe", valorMonetario: "0"}]} />);
 expect(screen.queryByLabelText("Importe, fila 1")).not.toBeInTheDocument();
 expect(screen.queryByRole("columnheader", {name: "Valores monetarios"})).not.toBeInTheDocument();
 expect(screen.queryByRole("columnheader", {name: "Coste unitario"})).not.toBeInTheDocument();
});

test("identifica el catálogo fallido y conserva las unidades cargadas sin permitir enviar", async () => {
 servicio.obtenerMovimientosAplicables.mockRejectedValue({response: {status: 404, data: {error: "API de movimientos no publicada"}}});
 render(<DiarioAlmacen {...props(nuevaFila())} />);
 expect(await screen.findByRole("alert")).toHaveTextContent("Movimientos aplicables: API de movimientos no publicada (HTTP 404)");
 expect(screen.queryByLabelText("Unidad, fila 1")).not.toBeInTheDocument();
 expect(screen.getByRole("button", {name: "Enviar a BC"})).toBeDisabled();
});
