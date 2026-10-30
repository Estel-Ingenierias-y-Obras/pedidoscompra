const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCliente, clasificarError } = require("../services/almacenBC");
const standard = "https://example.test/api/v2.0/companies(company)";
test("catalogos comparte cargas completas, separa destino y mantiene stock fresco", async () => {
  let destino = standard;
  const urls = [];
  const cliente = crearCliente({ token: async () => "test", referencias: async () => [],
    config: () => ({ standard: destino, custom: destino }),
    request: async ({ url }) => {
      urls.push(url);
      const pagina = new URL(url).searchParams.has("$skiptoken");
      return { data: { value: [{ code: pagina ? "B" : "A" }],
        ...(!pagina ? { "@odata.nextLink": `${url}?$skiptoken=2` } : {}) } };
    }
  });
  const resultados = await Promise.all([cliente.obtenerAlmacenesMovimiento(), cliente.obtenerAlmacenesMovimiento()]);
  assert.deepEqual(resultados[0], [{ code: "A" }, { code: "B" }]);
  assert.equal(urls.length, 2);
  await cliente.obtenerAlmacenesMovimiento();
  assert.equal(urls.length, 2);
  destino = standard.replace("company", "otra");
  await cliente.obtenerAlmacenesMovimiento();
  assert.equal(urls.length, 4);
  await cliente.obtenerStock(); await cliente.obtenerStock();
  assert.equal(urls.length, 8);
});

test("catalogos no conserva errores ni paginas parciales", async () => {
  let falla = true, cargas = 0;
  const cliente = crearCliente({ token: async () => "test", config: () => ({ standard }), request: async ({ url }) => {
    cargas++;
    if (!new URL(url).searchParams.has("$skiptoken")) return { data: {
      value: [{ code: "A" }], "@odata.nextLink": `${url}?$skiptoken=2`
    } };
    if (falla) throw { response: { status: 403 } };
    return { data: { value: [{ code: "B" }] } };
  } });
  await assert.rejects(cliente.obtenerAlmacenesMovimiento());
  falla = false;
  assert.deepEqual(await cliente.obtenerAlmacenesMovimiento(), [{ code: "A" }, { code: "B" }]);
  assert.equal(cargas, 4);
});
test("un permiso denegado en acopios señala su conjunto de permisos correcto", () => {
  const error = { config: { url: "https://example.test/solicitudesAcopio" }, response: { status: 403, data: { error: { message: "TableData 60717 GM Acopio Request Insert" } } } };
  const info = clasificarError(error);
  assert.match(info.mensaje, /GM ACOPIO API/);
  assert.match(info.mensaje, /60717/);
  assert.equal(info.transitorio, false);
});
test("movimientos consulta todos los almacenes sin cambiar el filtro de Entradas", async () => {
  const urls = [];
  const bc = crearCliente({ referencias: async () => [], token: async () => "test", config: () => ({ standard }), request: async config => { urls.push(new URL(config.url)); return { data: { value: [] } }; } });
  await bc.obtenerAlmacenesMovimiento(); await bc.obtenerAlmacenes();
  assert.equal(urls[0].searchParams.has("$filter"), false);
  assert.equal(urls[1].searchParams.get("$filter"), "code eq 'CENTRAL 3'");
});
test("departamentos filtra por código de dimensión sin depender del enlace estándar incompleto", async () => {
  const urls = [];
  const bc = crearCliente({ referencias: async () => [], token: async () => "test", config: () => ({ custom: standard }), request: async config => {
    urls.push(config.url);
    return { data: { value: [{ dimension: "DEPART", codigo: "SG-ALMACEN", nombre: "Almacén" }] } };
  } });
  const valores = await bc.obtenerDepartamentos();
  assert.equal(valores[0].code, "SG-ALMACEN");
  assert.equal(new URL(urls[0]).searchParams.get("$filter"), "dimension eq 'DEPART'");
  assert.equal(new URL(urls[0]).pathname.endsWith("/valoresDimensionAcopio"), true);
});
test("articulos utiliza el catalogo compartido con referencia sin consultar items", async () => {
  let cargas = 0;
  const productos = [{ number: "P1", referenciaTlm: "REF-1" }];
  const bc = crearCliente({ materiales: async () => { cargas++; return productos; }, request: async () => { throw Error("No debe consultar items"); } });
  assert.deepEqual(await bc.obtenerArticulosMovimiento(), productos);
  assert.equal(cargas, 1);
});
