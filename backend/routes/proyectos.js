const express = require("express");

const { obtenerUsuarioActual } = require("../middleware/auth");
const { responderErrorInterno } = require("../utils/httpErrors");

const router = express.Router();

router.use(obtenerUsuarioActual);

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

    console.error("Consulta de proyectos BC fallida", { status: error.response?.status || error.status, codigo: error.code });

    responderErrorInterno(res, error, "Error interno en ruta:");

  }

});

module.exports = router;

