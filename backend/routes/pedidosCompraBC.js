const express = require("express");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const bc = require("../services/pedidosCompraBC");
const logger = require("../utils/logger");
const router = express.Router();
router.use(obtenerUsuarioActual, permitirRoles("Admin", "Comprador"));
router.get("/", async (req, res, next) => { try { res.json(await bc.listar(req.query)); } catch (error) { next(error); } });
router.get("/:numero/lineas", async (req, res, next) => { try { res.json(await bc.lineas(req.params.numero)); } catch (error) { next(error); } });
router.use((error, req, res, next) => {
  logger.error("bc.purchase.read.error");
  res.status(error.seguro ? error.status : 502).json({ error: error.seguro ? error.message : "No se pudieron consultar los pedidos. Comprueba que la ampliación de PedidosCompraALL esté publicada en BC y tenga permisos de lectura." });
});
module.exports = router;
