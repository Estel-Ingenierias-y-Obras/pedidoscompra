import { prepararEntrada, filaDesdeOperacion } from "./almacenPayload";
const fila = () => ({ solicitudId: "operacion", numprod: "1000", cantidad: "2", codudmedida: "", tipoproyectocodigo: "INDIRECTO", liqpornumorden: "", modoMonetario: "bc", valorMonetario: "" });
test.each(["bc", "preciounitario", "importe", "costeunitario"])("modo %s envía como máximo un monetario y excluye campos fijos", modoMonetario => {
  const body = prepararEntrada({ ...fila(), modoMonetario, valorMonetario: "0", numdoc: "T99999", importedto: 5, codalmacen: "OTRO", departamento: "OTRO", id: "id", claveintegracion: "no-enviar", preciounitario: 100, costeunitario: 200, importe: 300 });
  expect(body).toEqual({ solicitudId: "operacion", numprod: "1000", cantidad: 2, tipoproyectocodigo: "INDIRECTO", ...(modoMonetario === "bc" ? {} : { [modoMonetario]: 0 }) });
});
test("vacío no se convierte a cero y los valores opcionales se omiten", () => {
  expect(() => prepararEntrada({ ...fila(), modoMonetario: "importe" })).toThrow();
  expect(() => prepararEntrada({ ...fila(), cantidad: "" })).toThrow();
  const result = prepararEntrada(fila());
  expect(result).not.toHaveProperty("codudmedida");
  expect(result).not.toHaveProperty("liqpornumorden");
});
test("recuperar operación conserva cuerpo original, omisiones y cero", () => {
  const cuerpo = { claveintegracion: "uuid-backend", numprod: "1000", cantidad: 2, importe: 0 };
  const result = filaDesdeOperacion({ solicitudId: "op", cuerpo, estado: "incierta" });
  expect(result.cuerpoEnviado).toEqual({ solicitudId: "op", numprod: "1000", cantidad: 2, importe: 0 });
  expect(result.modoMonetario).toBe("importe");
  expect(result.valorMonetario).toBe(0);
});
