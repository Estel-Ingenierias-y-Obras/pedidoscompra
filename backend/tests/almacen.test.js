const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const servicio = require("../services/almacen");
const Movimiento = require("../models/MovimientoAlmacen");
const Secuencia = require("../models/SecuenciaAlmacen");
const bc = require("../services/almacenBC");
const entrada = () => ({ solicitudId: "12345678-1234-1234-1234-123456789012", numeroProducto: "P001", unidadMedida: "UD", cantidad: 2, precioUnitario: 3, importe: 6, importeDto: 0, costeUnitario: 3, tipoMovimiento: "ajustePositivo", tipoProyecto: "Indirecto" });
afterEach(() => mock.restoreAll());
test("rechaza cantidades y tipos no soportados", () => {
  for (const cambio of [{ cantidad: 0 }, { cantidad: -1 }, { cantidad: "" }, { importe: Infinity }, { importe: null }, { tipoMovimiento: "ajusteNegativo" }, { tipoProyecto: "Otro" }, { unidadMedida: "" }]) {
    assert.throws(() => servicio.validarEntrada({ ...entrada(), ...cambio }), { status: 400 });
  }
});
test("guardado impone fecha, descripción BC, ubicación, departamento y estado", async () => {
  mock.method(Movimiento, "findOne", async () => null);
  mock.method(bc, "obtenerProductos", async () => [{ numero: "P001", descripcion: "Producto BC" }]);
  mock.method(bc, "comprobarAlmacen", async () => {});
  mock.method(Secuencia, "updateOne", async () => {});
  mock.method(Secuencia, "findOneAndUpdate", async () => ({ valor: 28 }));
  mock.method(Movimiento, "create", async datos => datos);
  const result = await servicio.crearEntrada({ ...entrada(), fechaRegistro: "2000-01-01", descripcion: "Manipulada", codigoAlmacen: "OTRO", departamento: "OTRO", estado: "registradoBC" }, { email: "test@example.com" });
  assert.equal(result.numeroDocumento, "T00028");
  assert.equal(result.descripcion, "Producto BC");
  assert.equal(result.codigoAlmacen, "CENTRAL 3");
  assert.equal(result.departamento, "SG-ALMACEN");
  assert.equal(result.estado, "pendienteBC");
  assert.notEqual(result.fechaRegistro, "2000-01-01");
});
test("reintento devuelve la entrada existente sin consultar BC", async () => {
  const existente = { ...entrada(), numeroDocumento: "T00028" };
  mock.method(Movimiento, "findOne", async () => existente);
  mock.method(bc, "obtenerProductos", async () => { throw new Error("No debería consultar BC"); });
  assert.equal(await servicio.crearEntrada(entrada(), {}), existente);
});
test("producto inexistente no consume numeración", async () => {
  mock.method(Movimiento, "findOne", async () => null);
  mock.method(bc, "obtenerProductos", async () => []);
  mock.method(bc, "comprobarAlmacen", async () => {});
  const contador = mock.method(Secuencia, "updateOne", async () => {});
  await assert.rejects(servicio.crearEntrada(entrada(), {}), { status: 400 });
  assert.equal(contador.mock.callCount(), 0);
});
