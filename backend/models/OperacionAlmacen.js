const mongoose = require("mongoose");
// _id identifica la operación web; claveintegracion se genera exclusivamente en Node.
module.exports = mongoose.model("OperacionAlmacen", new mongoose.Schema({
  _id: String,
  creadoPor: { type: String, required: true, index: true },
  destino: { type: String, required: true },
  claveintegracion: { type: String, required: true, unique: true },
  cuerpo: { type: mongoose.Schema.Types.Mixed, required: true },
  huella: { type: String, required: true },
  estado: { type: String, enum: ["preparada", "procesando", "incierta", "creada", "rechazada", "bloqueada"], required: true },
  bloqueoHasta: Date, proximoIntento: Date, tokenBloqueo: String,
  intentos: { type: Number, default: 0 },
  respuesta: mongoose.Schema.Types.Mixed,
  bcSystemId: String, numeroDocumento: String, error: String, codigoError: String
}, { timestamps: true, collection: "operacionesAlmacen" }));
