import { fireEvent, render, screen } from "@testing-library/react";
import DiarioAlmacen from "./DiarioAlmacen";

test("selección de producto rellena descripción y unidad; campos fijos no son editables", () => {
  const cambiar = jest.fn();
  const guardar = jest.fn();
  const fila = { solicitudId: "fila-1", fechaRegistro: "2026-09-25", tipoMovimiento: "ajustePositivo", numeroProducto: "", descripcion: "", codigoAlmacen: "CENTRAL 3", cantidad: "", unidadMedida: "", precioUnitario: "0", importe: "0", importeDto: "0", costeUnitario: "0", liquidacionOrden: "", tipoProyecto: "Indirecto", departamento: "SG-ALMACEN" };
  render(<DiarioAlmacen filas={[fila]} productos={[{ numero: "P001", descripcion: "Cable", unidadMedida: "M" }]} configuracion={{ tiposMovimiento: [{ valor: "ajustePositivo", etiqueta: "Ajuste Positivo" }], tiposProyecto: ["Directo", "Indirecto", "Grupo"] }} cambiar={cambiar} quitar={jest.fn()} guardar={guardar} ocupado={false} />);
  fireEvent.change(screen.getByLabelText("Nº producto, fila 1"), { target: { value: "P001" } });
  expect(cambiar).toHaveBeenCalledWith("fila-1", { numeroProducto: "P001", descripcion: "Cable", unidadMedida: "M" });
  expect(screen.getByText("CENTRAL 3")).toBeInTheDocument();
  expect(screen.queryByLabelText("Cód. almacén, fila 1")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Descripción, fila 1")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Tipo proyecto código, fila 1")).toHaveValue("Indirecto");
  fireEvent.click(screen.getByRole("button", { name: "Guardar fila 1" }));
  expect(guardar).toHaveBeenCalledWith(fila);
});
