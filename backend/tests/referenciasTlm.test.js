const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCliente } = require("../services/almacenBC");
const { obtenerReferenciasTlm, obtenerMaterialesConReferencia } = require("../services/businessCentral");

test("consulta las referencias TLM con todas sus páginas y solo los dos campos necesarios", async () => {
  const urls = [];
  const datos = await obtenerReferenciasTlm({
    env: { BC_TENANT_ID: "11111111-1111-4111-8111-111111111111", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_ENVIRONMENT: "test", BC_COMPANY_NAME: "Empresa" },
    token: async () => "test",
    request: async (url, options) => {
      assert.equal(options.headers.Prefer, "odata.maxpagesize=5000");
      assert.ok(options.timeout > 15000 && options.timeout <= 30000);
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
  for (const metodo of ["obtenerStock"]) {
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

test("stock consulta solo las referencias de sus productos y evita consultar el catálogo vacío", async () => {
  const consultas = [];
  let productos = [{ numprod: "A" }];
  const bc = crearCliente({ config: () => ({ custom: "https://bc.test/custom" }), token: async () => "test",
    request: async () => ({ data: { value: productos } }),
    referencias: async numeros => { consultas.push(numeros); return []; }
  });
  await bc.obtenerStock();
  productos = [];
  await bc.obtenerStock();
  assert.deepEqual(consultas, [["A"]]);
});

test("filtra referencias pequeñas por los números internos y escapa las comillas", async () => {
  let filtro;
  await obtenerReferenciasTlm({ numeros: ["A'B", "C"], token: async () => "test",
    env: { BC_TENANT_ID: "11111111-1111-4111-8111-111111111111", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_ENVIRONMENT: "test", BC_COMPANY_NAME: "Empresa" },
    request: async url => { filtro = new URL(url).searchParams.get("$filter"); return { data: { value: [] } }; }
  });
  assert.equal(filtro, "Referencia_TLM ne '' and (No eq 'A''B' or No eq 'C')");
});

test("el timeout de referencias devuelve un error recuperable y no un catálogo vacío", async () => {
  await assert.rejects(obtenerReferenciasTlm({ token: async () => "test",
    env: { BC_TENANT_ID: "11111111-1111-4111-8111-111111111111", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_ENVIRONMENT: "test", BC_COMPANY_NAME: "Empresa" },
    request: async () => { throw Object.assign(new Error("timeout"), { code: "ECONNABORTED" }); }
  }), error => error.status === 504 && error.seguro === true && error.message.includes("Actualizar datos"));
});

test("el catálogo filtra en BC y descarta referencias vacías, espacios, bloqueados y no inventariables", async () => {
  const base = { No: "P1", Referencia_TLM: " REF-1 ", Description: "Cable", Base_Unit_of_Measure: "UD", Inventory: 3, Blocked: false, Type: "Inventory" };
  let consulta;
  const productos = await obtenerMaterialesConReferencia({ token: async () => "test",
    env: { BC_TENANT_ID: "11111111-1111-4111-8111-111111111111", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_ENVIRONMENT: "test", BC_COMPANY_NAME: "Empresa" },
    request: async url => {
      consulta = new URL(url);
      return { data: { value: [base, { ...base, No: "P2", Referencia_TLM: "" }, { ...base, No: "P3", Referencia_TLM: "   " },
        { ...base, No: "P4", Blocked: true }, { ...base, No: "P5", Type: "Service" }, { ...base, No: "P6", Referencia_TLM: "REF-1" }] } };
    }
  });
  assert.equal(consulta.searchParams.get("$filter"), "Referencia_TLM ne '' and Blocked eq false and Type eq 'Inventory'");
  assert.equal(consulta.searchParams.get("$select"), "No,Referencia_TLM,Description,Base_Unit_of_Measure,Inventory,Blocked,Type");
  assert.deepEqual(productos.map(p => [p.numprod, p.referenciaTlm, p.inventory]), [["P1", "REF-1", 3], ["P6", "REF-1", 3]]);
});
