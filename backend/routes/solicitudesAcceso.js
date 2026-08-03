const express = require("express");
const mongoose = require("mongoose");
const SolicitudAcceso = require("../models/SolicitudAcceso");
const Usuario = require("../models/Usuario");
const DestinatarioAcceso = require("../models/DestinatarioAcceso");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const { responderErrorInterno } = require("../utils/httpErrors");
const {
  sendAccessApprovedNotification,
  sendAccessRequestNotification
} = require("../services/emailService");

const router = express.Router();
const ROLES_VALIDOS = new Set(["Admin", "Comprador", "Usuario"]);

const escaparRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buscarUsuarioPorEmail = (email) =>
  Usuario.findOne({
    email: {
      $regex: `^${escaparRegex(email)}$`,
      $options: "i"
    }
  });

router.post("/", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const nombre = String(req.body.nombre || email).trim();
  const tenantId = String(req.body.tenantId || "").trim();

  if (!email || !nombre) {
    return res.status(400).json({
      error: "Nombre y email son obligatorios"
    });
  }

  try {
    const usuario = await buscarUsuarioPorEmail(email);

    if (usuario) {
      return res.json({
        autorizado: true,
        usuario: {
          _id: usuario._id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          activo: usuario.activo
        }
      });
    }

    let solicitud = await SolicitudAcceso.findOne({
      email,
      estado: "pendiente"
    });
    let creada = false;

    if (!solicitud) {
      try {
        solicitud = await SolicitudAcceso.create({
          nombre,
          email,
          tenantId
        });
        creada = true;
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }

        solicitud = await SolicitudAcceso.findOne({
          email,
          estado: "pendiente"
        });
      }
    }

    if (creada) {
      try {
        const destinatarios = await DestinatarioAcceso.find()
          .select("email")
          .lean();
        const recipients = destinatarios.map(item => item.email);

        if (recipients.length > 0) {
          await sendAccessRequestNotification({
            solicitud,
            recipients
          });
        }
      } catch (emailError) {
        console.error(
          `Error enviando nueva solicitud de acceso ${solicitud._id}:`,
          emailError.response?.data || emailError.message
        );
      }
    }

    res.status(202).json({
      autorizado: false,
      solicitudCreada: creada,
      solicitud
    });
  } catch (error) {
    responderErrorInterno(res, error, "Error gestionando solicitud de acceso:");
  }
});

router.get("/", obtenerUsuarioActual, permitirRoles("Admin"), async (req, res) => {
  try {
    const solicitudes = await SolicitudAcceso.find().sort({
      fechaSolicitud: -1
    });

    res.json(solicitudes);
  } catch (error) {
    responderErrorInterno(res, error, "Error gestionando solicitud de acceso:");
  }
});

router.patch("/:id/aprobar", obtenerUsuarioActual, permitirRoles("Admin"), async (req, res) => {
  const nombre = String(req.body.nombre || "").trim();
  const rol = String(req.body.rol || "").trim();

  if (!nombre || !ROLES_VALIDOS.has(rol)) {
    return res.status(400).json({
      error: "Nombre y rol válido son obligatorios"
    });
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Solicitud no válida" });
  }

  try {
    const solicitud = await SolicitudAcceso.findById(req.params.id);

    if (!solicitud) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (solicitud.estado !== "pendiente") {
      return res.status(409).json({
        error: "La solicitud ya ha sido resuelta"
      });
    }

    const usuarioExistente = await buscarUsuarioPorEmail(solicitud.email);

    if (usuarioExistente) {
      return res.status(409).json({
        error: "Ya existe un usuario con este email"
      });
    }

    const usuario = await Usuario.create({
      nombre,
      email: solicitud.email,
      rol
    });

    solicitud.nombre = nombre;
    solicitud.estado = "aprobada";
    await solicitud.save();

    try {
      await sendAccessApprovedNotification({
        email: solicitud.email,
        rol
      });
    } catch (emailError) {
      console.error(
        `Error enviando acceso aprobado a ${solicitud.email}:`,
        emailError.response?.data || emailError.message
      );
    }

    res.json({ solicitud, usuario });
  } catch (error) {
    const status = error.code === 11000 ? 409 : 500;
    if (status === 409) {
      return res.status(status).json({ error: error.message });
    }

    responderErrorInterno(res, error, "Error aprobando solicitud de acceso:");
  }
});

router.patch("/:id/rechazar", obtenerUsuarioActual, permitirRoles("Admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Solicitud no válida" });
  }

  try {
    const solicitud = await SolicitudAcceso.findOneAndUpdate(
      { _id: req.params.id, estado: "pendiente" },
      { estado: "rechazada" },
      { returnDocument: "after" }
    );

    if (!solicitud) {
      const existe = await SolicitudAcceso.exists({ _id: req.params.id });
      return res.status(existe ? 409 : 404).json({
        error: existe
          ? "La solicitud ya ha sido resuelta"
          : "Solicitud no encontrada"
      });
    }

    res.json(solicitud);
  } catch (error) {
    responderErrorInterno(res, error, "Error gestionando solicitud de acceso:");
  }
});

module.exports = router;


