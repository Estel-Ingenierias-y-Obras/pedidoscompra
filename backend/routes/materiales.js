const express = require("express");
const mongoose = require("mongoose");
const Material = require("../models/Material");
const multer = require("multer");
const { leerMateriales, importarFilas } = require("../services/importarMateriales");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const { responderErrorInterno } = require("../utils/httpErrors");

const router = express.Router();
const rolesGestores = permitirRoles("Admin", "Comprador");
const obtenerDatosMaterial = body => ({
  descripcion: String(body?.descripcion || "").trim(),
  referencia: String(body?.referencia || "").trim(),
  cantidad: body?.cantidad,
  coste: body?.coste
});

const validarDatosMaterial = datos => {
  if (!datos.referencia || !datos.descripcion) return "Referencia y descripción son obligatorias";
  if (![datos.cantidad, datos.coste].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) return "Cantidad y coste deben ser números no negativos";
  return null;
};

const serializarMaterial = material => ({
  _id: material._id,
  nombre: material.nombre,
  descripcion: material.descripcion,
  referencia: material.referencia,
  cantidad: material.cantidad ?? 0,
  coste: material.coste ?? 0,
  activo: material.activo,
  createdAt: material.createdAt,
  updatedAt: material.updatedAt
});

router.use(obtenerUsuarioActual);
router.use(permitirRoles("Admin", "Comprador", "Usuario", "Encargado"));

const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }).single("archivo");
router.post("/importar", rolesGestores, (req, res, next) => {
  uploadExcel(req, res, error => error
    ? res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Excel no válido o superior a 5 MB" })
    : next());
}, async (req, res) => {
  if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) return res.status(400).json({ error: "Selecciona un archivo Excel .xlsx" });
  let filas;
  try { filas = await leerMateriales(req.file.buffer); }
  catch (error) { return res.status(400).json({ error: `No se pudo leer el Excel: ${error.message}` }); }
  try { res.json(await importarFilas(filas, Material)); }
  catch (error) { responderErrorInterno(res, error, "Error importando materiales:"); }
});

router.get("/", async (req, res) => {
  try {
    const puedeGestionar = ["Admin", "Comprador"].includes(req.usuarioActual.rol);
    const incluirInactivos = puedeGestionar && req.query.incluirInactivos === "1";
    const materiales = await Material.find(incluirInactivos ? {} : { activo: true })
      .select("nombre descripcion referencia cantidad coste activo createdAt updatedAt")
      .sort({ referencia: 1 })
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
      .select("nombre descripcion referencia cantidad coste activo createdAt updatedAt")
      .lean();
    if (!material || (material.activo === false && !["Admin", "Comprador"].includes(req.usuarioActual.rol))) return res.status(404).json({ error: "Material no encontrado" });
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
