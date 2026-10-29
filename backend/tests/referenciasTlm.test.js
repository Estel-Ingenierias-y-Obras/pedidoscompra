const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCliente } = require("../services/almacenBC");
const { obtenerReferenciasTlm } = require("../services/businessCentral");

test("consulta las referencias TLM con todas sus páginas y solo los dos campos necesarios", async () => {
  const urls = [];
  const datos = await obtenerReferenciasTlm({
    env: { BC_TENANT_ID: "11111111-1111-4111-8111-111111111111", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_ENVIRONMENT: "test", BC_COMPANY_NAME: "Empresa" },
    token: async () => "test",
    request: async (url, options) => {
      assert.equal(options.headers.Prefer, "odata.maxpagesize=1000");
      urls.push(new URL(url));
      return { data: urls.length === 1 ? { value: [{ No: "A", Referencia_TLM: "REF-A" }], "@odata.nextLink": "?$skiptoken=2" } : { value: [{ No: "B", Referencia_TLM: "REF-B" }] } };
    }
  });
  assert.equal(urls[0].pathname.endsWith("/Ficha_producto_Excel"), true);
  assert.equal(urls[0].searchParams.get("$select"), "No,Referencia_TLM");
  assert.equal(urls[0].searchParams.get("$filter"), "Referencia_TLM ne ''");
  assert.deepEqual(datos.map(d => d.Referencia_TLM), ["REF-A", "REF-B"]);
});

test("une por número interno sin perder productos con referencias duplicadas o vacías", async () => {
  for (const metodo of ["obtenerProductos", "obtenerStock", "obtenerArticulosMovimiento"]) {
    const campo = metodo === "obtenerStock" ? "numprod" : "number";
    const bc = crearCliente({
      config: () => ({ standard: "https://bc.test/items", custom: "https://bc.test/custom" }), token: async () => "test",
      request: async () => ({ data: { value: ["A", "B", "C", "D"].map(numero => ({ [campo]: numero })) } }),
      referencias: async () => [{ No: "A", Referencia_TLM: " REF " }, { No: "B", Referencia_TLM: "REF" }, { No: "C", Referencia_TLM: "" }]
    });
    const productos = await bc[metodo]();
    assert.deepEqual(productos.map(p => p[campo]), ["A", "B", "C", "D"]);
    assert.deepEqual(productos.map(p => p.referenciaTlm), ["REF", "REF", "", ""]);
  }
});

test("un fallo al consultar referencias no se presenta como referencias vacías", async () => {
  const bc = crearCliente({ config: () => ({ custom: "https://bc.test/custom" }), token: async () => "test",
    request: async () => ({ data: { value: [{ numprod: "A" }] } }),
    referencias: async () => { throw new Error("Referencia no disponible"); }
  });
  await assert.rejects(bc.obtenerStock(), /Referencia no disponible/);
});
