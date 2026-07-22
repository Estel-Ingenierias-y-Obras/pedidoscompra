const express = require("express");

const router = express.Router();

const {
  obtenerProyectos
} = require(
  "../services/businessCentral"
);

router.get("/", async (req, res) => {

  try {

    const proyectos =
      await obtenerProyectos();

    res.json(proyectos);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }

});

module.exports = router;