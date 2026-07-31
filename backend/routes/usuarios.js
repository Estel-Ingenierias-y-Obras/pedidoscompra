const express = require("express");
const Usuario = require("../models/Usuario");

const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");

const router = express.Router();

router.use(obtenerUsuarioActual);

router.get("/", permitirRoles("Admin", "Comprador"), async (req, res) => {

  try {

    const usuarios =
      await Usuario.find();

    res.json(usuarios);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

router.post("/", permitirRoles("Admin"), async (req, res) => {

  try {

    const usuario =
      new Usuario(req.body);

    await usuario.save();

    res.status(201).json(usuario);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

router.put("/:id", permitirRoles("Admin"), async (req, res) => {

  try {

    const usuario =
        await Usuario.findByIdAndUpdate(
            req.params.id,
            req.body,
            { returnDocument: "after" }
        );

    res.json(usuario);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

router.delete("/:id", permitirRoles("Admin"), async (req, res) => {

  try {

    await Usuario.findByIdAndDelete(
      req.params.id
    );

    res.json({
      mensaje:
        "Usuario eliminado correctamente"
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

module.exports = router;