const express = require("express");
const Pedido = require("../models/Pedido");

const router = express.Router();

router.get("/", async (req, res) => {

  try {

    const pedidos =
      await Pedido.find();

    res.json(pedidos);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

router.post("/", async (req, res) => {

  try {

    const pedido =
      new Pedido(req.body);

    await pedido.save();

    res.status(201).json(pedido);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

router.put("/:id", async (req, res) => {

  try {

    const pedido =
      await Pedido.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          returnDocument: "after"
        }
      );

    res.json(pedido);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

router.delete("/:id", async (req, res) => {

  try {

    await Pedido.findByIdAndDelete(
      req.params.id
    );

    res.json({
      mensaje:
        "Pedido eliminado"
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

module.exports = router;