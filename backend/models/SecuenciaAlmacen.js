const mongoose = require("mongoose");

module.exports = mongoose.model("SecuenciaAlmacen", new mongoose.Schema({
  _id: String,
  valor: { type: Number, required: true }
}, { collection: "secuenciasAlmacen" }));
