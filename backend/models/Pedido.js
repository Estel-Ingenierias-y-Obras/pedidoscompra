const mongoose = require("mongoose");

const archivoSchema = {
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
};

const elementoPedidoSchema = new mongoose.Schema({
  elemento: { type: String, required: true, trim: true },
  cantidad: { type: Number, required: true, min: 1, default: 1 },
  descripcion: { type: String, default: "", trim: true }
}, { _id: false });

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

  elementos: { type: [elementoPedidoSchema], default: [] },
  elementosUrgentes: { type: [elementoPedidoSchema], default: [] },
  elementosNoUrgentes: { type: [elementoPedidoSchema], default: [] },

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
    enum: ["Pendiente", "Pedido", "Archivar"],
    default: "Pendiente"
  },

  fechaCreacion: {
    type: Date,
    default: Date.now
  },

  archivos: {
    type: [archivoSchema],
    default: []
  },

  archivosDescripcion: {
    type: [archivoSchema],
    default: []
  },

  archivosUrgente: {
    type: [archivoSchema],
    default: []
  },

  archivosNoUrgente: {
    type: [archivoSchema],
    default: []
  },

  comentarioCompras: {
    type: String,
    default: ""
  },

  adjuntosCompras: {
    type: [archivoSchema],
    default: []
  }

});

module.exports =
  mongoose.model(
    "Pedido",
    pedidoSchema
  );
