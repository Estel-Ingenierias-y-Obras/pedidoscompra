const logger = require("../utils/logger");
const express = require("express");

const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const { responderErrorInterno } = require("../utils/httpErrors");

const router = express.Router();

router.use(obtenerUsuarioActual);
router.use(permitirRoles("Admin", "Comprador", "Usuario", "Encargado"));

const {
  obtenerProyectos
} = require(
  "../services/businessCentral"
);

router.get("/", async (req, res) => {

  try {

    const proyectos =
      await obtenerProyectos({ soloAbiertos: req.query.soloAbiertos === "true" });

    res.json(proyectos);

  } catch (error) {

    logger.error("bc.error");

    responderErrorInterno(res, error, "Error interno en ruta:");

  }

});

module.exports = router;

