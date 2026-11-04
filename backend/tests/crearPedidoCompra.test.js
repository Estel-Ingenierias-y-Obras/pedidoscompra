const test = require("node:test");
const assert = require("node:assert/strict");
const { crearServicio, validar } = require("../services/crearPedidoCompra");
const id = "12345678-1234-4234-8234-123456789012";
const headerId = "12345678-1234-4234-8234-123456789013";
const usuario = { email: "compras@example.test" };
const cuerpo = () => ({ proveedor: "PROV1", fechaRecepcion: "2026-11-10", proyecto: "OBRA", tarea: "100", usuarioAsignado: "COMPRAS", entrega: { tipo: "empresa" }, lineas: [{ articulo: "1000", cantidad: 3, unidad: "UD" }] });
const noEncontrado = () => Object.assign(new Error("No encontrado"), { response: { status: 404 } });
function entorno({ timeout = false, rechazar = false, sinDireccionProyecto = false, timeoutEliminar = false } = {}) {
  const operaciones = new Map();
  let recibo, posts = 0, lanzamientos = 0, eliminaciones = 0;
  const modelo = {
    create: async valor => { if (operaciones.has(valor._id)) throw Object.assign(new Error(), { code: 11000 }); operaciones.set(valor._id, valor); },
    findById: async clave => operaciones.get(clave)
  };
  const servicio = crearServicio({ modelo, raiz: () => "https://bc.test/empresa", token: async () => "secreto", request: async config => {
    if (config.url.includes("/purchaseProjectAddresses")) { if (sinDireccionProyecto) throw noEncontrado(); return { data: { value: [] } }; }
    if (config.method === "GET") { if (!recibo) throw noEncontrado(); return { data: recibo }; }
    if (config.url.endsWith("/Microsoft.NAV.lanzar")) { lanzamientos++; recibo.status = "Released"; return { data: null }; }
    if (config.url.endsWith("/Microsoft.NAV.eliminar")) { eliminaciones++; recibo.status = "Deleted"; if (timeoutEliminar) throw Error("timeout"); return { data: null }; }
    posts++;
    if (rechazar) throw Object.assign(new Error("Validación"), { response: { status: 400 } });
    assert.equal(config.data.payload.includes('"status"'), false);
    recibo = { id: config.data.id, fingerprint: config.data.fingerprint, headerId, number: "PC001", status: "Open" };
    if (timeout) throw Object.assign(new Error("timeout"), { code: "ECONNABORTED" });
    return { data: recibo };
  } });
  return { servicio, operaciones, posts: () => posts, lanzamientos: () => lanzamientos, eliminaciones: () => eliminaciones, cambiarEstado: estado => { recibo.status = estado; } };
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
test("la entrega usa códigos de BC y exige cliente o almacén según el destino", () => {
  assert.deepEqual(validar({ ...cuerpo(), entrega: { tipo: "cliente", cliente: "C001", codigoDireccion: "OBRA" } }).entrega, { tipo: "cliente", cliente: "C001", codigoDireccion: "OBRA", almacen: "" });
  assert.equal(validar({ ...cuerpo(), entrega: { tipo: "almacen", almacen: "CENTRAL" } }).entrega.almacen, "CENTRAL");
  for (const entrega of [{ tipo: "cliente" }, { tipo: "empresa", cliente: "C001" }, { tipo: "almacen" }, { tipo: "cliente", cliente: "C001", direccion: "texto libre" }]) assert.throws(() => validar({ ...cuerpo(), entrega }), { status: 400 });
});
test("solo acepta los datos postales editables para dirección personalizada", () => {
  const personalizada = { nombre: "Entrega", direccion: "Calle 1", ciudad: "Palma", pais: "ES", codigoPostal: "07001", contacto: "Recepción" };
  const r = validar({ ...cuerpo(), entrega: { tipo: "personalizada", personalizada } });
  assert.equal(r.entrega.personalizada.nombre, "Entrega");
  assert.equal(r.entrega.personalizada.telefono, "");
  for (const entrega of [{ tipo: "personalizada", personalizada: { nombre: "Entrega" } }, { tipo: "empresa", personalizada }, { tipo: "personalizada", cliente: "C001", personalizada }, { tipo: "personalizada", personalizada: { ...personalizada, pais: "x".repeat(11) } }]) assert.throws(() => validar({ ...cuerpo(), entrega }), { status: 400 });
});
test("valida los tres modos de pago sin cambiar las solicitudes anteriores", () => {
  assert.equal(Object.hasOwn(validar(cuerpo()), "pago"), false);
  assert.equal(validar({ ...cuerpo(), pago: { tipo: "otro", proveedor: "P0039", codigoContacto: "CT001" } }).pago.codigoContacto, "CT001");
  assert.equal(validar({ ...cuerpo(), pago: { tipo: "personalizada", personalizada: { direccion: "Calle 2" } } }).pago.personalizada.direccion, "Calle 2");
  for (const pago of [{ tipo: "otro" }, { tipo: "proveedor", contacto: "Nombre libre" }, { tipo: "personalizada", proveedor: "P0039" }, { tipo: "personalizada", personalizada: { nombre: "Otro nombre" } }, { tipo: "otro", proveedor: "P0039", personalizada: {} }]) assert.throws(() => validar({ ...cuerpo(), pago }), { status: 400 });
});
test("el catálogo de contactos se limita a los vinculados al proveedor seleccionado", async () => {
  const filtros = [];
  const servicio = crearServicio({ raiz: () => "https://bc.test/empresa", token: async () => "token", request: async config => {
    const url = new URL(config.url);
    filtros.push(url.searchParams.get("$filter"));
    return { data: { value: url.pathname.endsWith("/purchaseVendorContactLinks") ? [{ contactNumber: "CT-EMPRESA" }] : [{ number: "CT-PERSONA", name: "Eva" }] } };
  } });
  const contactos = await servicio.contactosPago("P0039");
  assert.deepEqual(filtros, ["vendorNumber eq 'P0039'", "companyNumber eq 'CT-EMPRESA'", "number eq 'CT-EMPRESA'"]);
  assert.equal(contactos.length, 1);
});
test("no envía un pedido con pago si BC todavía tiene la API anterior", async () => {
  const e = entorno();
  await assert.rejects(e.servicio.crear(id, { ...cuerpo(), pago: { tipo: "otro", proveedor: "P0040" } }, usuario), { status: 501 });
  assert.equal(e.posts(), 0);
});
test("consulta la dirección del proyecto seleccionado y rechaza un predeterminado sin proyecto", async () => {
  let filtro;
  const servicio = crearServicio({ raiz: () => "https://bc.test/empresa", token: async () => "token", request: async config => {
    assert.equal(new URL(config.url).pathname, "/empresa/purchaseProjectAddresses");
    filtro = new URL(config.url).searchParams.get("$filter");
    return { data: { value: [{ name: "Obra", address: "Calle proyecto", city: "Palma" }] } };
  } });
  const r = await servicio.direccionEntrega({ tipo: "empresa", proyecto: "ACEES24-001" });
  assert.equal(filtro, "number eq 'ACEES24-001'");
  assert.equal(r.direccion, "Calle proyecto");
  await assert.rejects(servicio.direccionEntrega({ tipo: "empresa" }), { status: 400 });
});
test("no envía un predeterminado contra una versión que todavía usa la empresa", async () => {
  const e = entorno({ sinDireccionProyecto: true });
  await assert.rejects(e.servicio.crear(id, cuerpo(), usuario), { status: 501 });
  assert.equal(e.posts(), 0);
});
test("elimina solo el pedido confirmado, tolera perder la respuesta y no lo recrea", async () => {
  const e = entorno({ timeoutEliminar: true });
  await e.servicio.crear(id, cuerpo(), usuario);
  await assert.rejects(e.servicio.eliminar(id, usuario, "OTRO"), { status: 409 });
  assert.equal(e.eliminaciones(), 0);
  await e.servicio.lanzar(id, usuario);
  assert.equal((await e.servicio.eliminar(id, usuario, "PC001")).estado, "Deleted");
  assert.equal((await e.servicio.eliminar(id, usuario, "PC001")).estado, "Deleted");
  assert.equal(e.eliminaciones(), 1);
  await assert.rejects(e.servicio.crear(id, cuerpo(), usuario), { status: 409 });
  await assert.rejects(e.servicio.lanzar(id, usuario), { status: 409 });
  assert.equal(e.posts(), 1);
});
test("Comprador gestiona un envío del equipo y se conserva la comprobación de entorno", async () => {
  const e = entorno();
  await e.servicio.crear(id, cuerpo(), usuario);
  assert.equal((await e.servicio.lanzar(id, { email: "otro@example.test", rol: "Comprador" })).estado, "Released");
  e.operaciones.get(id).destino = "https://otro.test/empresa";
  await assert.rejects(e.servicio.eliminar(id, usuario, "PC001"), { status: 409 });
  assert.equal(e.eliminaciones(), 0);
});
test("el historial incluye envíos previos y usa páginas de 100 en la empresa actual", async () => {
  let params;
  const modelo = { find: filtro => {
    assert.equal(filtro.destino, "https://bc.test/empresa/purchaseRequests");
    return { lean: async () => [{ _id: id, usuario: usuario.email, cuerpo: cuerpo() }] };
  } };
  const servicio = crearServicio({ modelo, raiz: () => "https://bc.test/empresa", token: async () => "token", request: async config => {
    params = new URL(config.url).searchParams;
    return { data: { value: [{ id, number: "PC001", status: "Released", createdAt: "2026-11-04T10:00:00Z" }], "@odata.count": 101 } };
  } });
  const r = await servicio.enviados({ pagina: "2" }, { ...usuario, rol: "Comprador" });
  assert.equal(params.get("$top"), "100");
  assert.equal(params.get("$skip"), "100");
  assert.equal(params.get("$filter"), "deleted eq false");
  assert.equal(r.pedidos[0].proveedor, "PROV1");
  assert.equal(r.pedidos[0].gestionable, true);
  assert.equal(r.paginas, 2);
  await assert.rejects(servicio.enviados({}, { ...usuario, rol: "Usuario" }), { status: 403 });
});
