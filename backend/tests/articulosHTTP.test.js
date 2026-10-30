const { test, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const auth = require("../middleware/auth");
const bc = require("../services/almacenBC");
const odata = require("../services/businessCentral");
auth.obtenerUsuarioActual = (req, res, next) => {
  const rol = req.get("x-test-role");
  if (!rol) return res.sendStatus(401);
  req.usuarioActual = { rol, email: "test@example.invalid" }; next();
};
const app = express();
app.use("/api/almacen", require("../routes/almacen"));
let server, base;
before(async () => {
  server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/almacen`;
});
after(() => server.close());
afterEach(() => mock.restoreAll());
test("buscar mantiene autenticación y permisos de almacén", async () => {
  const consulta = mock.method(odata, "buscarArticulos", async () => ({ articulos: [], hayMas: false }));
  assert.equal((await fetch(`${base}/articulos?buscar=cab`)).status, 401);
  assert.equal((await fetch(`${base}/articulos?buscar=cab`, { headers: { "x-test-role": "Usuario" } })).status, 403);
  assert.equal(consulta.mock.callCount(), 0);
  const respuesta = await fetch(`${base}/articulos?buscar=cab`, { headers: { "x-test-role": "Admin" } });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { articulos: [], hayMas: false });
  assert.deepEqual(consulta.mock.calls[0].arguments, [{ busqueda: "cab" }]);
});
test("catálogos de acopio devuelve todos los artículos para el selector local", async () => {
  const lista = Array.from({ length: 125 }, (_, n) => ({ number: `P${n}`, referenciaTlm: `REF-${n}` }));
  const articulos = mock.method(bc, "obtenerArticulosMovimiento", async () => lista);
  for (const metodo of ["obtenerAlmacenesMovimiento", "obtenerDepartamentos", "obtenerTiposProyecto", "obtenerZonas"]) mock.method(bc, metodo, async () => []);
  mock.method(odata, "obtenerSolicitantesActivos", async () => []);
  const respuesta = await fetch(`${base}/movimientos/catalogos`, { headers: { "x-test-role": "Admin" } });
  const datos = await respuesta.json();
  assert.equal(respuesta.status, 200);
  assert.deepEqual(datos.articulos, lista);
  assert.deepEqual(datos.errores, {});
  assert.equal(articulos.mock.callCount(), 1);
});

test("productos conserva el endpoint original y permite consultar solo el inventario de un artículo", async () => {
  const catalogo = mock.method(bc, "obtenerProductos", async () => [{ numprod: "A", referenciaTlm: "20193978" }]);
  const detalle = mock.method(odata, "buscarArticulos", async () => ({ articulos: [{ numprod: "A", inventory: 2 }], hayMas: false }));
  const headers = { "x-test-role": "Admin" };
  assert.deepEqual(await (await fetch(`${base}/productos`, { headers })).json(), [{ numprod: "A", referenciaTlm: "20193978" }]);
  assert.deepEqual(await (await fetch(`${base}/productos?numprod=A`, { headers })).json(), [{ numprod: "A", inventory: 2 }]);
  assert.equal(catalogo.mock.callCount(), 1);
  assert.deepEqual(detalle.mock.calls[0].arguments, [{ numero: "A" }]);
});

test("productos busca desde tres caracteres y anuncia la capacidad sin descargar un catálogo", async () => {
  const catalogo = mock.method(bc, "obtenerProductos", async () => { throw Error("No descargar catálogo"); });
  const busqueda = mock.method(odata, "buscarArticulos", async datos => ({ articulos: [], hayMas: false }));
  const headers = { "x-test-role": "Admin" };
  assert.equal((await (await fetch(`${base}/configuracion`, { headers })).json()).busquedaProductos, true);
  const respuesta = await fetch(`${base}/productos?buscar=201`, { headers });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { articulos: [], hayMas: false });
  assert.deepEqual(busqueda.mock.calls[0].arguments, [{ busqueda: "201" }]);
  assert.equal(catalogo.mock.callCount(), 0);
});

test("acopio permite cargar auxiliares sin consultar artículos", async () => {
  const articulos = mock.method(bc, "obtenerArticulosMovimiento", async () => { throw Error("No descargar catálogo"); });
  for (const metodo of ["obtenerAlmacenesMovimiento", "obtenerDepartamentos", "obtenerTiposProyecto", "obtenerZonas"]) mock.method(bc, metodo, async () => []);
  mock.method(odata, "obtenerSolicitantesActivos", async () => []);
  const respuesta = await fetch(`${base}/movimientos/catalogos?sinArticulos=1`, { headers: { "x-test-role": "Admin" } });
  assert.equal(respuesta.status, 200);
  assert.deepEqual((await respuesta.json()).articulos, []);
  assert.equal(articulos.mock.callCount(), 0);
});
