const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  nombreNormalizado: { type: String, required: true, unique: true, index: true },
  activo: { type: Boolean, default: true, index: true }
}, { timestamps: true, collection: "materiales" });

materialSchema.pre("validate", function normalizarNombre() {
  this.nombre = String(this.nombre || "").trim();
  this.nombreNormalizado = this.nombre.toLocaleLowerCase("es");
});

module.exports = mongoose.model("Material", materialSchema);
