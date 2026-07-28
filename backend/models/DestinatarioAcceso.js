const mongoose = require("mongoose");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const destinatarioAccesoSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: value => EMAIL_PATTERN.test(value),
        message: "Formato de email no válido"
      }
    },
    fechaCreacion: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  { collection: "destinatarios_acceso" }
);

module.exports = mongoose.model(
  "DestinatarioAcceso",
  destinatarioAccesoSchema
);
