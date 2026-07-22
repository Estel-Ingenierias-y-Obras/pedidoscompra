const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema({

  nombre: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  rol: {
    type: String,
    required: true
  },

  activo: {
    type: Boolean,
    default: true
  }

});

module.exports =
  mongoose.model(
    "Usuario",
    usuarioSchema
  );