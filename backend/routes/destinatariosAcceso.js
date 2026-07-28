const express = require("express");
const mongoose = require("mongoose");
const DestinatarioAcceso = require("../models/DestinatarioAcceso");

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/", async (req, res) => {
  try {
    const destinatarios = await DestinatarioAcceso.find().sort({
      fechaCreacion: -1
    });

    res.json(destinatarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "Formato de email no válido" });
  }

  try {
    const destinatario = await DestinatarioAcceso.create({ email });
    res.status(201).json(destinatario);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "El correo ya está configurado"
      });
    }

    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Destinatario no válido" });
  }

  try {
    const destinatario = await DestinatarioAcceso.findByIdAndDelete(
      req.params.id
    );

    if (!destinatario) {
      return res.status(404).json({ error: "Destinatario no encontrado" });
    }

    res.json({ mensaje: "Destinatario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
