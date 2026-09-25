const express = require("express");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const servicio = require("../services/almacen");
const bc = require("../services/almacenBC");
const Movimiento = require("../models/MovimientoAlmacen");
const router = express.Router();
router.use(obtenerUsuarioActual, permitirRoles("Admin", "Comprador"));
router.get("/configuracion", (req, res) => res.json(servicio.configuracion));
router.get("/productos", async (req, res, next) => {
  try { res.json(await bc.obtenerProductos()); } catch (error) { next(error); }
});
router.get("/entradas", async (req, res, next) => {
  try {
    const pagina = Math.max(1, Math.min(100000, parseInt(req.query.pagina, 10) || 1));
    const filtro = { tipoMovimiento: "ajustePositivo" };
    const [entradas, total] = await Promise.all([
      Movimiento.find(filtro).sort({ createdAt: -1, _id: -1 }).skip((pagina - 1) * 50).limit(50).lean(),
      Movimiento.countDocuments(filtro)
    ]);
    res.json({ entradas, total, pagina });
  } catch (error) { next(error); }
});
router.post("/entradas", async (req, res, next) => {
  try { res.status(201).json(await servicio.crearEntrada(req.body, req.usuarioActual)); }
  catch (error) { next(error); }
});
// No devolver stock ficticio: se habilitará al integrar el registro contable de BC.
for (const ruta of ["/movimientos", "/stock"]) {
  router.get(ruta, (req, res) => res.status(501).json({ error: "Apartado previsto para una próxima fase" }));
}
router.use((error, req, res, next) => {
  const status = error.status || (error.name === "ValidationError" ? 400 : 502);
  res.status(status).json({ error: error.status ? error.message : "No se pudo completar la operación de almacén. Puedes reintentar sin duplicar la entrada." });
});
module.exports = router;
