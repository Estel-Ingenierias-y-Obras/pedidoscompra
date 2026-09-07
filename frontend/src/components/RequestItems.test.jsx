import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MaterialesContext } from "../context/MaterialesContext";
import {
  crearElementoVacio, elementosATexto, elementosTienenVariantesValidas,
  normalizarElementos, RequestItemsEditor, RequestItemsList
} from "./RequestItems";

jest.mock("../api", () => ({ get: jest.fn() }));

const materiales = [
  { _id: "mat-1", nombre: "Cable", referencia: "CAB-1", unidadMedida: "Metros", descripcion: "Cable fino" },
  { _id: "mat-2", nombre: "Cable", referencia: "CAB-2", unidadMedida: "Bobinas", descripcion: "Cable grueso" },
  { _id: "mat-3", nombre: "Tornillo", referencia: "TOR-1", unidadMedida: "Unidades", descripcion: "Tornillo M8" }
];

function Editor({ initial = [crearElementoVacio()], label }) {
  const [items, setItems] = useState(initial);
  return <MaterialesContext.Provider value={{ materiales }}>
    <RequestItemsEditor value={items} onChange={setItems} label={label} />
    <output data-testid="items">{JSON.stringify(normalizarElementos(items))}</output>
    <output data-testid="valid">{String(elementosTienenVariantesValidas(items))}</output>
  </MaterialesContext.Provider>;
}

const cambiar = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const datos = () => JSON.parse(screen.getByTestId("items").textContent);
const seleccionar = nombre => {
  fireEvent.focus(screen.getByRole("combobox", { name: "Material" }));
  fireEvent.click(screen.getByRole("option", { name: nombre }));
};

test.each(["Elementos solicitados", "Elementos urgentes", "Elementos planificables"])(
  "%s permite completar y serializar materiales libres", label => {
    render(<Editor label={label} />);
    cambiar("Material", "Pieza a medida");
    expect(screen.getByTestId("valid")).toHaveTextContent("false");
    cambiar("Referencia", " PIEZA-01 ");
    cambiar("U. medida", " Cajas ");
    cambiar("Cantidad", "2.5");
    cambiar("Observación", "Según plano");
    expect(screen.getByTestId("valid")).toHaveTextContent("true");
    expect(datos()[0]).toMatchObject({ materialId: null, elemento: "Pieza a medida", referencia: "PIEZA-01", unidadMedida: "Cajas", cantidad: 2.5, descripcion: "Según plano" });
    cambiar("Material", "Pieza a medida revisada");
    expect(screen.getByLabelText("Referencia")).toHaveValue(" PIEZA-01 ");
    expect(screen.getByLabelText("U. medida")).toHaveValue(" Cajas ");
  }
);

test("seleccionar catálogo autocompleta y cambiar a manual elimina los datos vinculados", () => {
  render(<Editor />);
  seleccionar("Tornillo");
  expect(screen.getByLabelText("Referencia").tagName).toBe("SELECT");
  expect(screen.getByLabelText("U. medida")).toHaveValue("Unidades");
  expect(datos()[0]).toMatchObject({ materialId: "mat-3", referencia: "TOR-1", descripcionMaterial: "Tornillo M8" });
  cambiar("Material", "Tornillo especial");
  expect(screen.getByLabelText("Referencia").tagName).toBe("INPUT");
  expect(datos()[0]).toMatchObject({ materialId: null, referencia: "", unidadMedida: "", descripcionMaterial: "" });
});

test("catálogo con varias referencias exige elegir una y actualiza la unidad", () => {
  render(<Editor />);
  seleccionar("Cable");
  expect(screen.getByLabelText("Referencia").tagName).toBe("SELECT");
  expect(screen.getByTestId("valid")).toHaveTextContent("false");
  cambiar("Referencia", "CAB-2");
  expect(datos()[0]).toMatchObject({ materialId: "mat-2", unidadMedida: "Bobinas" });
  cambiar("Referencia", "CAB-1");
  expect(datos()[0]).toMatchObject({ materialId: "mat-1", unidadMedida: "Metros" });
  expect(screen.getByTestId("valid")).toHaveTextContent("true");
});

test("un material manual guardado sigue siendo editable aunque coincida con un nombre del catálogo", () => {
  const manual = { ...crearElementoVacio(), elemento: "Cable", referencia: "LIBRE-1", unidadMedida: "Rollos", cantidad: 3, descripcion: "Especial" };
  const { unmount } = render(<Editor initial={normalizarElementos([manual])} />);
  expect(screen.getByLabelText("Referencia").tagName).toBe("INPUT");
  cambiar("U. medida", "Cajas");
  const guardados = datos();
  expect(elementosATexto(guardados)).toBe("Cable (LIBRE-1): 3 Cajas - Especial");
  unmount();
  render(<RequestItemsList elementos={guardados} />);
  expect(screen.getByText("LIBRE-1")).toBeInTheDocument();
  expect(screen.getByText("Cajas")).toBeInTheDocument();
  expect(screen.getByText("Especial")).toBeInTheDocument();
});

test("un material de catálogo guardado conserva sus desplegables al editar", () => {
  render(<Editor initial={[{ ...crearElementoVacio(), elemento: "Cable", materialId: "mat-2", referencia: "CAB-2", unidadMedida: "Bobinas" }]} />);
  expect(screen.getByLabelText("Referencia").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Referencia")).toHaveValue("CAB-2");
  expect(screen.getByLabelText("U. medida")).toHaveValue("Bobinas");
});
