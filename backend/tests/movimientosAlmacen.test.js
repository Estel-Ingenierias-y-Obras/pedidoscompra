const test = require("node:test");
const assert = require("node:assert/strict");
const { crearServicio, validarDTO } = require("../services/movimientosAlmacen");
const datos = () => ({ solicitudId: "18f1c681-7651-4b40-aef7-0f4481ec0402", tipoOperacion: "acopio", serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ id: "l1", numprod: "ART1", cantidad: 2 }] });
const crear = (cambios = {}) => crearServicio({ catalogos: { obtenerAlmacenesMovimiento: async () => [{ code: "A1" }], obtenerArticulosMovimiento: async () => [{ number: "ART1", baseUnitOfMeasureCode: "UD" }], obtenerDepartamentos: async () => [{ code: "D1" }], obtenerTiposProyecto: async () => [{ codigo: "INDIRECTO", bloqueado: false }], ...cambios }, recursos: async () => [{ codigo: "R1" }], proyectos: async () => ({ value: [{ nomProyecto: "P1" }] }) });
test("preparar obtiene la unidad de BC y no confirma escrituras ni registro", async () => {
  const cuerpo = datos(), resultado = await crear().preparar(cuerpo);
  assert.equal(resultado.solicitudId, cuerpo.solicitudId);
  assert.equal(resultado.enviadoBC, false); assert.equal(resultado.registrado, false);
  assert.equal(resultado.contratoALConfirmado, false);
  assert.deepEqual(resultado.propuestaBC.lineas, [{ idintegracion: "l1", numprod: "ART1", cantidad: 2, codudmedida: "UD" }]);
  assert.equal(resultado.propuestaBC.cabecera.serie, "ACO-ALM");
  assert.equal("numero" in resultado.propuestaBC.cabecera, false);
});
test("rechaza payload manipulado, precios y cantidades inválidas antes de consultar BC", () => {
  for (const cantidad of [-1, 0, Infinity, "2", null]) assert.throws(() => validarDTO({ ...datos(), lineas: [{ id: "l1", numprod: "ART1", cantidad }] }));
  assert.throws(() => validarDTO({ ...datos(), lineas: [{ ...datos().lineas[0], precio: 5 }] }));
  assert.throws(() => validarDTO({ ...datos(), numero: "ACO-ALM" }));
  assert.throws(() => validarDTO({ ...datos(), lineas: [datos().lineas[0], datos().lineas[0]] }));
});
test("revalida los catálogos y muestra errores sin fabricar una preparación correcta", async () => {
  await assert.rejects(crear({ obtenerArticulosMovimiento: async () => [] }).preparar(datos()), /artículo/);
  await assert.rejects(crear({ obtenerDepartamentos: async () => [] }).preparar(datos()), /departamento/);
  await assert.rejects(crear().preparar({ ...datos(), cabecera: { ...datos().cabecera, solicitante: "BAJA" } }), /activo/);
});
test("envío y registro quedan bloqueados hasta existir contrato AL", async () => {
  await assert.rejects(crear().enviar(datos()), { status: 501, codigo: "ACOPIO_CREACION_NO_DISPONIBLE" });
  await assert.rejects(crear().registrar({ id: datos().solicitudId, claveintegracion: datos().solicitudId }), { status: 501, codigo: "ACOPIO_REGISTRO_NO_DISPONIBLE" });
});
