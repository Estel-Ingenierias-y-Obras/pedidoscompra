const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCliente } = require("../services/almacenBC");
const raiz = "https://api.businesscentral.dynamics.com/v2.0/tenant/Production/api/Estel/GestionMaterial/v1.0/companies(company)";
const cliente = request => crearCliente({ request, token: async () => "token-prueba", config: () => ({ custom: raiz }) });

test("stock recupera todas las páginas de productos, incluidos negativos y decimales", async () => {
  const llamadas = [];
  const filas = [{ id: "1", inventario: 12.34567 }, { id: "2", inventario: -0.00001 }];
  const bc = cliente(async config => {
    llamadas.push(config);
    return { data: llamadas.length === 1 ? { value: [filas[0]], "@odata.nextLink": "?$skiptoken=pagina2" } : { value: [filas[1]] } };
  });
  assert.deepEqual(await bc.obtenerStock(), filas);
  assert.deepEqual(llamadas.map(c => [c.method, c.url]), [["GET", `${raiz}/productos`], ["GET", `${raiz}/productos?$skiptoken=pagina2`]]);
});

test("stock no devuelve resultados parciales si una página falla", async () => {
  let llamadas = 0;
  const bc = cliente(async () => {
    if (++llamadas === 1) return { data: { value: [{ id: "1" }], "@odata.nextLink": "?$skiptoken=2" } };
    throw { response: { status: 403 } };
  });
  await assert.rejects(bc.obtenerStock(), /permiso/);
});

test("stock rechaza enlaces de paginación externos antes de enviar credenciales", async () => {
  let llamadas = 0;
  const bc = cliente(async () => {
    llamadas++;
    return { data: { value: [], "@odata.nextLink": "https://otro.example/productos" } };
  });
  await assert.rejects(bc.obtenerStock(), /paginación no válido/);
  assert.equal(llamadas, 1);
});
