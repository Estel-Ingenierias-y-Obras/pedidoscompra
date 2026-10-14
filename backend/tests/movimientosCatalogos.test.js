const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCliente } = require("../services/almacenBC");
const standard = "https://example.test/api/v2.0/companies(company)";
test("movimientos consulta todos los almacenes sin cambiar el filtro de Entradas", async () => {
  const urls = [];
  const bc = crearCliente({ token: async () => "test", config: () => ({ standard }), request: async config => { urls.push(new URL(config.url)); return { data: { value: [] } }; } });
  await bc.obtenerAlmacenesMovimiento(); await bc.obtenerAlmacenes();
  assert.equal(urls[0].searchParams.has("$filter"), false);
  assert.equal(urls[1].searchParams.get("$filter"), "code eq 'CENTRAL 3'");
});
test("departamentos resuelve el ID de la dimensión y no envía propiedades no soportadas", async () => {
  const id = "80054f9a-643a-ed11-946f-000d3aa8196a", urls = [];
  const bc = crearCliente({ token: async () => "test", config: () => ({ standard }), request: async config => {
    urls.push(config.url);
    return { data: { value: urls.length === 1 ? [{ id, code: "DEPART" }] : [{ code: "D1", displayName: "Departamento" }] } };
  } });
  assert.deepEqual(await bc.obtenerDepartamentos(), [{ code: "D1", displayName: "Departamento" }]);
  assert.equal(urls[1], `${standard}/dimensions(${id})/dimensionValues`);
});
test("artículos sigue la paginación completa y solo excluye bloqueados y tipos sin inventario", async () => {
  const urls = [];
  const bc = crearCliente({ token: async () => "test", config: () => ({ standard }), request: async config => {
    urls.push(new URL(config.url));
    return { data: urls.length === 1 ? { value: [{ number: "P1" }], "@odata.nextLink": "?$skiptoken=segunda" } : { value: [{ number: "P2" }] } };
  } });
  assert.deepEqual(await bc.obtenerArticulosMovimiento(), [{ number: "P1" }, { number: "P2" }]);
  assert.equal(urls[0].searchParams.get("$filter"), "blocked eq false and type eq 'Inventory'");
  assert.equal(urls[0].searchParams.has("$top"), false);
  assert.equal(urls[1].searchParams.get("$skiptoken"), "segunda");
});
