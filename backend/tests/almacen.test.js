const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { validarEntrada, crearServicio } = require("../services/almacen");
const { crearCliente, configuracionBC } = require("../services/almacenBC");
const { validarRegistro, confirmarRegistro } = require("../services/registroAlmacen");
const datos = () => ({ solicitudId: randomUUID(), numprod: "1000", cantidad: 2 });
const usuario = { email: "owner@example.com" };
const respuesta = () => ({ id: randomUUID(), numdoc: "T00028", importe: 19.98, cantidadbase: 2 });

function almacenMemoria() {
  const registros = new Map();
  const copia = valor => valor ? structuredClone(valor) : null;
  return {
    registros,
    findById: async id => copia(registros.get(id)),
    create: async datos => {
      if (registros.has(datos._id)) throw Object.assign(new Error(), { code: 11000 });
      registros.set(datos._id, { ...copia(datos), intentos: 0 });
      return copia(registros.get(datos._id));
    },
    findOneAndUpdate: async (filtro, cambio) => {
      const op = registros.get(filtro._id);
      if (!op || (filtro.tokenBloqueo && op.tokenBloqueo !== filtro.tokenBloqueo)) return null;
      if (filtro.estado) {
        if (!filtro.estado.$in.includes(op.estado)) return null;
        const ahora = filtro.$and[0].$or[1].bloqueoHasta.$lte;
        if (op.bloqueoHasta > ahora || op.proximoIntento > ahora) return null;
      }
      Object.assign(op, copia(cambio.$set));
      if (cambio.$inc) op.intentos += cambio.$inc.intentos;
      return copia(op);
    }
  };
}
function escenario(post, opciones = {}) {
  const modelo = almacenMemoria();
  const cliente = { destino: () => "sandbox/empresa", crearEntrada: post };
  return { modelo, cliente, servicio: crearServicio({ modelo, cliente, ...opciones }) };
}

test("historial conserva respuestas confirmadas por usuario y destino sin volver a consultar BC", async () => {
  const final = respuesta();
  const registros = [
    { _id: "confirmada", creadoPor: usuario.email, destino: "sandbox/empresa", estado: "creada", respuesta: final },
    { _id: "ya-no-en-diario", creadoPor: usuario.email, destino: "sandbox/empresa", estado: "bloqueada", codigoError: "GM_ENTRY_GONE", respuesta: { ...final, numdoc: "T00029" } },
    { _id: "incierta", creadoPor: usuario.email, destino: "sandbox/empresa", estado: "incierta" },
    { _id: "ajena", creadoPor: "other@example.com", destino: "sandbox/empresa", estado: "creada", respuesta: final },
    { _id: "otro-destino", creadoPor: usuario.email, destino: "production/otra", estado: "creada", respuesta: final }
  ];
  const modelo = { find: filtro => {
    assert.deepEqual(filtro, { creadoPor: usuario.email, destino: "sandbox/empresa", "respuesta.id": { $exists: true, $ne: null } });
    return { sort: orden => {
      assert.deepEqual(orden, { createdAt: -1 });
      return { lean: async () => registros.filter(op => op.creadoPor === filtro.creadoPor && op.destino === filtro.destino && op.respuesta?.id) };
    } };
  } };
  const servicio = crearServicio({ modelo, cliente: { destino: () => "sandbox/empresa", crearEntrada: () => assert.fail("El historial no escribe en BC") } });
  const historial = await servicio.obtenerEnviados({ email: "OWNER@EXAMPLE.COM" });
  assert.deepEqual(historial.map(op => op.solicitudId), ["confirmada", "ya-no-en-diario"]);
  assert.deepEqual(historial[0].respuesta, final);
  assert.equal(historial[1].respuesta.numdoc, "T00029");
});

test("registro persiste y reintenta la misma línea, exige confirmación y recupera permisos", async () => {
  const modelo = almacenMemoria();
  const idlinea = randomUUID(), claveintegracion = randomUUID(), cuerpos = [];
  const body = { solicitudId: idlinea, idlinea, claveintegracion };
  const cliente = { destino: () => "sandbox/registro", crearEntrada: async cuerpo => {
    cuerpos.push(structuredClone(cuerpo));
    if (cuerpos.length === 1) throw Object.assign(new Error("Permiso"), { seguro: true, status: 403 });
    if (cuerpos.length === 2) throw new Error("timeout");
    return { id: randomUUID(), idlinea, claveintegracion, numdoc: "T10", registrado: true };
  } };
  const servicio = crearServicio({ modelo, cliente, validar: validarRegistro, confirmar: confirmarRegistro, reintentarRechazadas: true });
  assert.equal((await servicio.crearEntrada(body, usuario)).estado, "rechazada");
  assert.equal((await servicio.crearEntrada(body, usuario)).estado, "incierta");
  assert.equal((await servicio.crearEntrada(body, usuario)).estado, "creada");
  assert.ok(cuerpos.every(cuerpo => cuerpo.idlinea === idlinea && cuerpo.claveintegracion === claveintegracion));
  assert.equal(modelo.registros.get(idlinea).claveintegracion, claveintegracion);
  assert.equal(confirmarRegistro({ registrado: false, idlinea, claveintegracion }, body), false);
  assert.throws(() => validarRegistro({ ...body, cantidad: 100 }), { status: 400 });
});

test("cuerpo admite omisión o exactamente un monetario; cero no equivale a omitido", () => {
  const entrada = datos();
  assert.deepEqual(validarEntrada(entrada), { numprod: "1000", cantidad: 2 });
  for (const campo of ["preciounitario", "importe", "costeunitario"]) assert.equal(validarEntrada({ ...entrada, [campo]: 0 })[campo], 0);
  for (const extra of [{ importe: 0, preciounitario: 0 }, { importe: null }, { cantidad: 0 }, { cantidad: "2" }, { liqpornumorden: 1.5 }, { codudmedida: "" }]) assert.throws(() => validarEntrada({ ...entrada, ...extra }), { status: 400 });
});
test("todos los campos fijos y claves BC quedan excluidos del POST", () => {
  for (const campo of ["id", "claveintegracion", "fecharegistro", "tipomovimiento", "numdoc", "descripcion", "codalmacen", "departamento", "importedto", "cantidadbase", "factorunidad", "conjuntodimensiones"]) assert.throws(() => validarEntrada({ ...datos(), [campo]: "manipulado" }), { status: 400 });
});
test("persiste UUID backend y cuerpo antes de BC y conserva todos sus valores finales", async () => {
  const final = respuesta();
  let enviado;
  const contexto = escenario(async cuerpo => {
    enviado = cuerpo;
    const persistida = [...contexto.modelo.registros.values()][0];
    assert.deepEqual(persistida.cuerpo, cuerpo);
    assert.equal(persistida.estado, "procesando");
    return final;
  });
  const original = datos();
  const result = await contexto.servicio.crearEntrada(original, usuario);
  assert.notEqual(enviado.claveintegracion, original.solicitudId);
  assert.deepEqual(Object.keys(enviado).sort(), ["cantidad", "claveintegracion", "numprod"]);
  assert.equal(result.estado, "creada");
  assert.deepEqual(result.respuesta, final);
  assert.equal([...contexto.modelo.registros.values()][0].numeroDocumento, final.numdoc);
});
test("dos envíos simultáneos reclaman una sola operación y un único POST", async () => {
  let terminar, llamadas = 0;
  const pendiente = new Promise(resolve => { terminar = resolve; });
  const { servicio, modelo } = escenario(async () => { llamadas++; return pendiente; });
  const entrada = datos();
  const primero = servicio.crearEntrada(entrada, usuario);
  const segundo = servicio.crearEntrada(entrada, usuario);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(llamadas, 1);
  terminar(respuesta());
  const resultados = await Promise.all([primero, segundo]);
  assert.equal(modelo.registros.size, 1);
  assert.equal(resultados.filter(op => op.estado === "creada").length, 1);
});
test("timeout, reinicio del servicio y reintento mantienen clave y cuerpo; cambios se rechazan", async () => {
  const cuerpos = [];
  const { servicio, modelo, cliente } = escenario(async cuerpo => {
    cuerpos.push(structuredClone(cuerpo));
    if (cuerpos.length === 1) throw Object.assign(new Error("Timeout"), { seguro: true, incierto: true });
    return respuesta();
  });
  const entrada = { ...datos(), importe: 0 };
  assert.equal((await servicio.crearEntrada(entrada, usuario)).estado, "incierta");
  await assert.rejects(servicio.crearEntrada({ ...entrada, importe: 2 }, usuario), { codigo: "GM_KEY_CONFLICT" });
  await assert.rejects(servicio.crearEntrada(entrada, { email: "otro@example.com" }), { status: 409 });
  const reiniciado = crearServicio({ modelo, cliente });
  assert.equal((await reiniciado.crearEntrada(entrada, usuario)).estado, "creada");
  assert.deepEqual(cuerpos[0], cuerpos[1]);
});
test("no reenviar a otra empresa o entorno tras cambiar configuración", async () => {
  const { servicio, cliente } = escenario(async () => { throw new Error("red"); });
  const entrada = datos();
  await servicio.crearEntrada(entrada, usuario);
  cliente.destino = () => "otra/empresa";
  await assert.rejects(servicio.crearEntrada(entrada, usuario), { status: 409 });
});
for (const codigo of ["GM_KEY_CONFLICT", "GM_ENTRY_GONE"]) test(`${codigo} bloquea sin recrear ni reintentar automáticamente`, async () => {
  let llamadas = 0;
  const { servicio } = escenario(async () => { llamadas++; throw Object.assign(new Error(codigo), { codigo, seguro: true }); });
  const entrada = datos();
  assert.equal((await servicio.crearEntrada(entrada, usuario)).estado, "bloqueada");
  assert.equal((await servicio.crearEntrada(entrada, usuario)).estado, "bloqueada");
  assert.equal(llamadas, 1);
});
test("repetir una operación creada consulta BC y detecta línea ya registrada/eliminada", async () => {
  let llamadas = 0;
  const { servicio } = escenario(async () => {
    if (++llamadas === 1) return respuesta();
    throw Object.assign(new Error("No existe"), { codigo: "GM_ENTRY_GONE", seguro: true });
  });
  const entrada = datos();
  await servicio.crearEntrada(entrada, usuario);
  assert.equal((await servicio.crearEntrada(entrada, usuario)).estado, "bloqueada");
});
test("error de validación se conserva y no se reintenta automáticamente", async () => {
  let llamadas = 0;
  const { servicio } = escenario(async () => { llamadas++; throw Object.assign(new Error("Coste estándar"), { seguro: true, status: 400 }); });
  const entrada = datos();
  const result = await servicio.crearEntrada(entrada, usuario);
  assert.equal(result.estado, "rechazada");
  assert.equal(result.error, "Coste estándar");
  await servicio.crearEntrada(entrada, usuario);
  assert.equal(llamadas, 1);
});

test("bloqueo caducado tras caída permite resolver el cuerpo original", async () => {
  let instante = new Date("2026-09-25T10:00:00Z");
  let llamadas = 0;
  const { servicio, modelo } = escenario(async () => { llamadas++; throw new Error("conexión perdida"); }, { ahora: () => instante });
  const entrada = datos();
  await servicio.crearEntrada(entrada, usuario);
  const op = modelo.registros.get(entrada.solicitudId);
  op.estado = "procesando";
  op.bloqueoHasta = new Date("2026-09-25T10:03:00Z");
  assert.equal((await servicio.crearEntrada(entrada, usuario)).estado, "procesando");
  assert.equal(llamadas, 1);
  instante = new Date("2026-09-25T10:04:00Z");
  await servicio.crearEntrada(entrada, usuario);
  assert.equal(llamadas, 2);
});
test("fallo de persistencia después del éxito BC se recupera sin sustituir la clave", async () => {
  let instante = new Date("2026-09-25T10:00:00Z");
  const cuerpos = [], final = respuesta();
  const { servicio, modelo } = escenario(async cuerpo => { cuerpos.push(structuredClone(cuerpo)); return final; }, { ahora: () => instante });
  const escribir = modelo.findOneAndUpdate;
  let fallar = true;
  modelo.findOneAndUpdate = async (filtro, cambio) => {
    if (fallar && cambio.$set.estado === "creada") { fallar = false; throw new Error("Mongo desconectado"); }
    return escribir(filtro, cambio);
  };
  const entrada = datos();
  await assert.rejects(servicio.crearEntrada(entrada, usuario), /Mongo/);
  instante = new Date("2026-09-25T10:04:00Z");
  assert.deepEqual((await servicio.crearEntrada(entrada, usuario)).respuesta, final);
  assert.deepEqual(cuerpos[0], cuerpos[1]);
});
test("backend conserva Retry-After entre llamadas del navegador", async () => {
  let instante = new Date("2026-09-25T10:00:00Z"), llamadas = 0;
  const { servicio } = escenario(async () => {
    llamadas++;
    throw Object.assign(new Error("Limitado"), { seguro: true, transitorio: true, retryMs: 120000 });
  }, { ahora: () => instante });
  const entrada = datos();
  await servicio.crearEntrada(entrada, usuario);
  await servicio.crearEntrada(entrada, usuario);
  assert.equal(llamadas, 1);
  instante = new Date("2026-09-25T10:02:01Z");
  await servicio.crearEntrada(entrada, usuario);
  assert.equal(llamadas, 2);
});

const raices = { custom: "https://api.businesscentral.dynamics.com/v2.0/tenant/sandbox/api/Estel/GestionMaterial/v1.0/companies(empresa)", standard: "https://api.businesscentral.dynamics.com/v2.0/tenant/sandbox/api/v2.0/companies(empresa)" };
const clienteHTTP = (request, esperar = async () => {}) => crearCliente({ request, esperar, token: async () => "token-test", config: () => raices });
test("catálogos usan filtro de un producto escapado y siguen todas las páginas", async () => {
  const urls = [];
  const cliente = clienteHTTP(async ({ url }) => {
    urls.push(url);
    return { data: urls.length === 1 ? { value: [{ codigo: "UD" }], "@odata.nextLink": `${raices.custom}/unidadesProducto?$skiptoken=2` } : { value: [{ codigo: "CAJA" }] } };
  });
  const result = await cliente.obtenerUnidades("A'B & C");
  assert.equal(new URL(urls[0]).searchParams.get("$filter"), "numprod eq 'A''B & C'");
  assert.equal(result.length, 2);
  assert.throws(() => cliente.obtenerMovimientosAplicables(""), { status: 400 });
});
test("productos usan API estándar y los filtros indicados; listas no filtran campos variables", async () => {
  const urls = [];
  const cliente = clienteHTTP(async ({ url }) => { urls.push(new URL(url)); return { data: { value: [] } }; });
  await cliente.obtenerProductos(); await cliente.obtenerEntradas();
  assert.equal(urls[0].searchParams.get("$filter"), "blocked eq false and type eq 'Inventory'");
  assert.equal(urls[1].searchParams.has("$filter"), false);
});
test("rechaza nextLink de otro origen o empresa antes de enviar token", async () => {
  for (const siguiente of ["https://evil.example/items", `${raices.custom.replace("empresa", "otra")}/diarioProductos`]) {
    let llamadas = 0;
    const cliente = clienteHTTP(async () => { llamadas++; return { data: { value: [], "@odata.nextLink": siguiente } }; });
    await assert.rejects(cliente.obtenerEntradas(), { status: 502 });
    assert.equal(llamadas, 1);
  }
});
test("HTTP limita reintentos, respeta Retry-After y conserva cuerpo incluido cero", async () => {
  const cuerpos = [], esperas = [];
  const cuerpo = { claveintegracion: randomUUID(), numprod: "1000", cantidad: 1, preciounitario: 0 };
  const final = respuesta();
  const cliente = clienteHTTP(async ({ data }) => {
    cuerpos.push(structuredClone(data));
    if (cuerpos.length < 3) throw { response: { status: 429, headers: { "retry-after": "2" } } };
    return { data: final };
  }, async ms => { esperas.push(ms); });
  assert.deepEqual(await cliente.crearEntrada(cuerpo), final);
  assert.deepEqual(esperas, [2000, 2000]);
  assert.ok(cuerpos.every(item => JSON.stringify(item) === JSON.stringify(cuerpo)));
});
test("Retry-After largo devuelve espera pendiente sin reintentar antes de tiempo", async () => {
  let llamadas = 0;
  const cliente = clienteHTTP(async () => { llamadas++; throw { response: { status: 429, headers: { "retry-after": "120" } } }; });
  await assert.rejects(cliente.crearEntrada({}), { retryMs: 120000 });
  assert.equal(llamadas, 1);
});
test("no reintenta validación/autorización y oculta tokens en los errores", async () => {
  for (const status of [400, 401, 403]) {
    let llamadas = 0;
    const cliente = clienteHTTP(async () => { llamadas++; throw { response: { status, data: { error: { message: "Error Bearer secreto" } } } }; });
    await assert.rejects(cliente.crearEntrada({}), err => !err.message.includes("secreto"));
    assert.equal(llamadas, 1);
  }
});
test("GM_ENTRY_GONE y GM_KEY_CONFLICT se detectan incluso dentro del mensaje OData", async () => {
  for (const codigo of ["GM_ENTRY_GONE", "GM_KEY_CONFLICT"]) {
    const cliente = clienteHTTP(async () => { throw { response: { status: 400, data: { error: { code: "Application_DialogException", message: `${codigo}: detalle` } } } }; });
    await assert.rejects(cliente.crearEntrada({}), { codigo, transitorio: false });
  }
});
test("configuración exige entorno y empresa explícitos, no usa el nombre de un ejemplo", () => {
  assert.throws(() => configuracionBC({}), /BC_ENVIRONMENT/);
  const config = configuracionBC({ TENANT_ID: randomUUID(), CLIENT_ID: "id", CLIENT_SECRET: "secret", BC_SCOPE: "scope", BC_ENVIRONMENT: "Mi sandbox", BC_COMPANY_ID: randomUUID() });
  assert.ok(config.custom.includes("Mi%20sandbox/api/Estel/GestionMaterial/v1.0/companies("));
});
