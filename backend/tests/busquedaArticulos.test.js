const test = require("node:test");
const assert = require("node:assert/strict");
const { buscarArticulos } = require("../services/businessCentral");
const env = { BC_TENANT_ID: "11111111-1111-4111-8111-111111111111", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_ENVIRONMENT: "test", BC_COMPANY_NAME: "Empresa" };
const item = (No = "P1", extra = {}) => ({ No, Referencia_TLM: "REF-1", Description: "Cable", Base_Unit_of_Measure: "UD", Blocked: false, Type: "Inventory", ...extra });
const opciones = request => ({ env, token: async () => "test", request });

test("abrir o escribir menos de tres caracteres no consulta BC; rechaza tipos e inyecciones de parámetros", async () => {
  let llamadas = 0;
  const opts = opciones(async () => { llamadas++; throw new Error("no consultar"); });
  for (const busqueda of ["", "ca", "  "]) assert.deepEqual(await buscarArticulos({ ...opts, busqueda }), { articulos: [], hayMas: false });
  for (const busqueda of [null, ["cab"], "x".repeat(101), "cab\n"]) await assert.rejects(buscarArticulos({ ...opts, busqueda }), error => error.status === 400);
  assert.equal(llamadas, 0);
});

test("busca referencia, descripción y código sin OR incompatible ni Inventory y limita veinte artículos", async () => {
  const urls = [];
  const resultado = await buscarArticulos({ busqueda: "C'AB", ...opciones(async url => {
    const consulta = new URL(url); urls.push(consulta);
    return { data: { value: Array.from({ length: 21 }, (_, i) => item(`P${i}`)), "@odata.nextLink": "?$skiptoken=no-se-debe-descargar" } };
  }) });
  assert.equal(urls.length, 4);
  for (const url of urls) {
    assert.ok(["2", "21"].includes(url.searchParams.get("$top")));
    assert.equal(url.searchParams.get("$schemaversion"), "2.1");
    assert.equal(url.searchParams.get("$select").includes("Inventory"), false);
    assert.equal(url.searchParams.get("$filter").includes(" or "), false);
    assert.match(url.searchParams.get("$filter"), /'c''ab'/);
  }
  assert.equal(resultado.articulos.length, 20);
  assert.equal(resultado.hayMas, true);
});

test("sigue páginas pequeñas hasta el límite y deduplica por número interno, nunca por referencia", async () => {
  let llamadas = 0;
  const resultado = await buscarArticulos({ busqueda: "cab", ...opciones(async url => {
    llamadas++;
    if (!new URL(url).searchParams.has("$skiptoken") && !new URL(url).searchParams.get("$filter")?.includes("contains(") && !new URL(url).searchParams.get("$filter")?.includes("startswith(")) return { data: { value: [] } };
    return { data: new URL(url).searchParams.has("$skiptoken") ? { value: [item("P2")] }
      : { value: [item("P1")], "@odata.nextLink": "?$skiptoken=2" } };
  }) });
  assert.equal(llamadas, 7);
  assert.deepEqual(resultado.articulos.map(p => p.number), ["P1", "P2"]);
  assert.equal(resultado.hayMas, false);
});

test("una referencia exacta se encuentra con cualquier capitalización sin quedar fuera del límite parcial", async () => {
  let llamadas = 0;
  const resultado = await buscarArticulos({ busqueda: "aRt001", ...opciones(async url => {
    llamadas++;
    const filtro = new URL(url).searchParams.get("$filter");
    return { data: { value: filtro.includes("tolower(Referencia_TLM) eq") ? [item("INTERNO-99", { Referencia_TLM: "ART001", Description: "Tubo PVC" })] : [] } };
  }) });
  assert.equal(llamadas, 4);
  assert.equal(resultado.articulos[0].number, "INTERNO-99");
  assert.equal(resultado.articulos[0].referenciaTlm, "ART001");
  assert.equal(resultado.hayMas, false);
});

test("un número interno exacto aparece primero aunque la referencia TLM sea distinta y haya muchas coincidencias", async () => {
  const filtros = [];
  const resultado = await buscarArticulos({ busqueda: "ART001", ...opciones(async url => {
    const filtro = new URL(url).searchParams.get("$filter"); filtros.push(filtro);
    if (filtro.includes("tolower(Referencia_TLM) eq")) return { data: { value: [] } };
    if (filtro.includes("startswith(tolower(No)")) return { data: { value: [item("ART001", { Referencia_TLM: "REF-PROVEEDOR", Description: "Tubo PVC" })] } };
    return { data: { value: Array.from({ length: 21 }, (_, n) => item(`P${n}`, { Referencia_TLM: `ART001-${n}` })) } };
  }) });
  assert.equal(filtros.length, 4);
  assert.equal(resultado.articulos.length, 20);
  assert.equal(resultado.articulos[0].number, "ART001");
  assert.equal(resultado.articulos[0].referenciaTlm, "REF-PROVEEDOR");
  assert.equal(resultado.hayMas, true);
});

test("busca la descripción aunque ninguna referencia contenga PVC", async () => {
  const resultado = await buscarArticulos({ busqueda: "PVC", ...opciones(async url => ({ data: { value:
    new URL(url).searchParams.get("$filter").includes("contains(tolower(Description)")
      ? [item("P1", { Referencia_TLM: "ART001", Description: "Tubo PVC Ø20" })] : []
  } })) });
  assert.deepEqual(resultado.articulos.map(p => p.referenciaTlm), ["ART001"]);
});

test("un error de página no devuelve resultados parciales y rechaza ciclos y enlaces ajenos", async () => {
  for (const siguiente of ["https://otro.test/items", "?repetido=1"]) {
    let llamadas = 0;
    await assert.rejects(buscarArticulos({ busqueda: "cab", ...opciones(async () => {
      llamadas++;
      return { data: { value: [item()], "@odata.nextLink": siguiente } };
    }) }));
    assert.ok(llamadas <= 8);
  }
  await assert.rejects(buscarArticulos({ busqueda: "cab", ...opciones(async () => { throw new Error("BC no disponible"); }) }), /BC no disponible/);
});

test("recupera exclusivamente el código guardado con su inventario; mantiene filtros de elegibilidad", async () => {
  let consulta;
  const resultado = await buscarArticulos({ numero: "A'B", ...opciones(async url => {
    consulta = new URL(url);
    return { data: { value: [item("A'B", { Inventory: -2 })] } };
  }) });
  assert.match(consulta.searchParams.get("$filter"), /No eq 'A''B'/);
  assert.match(consulta.searchParams.get("$filter"), /Blocked eq false/);
  assert.equal(consulta.searchParams.get("$top"), "2");
  assert.match(consulta.searchParams.get("$select"), /Inventory/);
  assert.equal(resultado.articulos[0].inventory, -2);
  const vacio = await buscarArticulos({ numero: "P1", ...opciones(async () => ({ data: { value: [item("P1", { Inventory: 1, Blocked: true })] } })) });
  assert.deepEqual(vacio.articulos, []);
});
