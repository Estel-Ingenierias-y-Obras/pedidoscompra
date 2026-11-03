const test = require("node:test");
const assert = require("node:assert/strict");
const { crearServicio, validar } = require("../services/crearPedidoCompra");
const id = "12345678-1234-4234-8234-123456789012";
const headerId = "12345678-1234-4234-8234-123456789013";
const usuario = { email: "compras@example.test" };
const cuerpo = () => ({ proveedor: "PROV1", fechaRecepcion: "2026-11-10", proyecto: "OBRA", tarea: "100", usuarioAsignado: "COMPRAS", entrega: { nombre: "Obra", direccion: "Calle 1", ciudad: "Palma", codigoPostal: "07001", pais: "ES" }, lineas: [{ articulo: "1000", cantidad: 3, unidad: "UD" }] });
const noEncontrado = () => Object.assign(new Error("No encontrado"), { response: { status: 404 } });
function entorno({ timeout = false, rechazar = false } = {}) {
  const operaciones = new Map();
  let recibo, posts = 0, lanzamientos = 0;
  const modelo = {
    create: async valor => { if (operaciones.has(valor._id)) throw Object.assign(new Error(), { code: 11000 }); operaciones.set(valor._id, valor); },
    findById: async clave => operaciones.get(clave)
  };
  const servicio = crearServicio({ modelo, raiz: () => "https://bc.test/empresa", token: async () => "secreto", request: async config => {
    if (config.method === "GET") { if (!recibo) throw noEncontrado(); return { data: recibo }; }
    if (config.url.endsWith("/Microsoft.NAV.lanzar")) { lanzamientos++; recibo.status = "Released"; return { data: null }; }
    posts++;
    if (rechazar) throw Object.assign(new Error("Validación"), { response: { status: 400 } });
    assert.equal(config.data.payload.includes('"status"'), false);
    recibo = { id: config.data.id, fingerprint: config.data.fingerprint, headerId, number: "PC001", status: "Open" };
    if (timeout) throw Object.assign(new Error("timeout"), { code: "ECONNABORTED" });
    return { data: recibo };
  } });
  return { servicio, operaciones, posts: () => posts, lanzamientos: () => lanzamientos, cambiarEstado: estado => { recibo.status = estado; } };
}
test("crea abierto, recupera la misma solicitud sin duplicar y lanza una sola vez", async () => {
  const e = entorno();
  const r = await e.servicio.crear(id, cuerpo(), usuario);
  assert.equal(r.estado, "Open");
  assert.deepEqual(await e.servicio.crear(id, cuerpo(), usuario), r);
  assert.equal(e.posts(), 1);
  assert.equal((await e.servicio.lanzar(id, usuario)).estado, "Released");
  assert.equal((await e.servicio.lanzar(id, usuario)).estado, "Released");
  assert.equal(e.lanzamientos(), 1);
});
test("recupera un POST confirmado en BC aunque se pierda la respuesta", async () => {
  const e = entorno({ timeout: true });
  assert.equal((await e.servicio.crear(id, cuerpo(), usuario)).numero, "PC001");
  assert.equal(e.posts(), 1);
});
test("rechaza cambios de cuerpo, otro usuario y lanzamiento pendiente de aprobación", async () => {
  const e = entorno();
  await e.servicio.crear(id, cuerpo(), usuario);
  await assert.rejects(e.servicio.crear(id, { ...cuerpo(), proveedor: "OTRO" }, usuario), { status: 409 });
  await assert.rejects(e.servicio.lanzar(id, { email: "otro@example.test" }), { status: 404 });
  e.cambiarEstado("Pending Approval");
  await assert.rejects(e.servicio.lanzar(id, usuario), { status: 409 });
  assert.equal(e.lanzamientos(), 0);
});
test("un rechazo de validación confirmado permite corregir el pedido", async () => {
  const e = entorno({ rechazar: true });
  await assert.rejects(e.servicio.crear(id, cuerpo(), usuario), { definitivo: true });
});
test("valida fechas, cantidades, coste y no permite suministrar estado ni número", () => {
  for (const cambio of [{ fechaRecepcion: "2026-02-30" }, { fechaDocumento: "2026-11-03" }, { fechaRegistro: "2026-11-03" }, { fechaIVA: "2026-11-03" }, { tarea: "" }, { usuarioAsignado: "" }, { entrega: {} }, { lineas: [] }, { estado: "Released" }, { numero: "PC" }, { lineas: [{ articulo: "A", cantidad: 0 }] }]) assert.throws(() => validar({ ...cuerpo(), ...cambio }), { status: 400 });
  assert.equal(validar({ ...cuerpo(), lineas: [{ articulo: "1000", cantidad: 1, coste: 0 }] }).lineas[0].coste, 0);
  assert.equal(Object.hasOwn(validar(cuerpo()).lineas[0], "coste"), false);
});
