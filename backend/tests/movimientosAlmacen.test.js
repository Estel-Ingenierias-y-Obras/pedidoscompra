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
  const e = escenario(); assert.throws(() => e.servicio.obtenerEnviados({}), { status: 401 });
  await e.servicio.enviar(datos(), usuario);
  assert.equal((await e.servicio.obtenerEnviados(usuario)).length, 1);
  assert.deepEqual(await e.servicio.obtenerEnviados({ email: "otro@example.com" }), []);
  await assert.rejects(e.servicio.obtenerDetalle(doc, { email: "otro@example.com" }), { status: 404 });
});
