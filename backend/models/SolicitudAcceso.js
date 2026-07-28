const mongoose = require("mongoose");

const ESTADOS_SOLICITUD = [
  "pendiente",
  "aprobada",
  "rechazada"
];

const solicitudAccesoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    tenantId: {
      type: String,
      trim: true,
      default: ""
    },
    fechaSolicitud: {
      type: Date,
      default: Date.now,
      required: true
    },
    estado: {
      type: String,
      enum: ESTADOS_SOLICITUD,
      default: "pendiente",
      required: true
    }
  },
  { collection: "solicitudes_acceso" }
);

solicitudAccesoSchema.index(
  { email: 1, estado: 1 },
  {
    unique: true,
    partialFilterExpression: { estado: "pendiente" }
  }
);

module.exports = mongoose.model(
  "SolicitudAcceso",
  solicitudAccesoSchema
);
