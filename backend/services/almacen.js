const Movimiento = require("../models/MovimientoAlmacen");
const Secuencia = require("../models/SecuenciaAlmacen");
const bc = require("./almacenBC");

const configuracion = {
  codigoAlmacen: "CENTRAL 3", departamento: "SG-ALMACEN",
  tiposMovimiento: [{ valor: "ajustePositivo", etiqueta: "Ajuste Positivo" }],
  tiposProyecto: ["Directo", "Indirecto", "Grupo"]
};
const invalido = mensaje => { throw Object.assign(new Error(mensaje), { status: 400 }); };
function validarEntrada(body = {}) {
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(body.solicitudId || "")) invalido("Identificador de solicitud no válido");
  if (body.tipoMovimiento !== "ajustePositivo") invalido("Tipo de movimiento no permitido");
  if (!configuracion.tiposProyecto.includes(body.tipoProyecto)) invalido("Tipo de proyecto no permitido");
  const datos = {};
  for (const campo of ["numeroProducto", "unidadMedida", "liquidacionOrden"]) {
    if (body[campo] != null && typeof body[campo] !== "string") invalido(`${campo} no válido`);
    datos[campo] = (body[campo] || "").trim();
    if (datos[campo].length > 100) invalido(`${campo} demasiado largo`);
  }
  if (!datos.numeroProducto || !datos.unidadMedida) invalido("Producto y unidad de medida son obligatorios");
  for (const campo of ["cantidad", "precioUnitario", "importe", "importeDto", "costeUnitario"]) {
    if (typeof body[campo] !== "number" || !Number.isFinite(body[campo]) || body[campo] < 0) invalido(`${campo} debe ser un número positivo o cero`);
    datos[campo] = body[campo];
  }
  if (datos.cantidad <= 0) invalido("La cantidad debe ser mayor que cero");
  return { ...datos, solicitudId: body.solicitudId, tipoMovimiento: body.tipoMovimiento, tipoProyecto: body.tipoProyecto };
}

async function siguienteDocumento() {
  const inicio = Number(process.env.ALMACEN_ULTIMO_DOCUMENTO || 0);
  if (!Number.isSafeInteger(inicio) || inicio < 0) throw new Error("ALMACEN_ULTIMO_DOCUMENTO no válido");
  try {
    await Secuencia.updateOne({ _id: "entradas" }, { $setOnInsert: { valor: inicio } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const secuencia = await Secuencia.findOneAndUpdate({ _id: "entradas" }, { $inc: { valor: 1 } }, { returnDocument: "after" });
  return `T${String(secuencia.valor).padStart(5, "0")}`;
}

async function crearEntrada(body, usuario) {
  const datos = validarEntrada(body);
  const existente = await Movimiento.findOne({ solicitudId: datos.solicitudId });
  if (existente) return existente;
  const [productos] = await Promise.all([bc.obtenerProductos(), bc.comprobarAlmacen()]);
  const producto = productos.find(item => item.numero === datos.numeroProducto);
  if (!producto) invalido("El producto no existe o está bloqueado en Business Central");
  const numeroDocumento = await siguienteDocumento();
  try {
    return await Movimiento.create({
      ...datos, numeroDocumento, descripcion: producto.descripcion,
      fechaRegistro: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()),
      codigoAlmacen: configuracion.codigoAlmacen, departamento: configuracion.departamento,
      creadoPor: usuario.email, estado: "pendienteBC"
    });
  } catch (error) {
    if (error.code === 11000) {
      const repetido = await Movimiento.findOne({ solicitudId: datos.solicitudId });
      if (repetido) return repetido;
    }
    throw error;
  }
}
module.exports = { configuracion, validarEntrada, siguienteDocumento, crearEntrada };
