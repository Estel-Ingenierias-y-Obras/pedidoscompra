const { randomUUID, createHash } = require("node:crypto");
const Operacion = require("../models/OperacionAlmacen");
const bc = require("./almacenBC");
const configuracion = { codigoAlmacen: "CENTRAL 3", departamento: "SG-ALMACEN", plantilla: "ELEMENTO", seccion: "GENERICO", tipoProyectoPredeterminado: "INDIRECTO" };
const invalidar = mensaje => { throw Object.assign(new Error(mensaje), { status: 400, seguro: true, definitivo: true }); };
function validarEntrada(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalidar("Solicitud no válida.");
  if (!bc.UUID.test(body.solicitudId || "")) invalidar("Identificador de operación no válido.");
  const permitidos = ["solicitudId", "numprod", "cantidad", "codudmedida", "tipoproyectocodigo", "liqpornumorden", "preciounitario", "importe", "costeunitario"];
  if (Object.keys(body).some(campo => !permitidos.includes(campo))) invalidar("La solicitud contiene campos de solo lectura o no admitidos.");
  const datos = {};
  const codigo = (campo, max, obligatorio) => {
    if (!Object.hasOwn(body, campo)) { if (obligatorio) invalidar(`${campo} es obligatorio.`); return; }
    if (typeof body[campo] !== "string" || !body[campo].trim() || body[campo].trim().length > max) invalidar(`${campo} no válido.`);
    datos[campo] = body[campo].trim();
  };
  codigo("numprod", 20, true);
  if (typeof body.cantidad !== "number" || !Number.isFinite(body.cantidad) || body.cantidad <= 0) invalidar("La cantidad debe ser un número mayor que cero.");
  datos.cantidad = body.cantidad;
  codigo("codudmedida", 10);
  codigo("tipoproyectocodigo", 20);
  if (Object.hasOwn(body, "liqpornumorden")) {
    if (!Number.isInteger(body.liqpornumorden) || body.liqpornumorden < 0 || body.liqpornumorden > 2147483647) invalidar("Selecciona un movimiento de producto válido.");
    datos.liqpornumorden = body.liqpornumorden;
  }
  const monetarios = ["preciounitario", "importe", "costeunitario"].filter(campo => Object.hasOwn(body, campo));
  if (monetarios.length > 1) invalidar("Solo se puede enviar precio, importe o coste, nunca varios a la vez.");
  for (const campo of monetarios) {
    if (typeof body[campo] !== "number" || !Number.isFinite(body[campo])) invalidar(`${campo} debe ser un número finito.`);
    datos[campo] = body[campo];
  }
  return datos;
}
const serializar = op => ({ solicitudId: op._id, estado: op.estado, cuerpo: op.cuerpo, claveintegracion: op.claveintegracion, respuesta: op.respuesta, error: op.error, codigoError: op.codigoError, proximoIntento: op.proximoIntento, createdAt: op.createdAt });

function crearServicio({ modelo = Operacion, cliente = bc, uuid = randomUUID, ahora = () => new Date(), validar = validarEntrada, confirmar = () => true, reintentarRechazadas = false } = {}) {
  async function crearEntrada(body, usuario) {
    const datos = validar(body);
    const propietario = usuario.email.toLowerCase();
    const huella = createHash("sha256").update(JSON.stringify(datos)).digest("hex");
    let op = await modelo.findById(body.solicitudId);
    if (!op) {
      const destino = cliente.destino();
      const claveintegracion = datos.claveintegracion || uuid();
      try {
        op = await modelo.create({ _id: body.solicitudId, creadoPor: propietario, destino, claveintegracion, cuerpo: { claveintegracion, ...datos }, huella, estado: "preparada" });
      } catch (error) {
        if (error.code !== 11000) throw error;
        op = await modelo.findById(body.solicitudId);
        if (!op) throw error;
      }
    }
    if (op.creadoPor !== propietario || op.huella !== huella) throw Object.assign(new Error("Esta operación ya está asociada a otros datos o a otro usuario. No se ha enviado una nueva entrada."), { status: 409, seguro: true, codigo: "GM_KEY_CONFLICT" });
    if (op.estado === "bloqueada" || (op.estado === "rechazada" && !reintentarRechazadas)) return serializar(op);
    if (op.destino !== cliente.destino()) throw Object.assign(new Error("La empresa o el entorno ha cambiado. Restaura la configuración original para resolver esta operación."), { status: 409, seguro: true });
    const instante = ahora(), tokenBloqueo = uuid();
    const reclamada = await modelo.findOneAndUpdate({ _id: op._id, estado: { $in: ["preparada", "incierta", "procesando", "creada", ...(reintentarRechazadas ? ["rechazada"] : [])] }, $and: [
      { $or: [{ bloqueoHasta: null }, { bloqueoHasta: { $lte: instante } }] },
      { $or: [{ proximoIntento: null }, { proximoIntento: { $lte: instante } }] }
    ] }, { $set: { estado: "procesando", tokenBloqueo, bloqueoHasta: new Date(instante.getTime() + 180000) }, $inc: { intentos: 1 } }, { returnDocument: "after" });
    if (!reclamada) return serializar(await modelo.findById(op._id));
    let resultado;
    try {
      const respuesta = await cliente.crearEntrada(reclamada.cuerpo);
      if (!bc.UUID.test(respuesta?.id || "") || !respuesta.numdoc || !confirmar(respuesta, reclamada.cuerpo)) throw Object.assign(new Error("La respuesta no confirma la operación. Reintenta la misma solicitud."), { incierto: true, seguro: true });
      resultado = { estado: "creada", respuesta, bcSystemId: respuesta.id, numeroDocumento: respuesta.numdoc, error: null, codigoError: null, proximoIntento: null };
    } catch (error) {
      const especial = ["GM_KEY_CONFLICT", "GM_ENTRY_GONE"].includes(error.codigo);
      const incierto = !error.seguro || error.incierto || error.transitorio || ["incierta", "procesando"].includes(op.estado);
      resultado = { estado: especial ? "bloqueada" : incierto ? "incierta" : "rechazada",
        error: error.seguro ? error.message : "No se pudo confirmar el resultado. Reintenta la misma operación.", codigoError: error.codigo || "RESULTADO_INCIERTO",
        proximoIntento: error.retryMs ? new Date(ahora().getTime() + error.retryMs) : null };
    }
    const guardada = await modelo.findOneAndUpdate({ _id: op._id, tokenBloqueo }, { $set: { ...resultado, bloqueoHasta: null, tokenBloqueo: null } }, { returnDocument: "after" });
    return serializar(guardada || await modelo.findById(op._id));
  }
  async function obtenerOperaciones(usuario) {
    const operaciones = await modelo.find({ creadoPor: usuario.email.toLowerCase(), estado: { $nin: ["creada", "rechazada"] } }).sort({ createdAt: -1 }).lean();
    return operaciones.map(serializar);
  }
  return { crearEntrada, obtenerOperaciones };
}
module.exports = { configuracion, validarEntrada, serializar, crearServicio, ...crearServicio() };
