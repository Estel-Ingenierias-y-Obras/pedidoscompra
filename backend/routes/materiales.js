const express = require("express");
const mongoose = require("mongoose");
const Material = require("../models/Material");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const { responderErrorInterno } = require("../utils/httpErrors");

const router = express.Router();
const rolesGestores = permitirRoles("Admin", "Comprador");
const obtenerDatosMaterial = body => ({
  nombre: String(body?.nombre || "").trim(),
  descripcion: String(body?.descripcion || "").trim(),
  referencia: String(body?.referencia || "").trim(),
  unidadMedida: String(body?.unidadMedida || "").trim()
});

const validarDatosMaterial = datos => {
  return Object.values(datos).every(Boolean)
    ? null
    : "Material, descripción, referencia y unidades son obligatorios";
};

const serializarMaterial = material => ({
  _id: material._id,
  nombre: material.nombre,
  descripcion: material.descripcion,
  referencia: material.referencia,
  unidadMedida: material.unidadMedida,
  activo: material.activo,
  createdAt: material.createdAt,
  updatedAt: material.updatedAt
});

router.use(obtenerUsuarioActual);

router.get("/", async (req, res) => {
  try {
    const puedeGestionar = ["Admin", "Comprador"].includes(req.usuarioActual.rol);
    const incluirInactivos = puedeGestionar && req.query.incluirInactivos === "1";
    const materiales = await Material.find(incluirInactivos ? {} : { activo: true })
      .select("nombre descripcion referencia unidadMedida activo createdAt updatedAt")
      .sort({ nombre: 1 })
      .lean();
    res.json(materiales.map(serializarMaterial));
  } catch (error) {
    responderErrorInterno(res, error, "Error obteniendo materiales:");
  }
});

router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Material no válido" });
  }

  try {
    const material = await Material.findById(req.params.id)
      .select("nombre descripcion referencia unidadMedida activo createdAt updatedAt")
      .lean();
    if (!material) return res.status(404).json({ error: "Material no encontrado" });
    res.json(serializarMaterial(material));
  } catch (error) {
    responderErrorInterno(res, error, "Error obteniendo material:");
  }
});

router.post("/", rolesGestores, async (req, res) => {
  try {
    const datos = obtenerDatosMaterial(req.body);
    const errorValidacion = validarDatosMaterial(datos);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const material = await Material.create({
      ...datos,
      activo: req.body.activo !== false
    });
    res.status(201).json(serializarMaterial(material));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Ya existe un material con esa referencia" });
    if (error.name === "ValidationError") return res.status(400).json({ error: error.message });
    responderErrorInterno(res, error, "Error creando material:");
  }
});

router.put("/:id", rolesGestores, async (req, res) => {
  try {
    const datos = obtenerDatosMaterial(req.body);
    const errorValidacion = validarDatosMaterial(datos);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const material = await Material.findByIdAndUpdate(
      req.params.id,
      {
        ...datos,
        nombreNormalizado: datos.nombre.toLocaleLowerCase("es"),
        referenciaNormalizada: datos.referencia.toLocaleUpperCase("es"),
        activo: req.body.activo !== false
      },
      { returnDocument: "after", runValidators: true }
    );
    if (!material) return res.status(404).json({ error: "Material no encontrado" });
    res.json(serializarMaterial(material));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Ya existe un material con esa referencia" });
    if (error.name === "ValidationError") return res.status(400).json({ error: error.message });
    responderErrorInterno(res, error, "Error actualizando material:");
  }
});

router.delete("/:id", rolesGestores, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Material no válido" });
  }

  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) return res.status(404).json({ error: "Material no encontrado" });
    res.json({ mensaje: "Material eliminado correctamente" });
  } catch (error) {
    responderErrorInterno(res, error, "Error eliminando material:");
  }
});

module.exports = router;
