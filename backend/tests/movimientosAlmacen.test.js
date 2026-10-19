const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { crearServicio, validarDTO } = require("../services/movimientosAlmacen");
const key = "18f1c681-7651-4b40-aef7-0f4481ec0402", doc = "28f1c681-7651-4b40-aef7-0f4481ec0402", request = "38f1c681-7651-4b40-aef7-0f4481ec0402";
const usuario = { email: "user@example.com" };
const datos = () => ({ solicitudId: key, tipoOperacion: "acopio", serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "A1", tipodestino: "Job", destino: "P1", solicitante: "R1", departamento: "D1", zona: "EM-ESPAÑA", tipoproyectocodigo: "INDIRECTO" }, lineas: [{ id: "l1", numprod: "ART1", cantidad: 2 }] });
let original;
beforeEach(() => { original = { ...process.env }; Object.assign(process.env, { BC_TENANT_ID: key, BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "test", BC_ENVIRONMENT: "Production-Estel-IT", BC_COMPANY_ID: key }); });
afterEach(() => { for (const campo of Object.keys(process.env)) if (!(campo in original)) delete process.env[campo]; Object.assign(process.env, original); });
function escenario() {
  let registro = null, envios = 0, registros = 0;
  const coincide = filtro => registro && Object.entries(filtro).every(([k, v]) => registro[k] === v);
  const historial = {
    findOneAndUpdate: (filtro, cambios, opciones = {}) => ({ lean: async () => {
      if (!registro && opciones.upsert) registro = structuredClone(cambios.$setOnInsert);
      if (!coincide(filtro)) return null;
      Object.assign(registro, structuredClone(cambios.$set || {})); return structuredClone(registro);
    } }),
    findOne: filtro => ({ lean: async () => coincide(filtro) ? structuredClone(registro) : null }),
    find: filtro => ({ sort: () => ({ lean: async () => coincide(filtro) ? [structuredClone(registro)] : [] }) }),
    updateOne: async (filtro, cambios) => { if (coincide(filtro)) Object.assign(registro, structuredClone(cambios.$set || {})); },
    deleteOne: async filtro => { if (coincide(filtro)) registro = null; }
  };
  const recibo = { id: request, claveintegracion: key, idacopio: doc, numero: "AC-000011", creado: true, registrado: false };
  const cliente = {
    obtenerAcopios: async () => [{ id: doc, numero: "AC-000011", origen: "A1", destino: "P1" }],
    crearAcopio: async cuerpo => { envios++; assert.equal(cuerpo.solicitudId, key); },
    obtenerSolicitudAcopio: async () => [recibo],
    obtenerCabeceraAcopio: async () => ({ id: doc, origen: "A1", destino: "P1" }),
    obtenerLineasAcopio: async () => [{ numprod: "ART1", cantidad: 2, codudmedida: "UD" }],
    registrarAcopio: async id => { assert.equal(id, request); registros++; Object.assign(recibo, { registrado: true, idhistorico: "48f1c681-7651-4b40-aef7-0f4481ec0402", idmovproducto: 123, fecharegistro: "2026-10-14T12:00:00Z" }); }
  };
  const servicio = crearServicio({ historial, cliente, recursos: async () => [{ codigo: "R1" }] });
  return { servicio, cliente, recibo, registro: () => registro, envios: () => envios, registros: () => registros };
}
test("rechaza payload manipulado y cantidades inválidas", () => {
  const sinZona = datos(); delete sinZona.cabecera.zona;
  assert.throws(() => validarDTO(sinZona), /zona/);
  for (const cantidad of [-1, 0, Infinity, "2", null]) assert.throws(() => validarDTO({ ...datos(), lineas: [{ id: "l1", numprod: "ART1", cantidad }] }));
  assert.throws(() => validarDTO({ ...datos(), lineas: [{ ...datos().lineas[0], precio: 5 }] }));
  assert.throws(() => validarDTO({ ...datos(), numero: "ACO-ALM" }));
});
test("envío exige confirmación persistida, conserva instantánea y no registra automáticamente", async () => {
  const e = escenario(); const resultado = await e.servicio.enviar(datos(), usuario);
  assert.equal(resultado.estado, "enviadoBC"); assert.equal(resultado.registrado, false);
  assert.equal(e.registros(), 0); assert.equal(e.registro().lineas[0].codudmedida, "UD");
  await e.servicio.enviar(datos(), usuario); assert.equal(e.envios(), 1);
  await assert.rejects(e.servicio.enviar({ ...datos(), lineas: [{ id: "l1", numprod: "ART1", cantidad: 3 }] }, usuario), { status: 409 });
});
test("API no publicada no genera un envío confirmado", async () => {
  const e = escenario(); e.cliente.crearAcopio = async () => { throw Object.assign(new Error("404"), { status: 404, seguro: true }); };
  await assert.rejects(e.servicio.enviar(datos(), usuario), { status: 501, codigo: "ACOPIO_API_NO_PUBLICADA" });
  assert.equal(e.registro(), null);
});
test("un comprobante incompleto nunca se considera enviado", async () => {
  const e = escenario(); e.recibo.creado = false;
  await assert.rejects(e.servicio.enviar(datos(), usuario), { status: 409 });
  assert.equal(e.registro().confirmadoBC, false);
});
test("registro verifica histórico y movimientos; reintentar no vuelve a registrar", async () => {
  const e = escenario(); await e.servicio.enviar(datos(), usuario);
  const resultado = await e.servicio.registrar({ id: doc, claveintegracion: key }, usuario);
  assert.equal(resultado.registrado, true); assert.equal(resultado.comprobanteRegistro.movimientoProducto, 123);
  await e.servicio.registrar({ id: doc, claveintegracion: key }, usuario); assert.equal(e.registros(), 1);
});
test("registro sin histórico verificable produce error y no éxito", async () => {
  const e = escenario(); await e.servicio.enviar(datos(), usuario);
  e.cliente.registrarAcopio = async () => { e.recibo.registrado = true; };
  await assert.rejects(e.servicio.registrar({ id: doc, claveintegracion: key }, usuario), { status: 409 });
  assert.equal(e.registro().estado, "error");
});
test("un diálogo posterior al registro se reconcilia con evidencia sin volver a contabilizar", async () => {
  const e = escenario(); await e.servicio.enviar(datos(), usuario);
  let llamadas = 0, contabilizaciones = 0;
  e.cliente.registrarAcopio = async () => {
    llamadas++;
    if (!e.recibo.registroiniciado) {
      contabilizaciones++; e.recibo.registroiniciado = true;
      throw Object.assign(new Error("Client callback: open history"), { status: 400, seguro: true });
    }
    Object.assign(e.recibo, { registrado: true, idhistorico: "48f1c681-7651-4b40-aef7-0f4481ec0402", idmovproducto: 123, fecharegistro: "2026-10-15T10:00:00Z" });
  };
  const resultado = await e.servicio.registrar({ id: doc, claveintegracion: key }, usuario);
  assert.equal(resultado.registrado, true); assert.equal(llamadas, 2); assert.equal(contabilizaciones, 1);
});
test("historial exige identidad y respeta usuario, empresa y entorno", async () => {
  const e = escenario(); await assert.rejects(e.servicio.obtenerEnviados({}), { status: 401 });
  await e.servicio.enviar(datos(), usuario);
  assert.equal((await e.servicio.obtenerEnviados(usuario)).length, 1);
  assert.deepEqual(await e.servicio.obtenerEnviados({ email: "otro@example.com" }), []);
  await assert.rejects(e.servicio.obtenerDetalle(doc, { email: "otro@example.com" }), { status: 404 });
});

test("actualizar enviados consulta BC y oculta los acopios borrados conservando la auditoría", async () => {
  const e = escenario(); await e.servicio.enviar(datos(), usuario);
  assert.equal((await e.servicio.obtenerEnviados(usuario)).length, 1);
  e.registro().estado = "error";
  e.cliente.obtenerAcopios = async () => [];
  const original = structuredClone(e.registro());
  assert.deepEqual(await e.servicio.obtenerEnviados(usuario), []);
  assert.deepEqual(e.registro(), original);
});

test("el historial conserva los registros confirmados aunque ya no exista el borrador en BC", async () => {
  const e = escenario(); await e.servicio.enviar(datos(), usuario);
  await e.servicio.registrar({ id: doc, claveintegracion: key }, usuario);
  e.cliente.obtenerAcopios = async () => [];
  const envios = await e.servicio.obtenerEnviados(usuario);
  assert.equal(envios.length, 1);
  assert.equal(envios[0].estado, "registrado");
  assert.ok(envios[0].comprobanteRegistro.id);
});

test("los fallos de BC no se interpretan como acopios borrados", async () => {
  const e = escenario(); await e.servicio.enviar(datos(), usuario);
  e.cliente.obtenerAcopios = async () => { throw Object.assign(new Error("Sin permiso"), { status: 403 }); };
  await assert.rejects(e.servicio.obtenerEnviados(usuario), { status: 403 });
  assert.equal(e.registro().confirmadoBC, true);
  e.cliente.obtenerAcopios = async () => [{ numero: "sin identificador" }];
  await assert.rejects(e.servicio.obtenerEnviados(usuario), { status: 502 });
});

test("actualiza los datos visibles con BC y compara los UUID sin distinguir mayúsculas", async () => {
  const e = escenario(); await e.servicio.enviar(datos(), usuario);
  e.cliente.obtenerAcopios = async () => [{ id: doc.toUpperCase(), origen: "NUEVO", nombresolicitante: "Nombre actual" }];
  const envios = await e.servicio.obtenerEnviados(usuario);
  assert.equal(envios.length, 1);
  assert.equal(envios[0].cabecera.origen, "NUEVO");
  assert.equal(envios[0].cabecera.nombresolicitante, "Nombre actual");
  assert.equal(e.registro().cabecera.origen, "A1");
});

async function rechazoProyecto(e) {
  e.cliente.crearAcopio = async () => { throw Object.assign(new Error("Status must be equal to 'Open'  in Project: No.=PSOS25-413. Current value is 'Completed'.  "), { status: 400, seguro: true }); };
  Object.assign(e.recibo, { creado: false, registroiniciado: false, registrado: false });
  await assert.rejects(e.servicio.enviar(datos(), usuario), { status: 409 });
}

test("recupera proyecto cerrado solo tras comprobar que no hay cabecera ni líneas, conservando la solicitud", async () => {
  const e = escenario(); await rechazoProyecto(e);
  e.cliente.obtenerCabeceraAcopio = async () => { throw Object.assign(new Error("No existe"), { status: 404 }); };
  e.cliente.obtenerLineasAcopio = async () => [];
  const original = structuredClone(e.registro());
  assert.deepEqual(await e.servicio.recuperarBorrador(key, usuario), { solicitudId: key, editable: true });
  assert.deepEqual(e.registro(), original);
  assert.equal(e.registros(), 0);
  await assert.rejects(e.servicio.recuperarBorrador(key, { email: "otro@example.com" }), { status: 404 });
});

test("recuperación no desbloquea si hay documentos, líneas, registro iniciado o una consulta falla", async () => {
  const e = escenario(); await rechazoProyecto(e);
  await assert.rejects(e.servicio.recuperarBorrador(key, usuario), { status: 409 });
  e.cliente.obtenerCabeceraAcopio = async () => { throw Object.assign(new Error("No existe"), { status: 404 }); };
  await assert.rejects(e.servicio.recuperarBorrador(key, usuario), { status: 409 });
  e.cliente.obtenerLineasAcopio = async () => [];
  e.recibo.registroiniciado = true;
  await assert.rejects(e.servicio.recuperarBorrador(key, usuario), { status: 409 });
  e.recibo.registroiniciado = false;
  e.cliente.obtenerCabeceraAcopio = async () => { throw Object.assign(new Error("Sin permiso"), { status: 403 }); };
  await assert.rejects(e.servicio.recuperarBorrador(key, usuario), { status: 403 });
});

test("un timeout no puede convertirse en un borrador editable", async () => {
  const e = escenario();
  e.cliente.crearAcopio = async () => { throw Object.assign(new Error("Sin respuesta"), { incierto: true }); };
  await assert.rejects(e.servicio.enviar(datos(), usuario));
  await assert.rejects(e.servicio.recuperarBorrador(key, usuario), { status: 409 });
});

test("una validación de creación permite corregir otros datos sin depender del texto del error", async () => {
  const e = escenario();
  e.cliente.crearAcopio = async () => { throw Object.assign(new Error("Validación de dimensiones"), { status: 400, seguro: true, incierto: false }); };
  Object.assign(e.recibo, { creado: false, registroiniciado: false, registrado: false });
  await assert.rejects(e.servicio.enviar(datos(), usuario), { status: 409 });
  assert.equal(e.registro().rechazoCreacion, true);
  e.cliente.obtenerCabeceraAcopio = async () => { throw Object.assign(new Error("No existe"), { status: 404 }); };
  e.cliente.obtenerLineasAcopio = async () => [];
  assert.equal((await e.servicio.recuperarBorrador(key, usuario)).editable, true);
});

test("recupera el rechazo histórico de existencias sin flag, sin borrar ni repetir el intento", async () => {
  const e = escenario(); await rechazoProyecto(e);
  e.registro().rechazoCreacion = undefined;
  e.registro().error = "The Total Requested quantity of item ARTEL000000179 (1) exceeds the quantity in location ALM.ESPAÑA (0)  ";
  e.cliente.obtenerCabeceraAcopio = async () => { throw Object.assign(new Error("No existe"), { status: 404 }); };
  e.cliente.obtenerLineasAcopio = async () => [];
  assert.equal((await e.servicio.recuperarBorrador(key, usuario)).editable, true);
  assert.ok(e.registro());
  assert.equal(e.registros(), 0);
});

test("una validación después de un timeout no demuestra que el primer intento no se ejecutó", async () => {
  const e = escenario();
  e.cliente.crearAcopio = async () => { throw Object.assign(new Error("Validación"), { status: 400, seguro: true, incierto: true }); };
  Object.assign(e.recibo, { creado: false, registroiniciado: false, registrado: false });
  await assert.rejects(e.servicio.enviar(datos(), usuario));
  assert.equal(e.registro().rechazoCreacion, false);
  await assert.rejects(e.servicio.recuperarBorrador(key, usuario), { status: 409 });
});
