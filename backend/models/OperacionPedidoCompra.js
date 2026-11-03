const mongoose = require("mongoose");
module.exports = mongoose.model("OperacionPedidoCompra", new mongoose.Schema({
  _id: String,
  usuario: { type: String, required: true },
  destino: { type: String, required: true },
  huella: { type: String, required: true },
  cuerpo: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true, collection: "operacionesPedidosCompra" }));
