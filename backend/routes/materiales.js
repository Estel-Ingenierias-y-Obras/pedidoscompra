const express = require("express");
const Material = require("../models/Material");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const { responderErrorInterno } = require("../utils/httpErrors");

const router = express.Router();
const rolesGestores = permitirRoles("Admin", "Comprador");

router.use(obtenerUsuarioActual);

router.get("/", async (req, res) => {
  try {
    const puedeGestionar = ["Admin", "Comprador"].includes(req.usuarioActual.rol);
    const incluirInactivos = puedeGestionar && req.query.incluirInactivos === "1";
    const materiales = await Material.find(incluirInactivos ? {} : { activo: true })
      .sort({ nombre: 1 })
      .lean();
    res.json(materiales);
  } catch (error) {
    responderErrorInterno(res, error, "Error obteniendo materiales:");
  }
});

router.post("/", rolesGestores, async (req, res) => {
  try {
    const material = await Material.create({
      nombre: req.body.nombre,
      categoria: req.body.categoria || "",
      activo: req.body.activo !== false
    });
    res.status(201).json(material);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "El material ya existe" });
    responderErrorInterno(res, error, "Error creando material:");
  }
});

router.put("/:id", rolesGestores, async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      {
        nombre,
        nombreNormalizado: nombre.toLocaleLowerCase("es"),
        categoria: String(req.body.categoria || "").trim(),
        activo: req.body.activo !== false
      },
      { returnDocument: "after", runValidators: true }
    );
    if (!material) return res.status(404).json({ error: "Material no encontrado" });
    res.json(material);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "El material ya existe" });
    responderErrorInterno(res, error, "Error actualizando material:");
  }
});

router.patch("/:id/desactivar", rolesGestores, async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { returnDocument: "after" }
    );
    if (!material) return res.status(404).json({ error: "Material no encontrado" });
    res.json(material);
  } catch (error) {
    responderErrorInterno(res, error, "Error desactivando material:");
  }
});

module.exports = router;
