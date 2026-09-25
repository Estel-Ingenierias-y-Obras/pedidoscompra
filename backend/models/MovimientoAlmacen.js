const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  solicitudId: { type: String, required: true, unique: true },
  numeroDocumento: { type: String, required: true, unique: true },
  fechaRegistro: { type: String, required: true },
  tipoMovimiento: { type: String, enum: ["ajustePositivo"], required: true },
  numeroProducto: { type: String, required: true },
  descripcion: { type: String, required: true },
  codigoAlmacen: { type: String, enum: ["CENTRAL 3"], required: true },
  cantidad: { type: Number, required: true, min: Number.MIN_VALUE },
  unidadMedida: { type: String, required: true },
  precioUnitario: { type: Number, min: 0 },
  importe: { type: Number, min: 0 },
  importeDto: { type: Number, min: 0 },
  costeUnitario: { type: Number, min: 0 },
  liquidacionOrden: { type: String, default: "" },
  tipoProyecto: { type: String, enum: ["Directo", "Indirecto", "Grupo"], required: true },
  departamento: { type: String, enum: ["SG-ALMACEN"], required: true },
  estado: { type: String, enum: ["pendienteBC", "enviadoBC", "registradoBC", "errorBC"], default: "pendienteBC", index: true },
  bcSystemId: String,
  errorSincronizacion: String,
  creadoPor: { type: String, required: true }
}, { timestamps: true, collection: "movimientosAlmacen" });

module.exports = mongoose.model("MovimientoAlmacen", schema);
