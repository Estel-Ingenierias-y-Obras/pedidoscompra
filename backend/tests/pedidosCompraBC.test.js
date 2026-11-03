const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCliente } = require("../services/pedidosCompraBC");
const raiz = () => "https://example.test/api/companies(x)";
const token = async () => "token-prueba";
test("carga sin año y busca por nombre sin distinguir mayúsculas antes de paginar", async () => {
  let params;
  const cliente = crearCliente({ raiz, token, request: async config => {
    params = new URL(config.url).searchParams;
    return { data: { value: [], "@odata.count": 230 } };
  } });
  await cliente.listar();
  assert.equal(params.get("$filter"), "documentType eq 'Order'");
  assert.equal(params.get("$top"), "100");
  await cliente.listar({ buscar: "  O'BRIEN  ", pagina: 2 });
  assert.equal(params.get("$filter"), "documentType eq 'Order' and contains(tolower(number),'o''brien')");
  assert.equal(params.get("$skip"), "100");
});
test("filtra proyecto, número y estado en BC antes de paginar de 100 en 100", async () => {
  let solicitud;
  const cliente = crearCliente({ raiz, token, request: async config => { solicitud = config; return { data: { value: [], "@odata.count": 345 } }; } });
  const resultado = await cliente.listar({ anio: "2026", pagina: "3", proyecto: "OB'RA", numero: "PC", estado: "Open" });
  const params = new URL(solicitud.url).searchParams;
  assert.equal(params.get("$top"), "100"); assert.equal(params.get("$skip"), "200");
  assert.equal(params.get("$filter"), "documentType eq 'Order' and contains(Proyecto,'OB''RA') and contains(number,'PC') and Estado eq 'Open'");
  assert.equal(resultado.paginas, 4);
});
test("rechaza búsquedas y páginas inválidas y estados desconocidos antes de consultar BC", async () => {
  const cliente = crearCliente({ raiz, token, request: async () => { throw Error("No debe consultar"); } });
  for (const query of [{ pagina: "0" }, { buscar: ["texto"] }, { buscar: "x".repeat(101) }, { estado: "cualquiera" }]) await assert.rejects(cliente.listar(query), { status: 400 });
});
test("rechaza nextLink externo sin enviar credenciales", async () => {
  let llamadas = 0;
  const cliente = crearCliente({ raiz, token, request: async () => { llamadas++; return { data: { value: [], "@odata.count": 1, "@odata.nextLink": "https://otro.test/api/companies(x)/purchaseHeadersDetailed" } }; } });
  await assert.rejects(cliente.listar({ anio: "2026" }), { status: 502 });
  assert.equal(llamadas, 1);
});
test("ordena todos los pedidos en BC antes de paginar y valida columnas", async () => {
  let params;
  const cliente = crearCliente({ raiz, token, request: async config => {
    params = new URL(config.url).searchParams;
    return { data: { value: [], "@odata.count": 500 } };
  } });
  for (const direccion of ["asc", "desc"]) {
    await cliente.listar({ anio: "2000", pagina: 2, ordenar: "Proyecto", direccion });
    assert.equal(params.get("$orderby"), `Proyecto ${direccion},number asc`);
    assert.equal(params.get("$skip"), "100");
  }
  for (const query of [{ anio: "2026", ordenar: "desconocido" }, { anio: "2026", direccion: "invalida" }]) await assert.rejects(cliente.listar(query), { status: 400 });
});
test("solo consulta las líneas del pedido seleccionado y conserva referencia e inventario", async () => {
  const cliente = crearCliente({ raiz, token, articulo: async () => ({ articulos: [{ referenciaTlm: "REF-1", inventory: 12, baseUnitOfMeasureCode: "UD" }] }), request: async config => {
    assert.equal(new URL(config.url).searchParams.get("$filter"), "documentType eq 'Order' and PC eq 'PC001'");
    return { data: { value: [{ lineNumber: 10000, lineType: "Item", Referencia: "1000", Cantidad: 2 }] } };
  } });
  const lineas = await cliente.lineas("PC001");
  assert.equal(lineas[0].inventario, 12); assert.equal(lineas[0].referencia, "REF-1");
});
