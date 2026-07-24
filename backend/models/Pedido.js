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

  motivoUrgencia: {
    type: String,
    default: ""
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
  },

  archivos: {
    type: [{
      fileId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      nombre: {
        type: String,
        required: true
      },
      tipoMime: {
        type: String,
        required: true
      },
      tamano: {
        type: Number,
        required: true
      }
    }],
    default: []
  }

});

module.exports =
  mongoose.model(
    "Pedido",
    pedidoSchema
  );