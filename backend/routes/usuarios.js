const express = require("express");
const Usuario = require("../models/Usuario");
const mongoose = require("mongoose");

const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const { responderErrorInterno } = require("../utils/httpErrors");

const router = express.Router();
const datosUsuario = (body, parcial = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length
    || Object.keys(body).some(k => !["nombre", "email", "rol", "activo"].includes(k))) return null;
  const datos = {};
  for (const campo of ["nombre", "email", "rol"]) {
    if (!(campo in body) && parcial) continue;
    if (typeof body[campo] !== "string" || !body[campo].trim() || body[campo].length > 320) return null;
    datos[campo] = body[campo].trim();
  }
  if (datos.email) {
    datos.email = datos.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) return null;
  }
  if (datos.rol && !["Admin", "Comprador", "Usuario", "Encargado"].includes(datos.rol)) return null;
  if ("activo" in body) { if (typeof body.activo !== "boolean") return null; datos.activo = body.activo; }
  return datos;
};

router.use(obtenerUsuarioActual);

router.get("/compradores", permitirRoles("Admin", "Comprador"), async (req, res) => {
  try {
    const compradores = await Usuario.find({ rol: "Comprador", activo: { $ne: false } })
      .select("nombre rol")
      .lean();
    res.json(compradores);
  } catch (error) {
    responderErrorInterno(res, error, "Error consultando compradores:");
  }
});

router.get("/", permitirRoles("Admin"), async (req, res) => {

  try {

    const usuarios =
      await Usuario.find();

    res.json(usuarios);

  } catch (error) {

    responderErrorInterno(res, error, "Error interno en ruta:");

  }

});

router.post("/", permitirRoles("Admin"), async (req, res) => {
  const datos = datosUsuario(req.body);
  if (!datos) return res.status(400).json({ error: "Datos de usuario no válidos" });

  try {

    const usuario =
      new Usuario(datos);

    await usuario.save();

    res.status(201).json(usuario);

  } catch (error) {

    responderErrorInterno(res, error, "Error interno en ruta:");

  }

});

router.put("/:id", permitirRoles("Admin"), async (req, res) => {
  const datos = datosUsuario(req.body, true);
  if (!datos || !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Datos de usuario no válidos" });

  try {

    const usuario =
        await Usuario.findByIdAndUpdate(
            req.params.id,
            { $set: datos },
            { returnDocument: "after", runValidators: true }
        );

    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(usuario);

  } catch (error) {

    responderErrorInterno(res, error, "Error interno en ruta:");

  }

});

router.delete("/:id", permitirRoles("Admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Usuario no válido" });

  try {

    await Usuario.findByIdAndDelete(
      req.params.id
    );

    res.json({
      mensaje:
        "Usuario eliminado correctamente"
    });

  } catch (error) {

    responderErrorInterno(res, error, "Error interno en ruta:");

  }

});

module.exports = router;

