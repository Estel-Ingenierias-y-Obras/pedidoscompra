const mongoose = require("mongoose");

const pedidoSchema = new mongoose.Schema({

  solicitante: {
    type: String,
    required: true
  },

  email: {
  type: String,
  required: true
},

  proyecto: {
    type: String,
    required: true
  },

  descripcion: {
    type: String
  },

  urgente: {
    type: Boolean,
    default: false
  },

  compradorAsignado: {
    type: String,
    default: ""
  },

  estado: {
    type: String,
    default: "Pendiente"
  },

  fechaCreacion: {
    type: Date,
    default: Date.now
  }

});

module.exports =
  mongoose.model(
    "Pedido",
    pedidoSchema
  );