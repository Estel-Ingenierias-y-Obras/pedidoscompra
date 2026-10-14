const mongoose = require("mongoose");

// Historial exclusivo de acopios creados y confirmados en BC desde la web.
// No reutiliza la colección del diario de productos.
const schema = new mongoose.Schema({
  solicitudId: { type: String, required: true },
  entorno: { type: String, required: true },
  empresa: { type: String, required: true },
  creadoPor: { type: String, required: true },
  bcId: String,
  bcRequestId: String,
  creacionIntentada: { type: Boolean, default: false },
  numero: String,
  estado: { type: String, enum: ["borrador", "enviadoBC", "registrado", "error"], required: true },
  confirmadoBC: { type: Boolean, default: false, required: true },
  fechaEnvio: Date,
  fechaRegistro: Date,
  cabecera: { type: mongoose.Schema.Types.Mixed, required: true },
  lineas: { type: [mongoose.Schema.Types.Mixed], required: true },
  datosEnviados: { type: mongoose.Schema.Types.Mixed, required: true },
  comprobanteRegistro: mongoose.Schema.Types.Mixed,
  error: String
}, { timestamps: true, collection: "enviosAcopio" });
schema.index({ entorno: 1, empresa: 1, solicitudId: 1 }, { unique: true });
schema.index({ entorno: 1, empresa: 1, creadoPor: 1, fechaEnvio: -1 });
module.exports = mongoose.model("EnvioAcopio", schema);
