const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  nombreNormalizado: { type: String, required: true, index: true },
  descripcion: { type: String, required: true, trim: true },
  referencia: { type: String, required: true, trim: true },
  referenciaNormalizada: { type: String, required: true, unique: true, index: true },
  unidadMedida: { type: String, required: true, trim: true },
  activo: { type: Boolean, default: true, index: true }
}, { timestamps: true, collection: "materiales" });

materialSchema.pre("validate", function normalizarMaterial() {
  this.nombre = String(this.nombre || "").trim();
  this.nombreNormalizado = this.nombre.toLocaleLowerCase("es");
  this.descripcion = String(this.descripcion || "").trim();
  this.referencia = String(this.referencia || "").trim();
  this.referenciaNormalizada = this.referencia.toLocaleUpperCase("es");
  this.unidadMedida = String(this.unidadMedida || "").trim();
});

module.exports = mongoose.model("Material", materialSchema);
