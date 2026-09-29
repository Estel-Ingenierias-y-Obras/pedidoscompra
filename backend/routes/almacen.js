const express = require("express");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const servicio = require("../services/almacen");
const bc = require("../services/almacenBC");
const registro = require("../services/registroAlmacen");
const router = express.Router();
router.use(obtenerUsuarioActual, permitirRoles("Admin", "Comprador"));
const lectura = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (error) { next(error); } };
router.get("/configuracion", (req, res) => res.json(servicio.configuracion));
router.get("/productos", lectura(() => bc.obtenerProductos()));
router.get("/almacenes", lectura(() => bc.obtenerAlmacenes()));
router.get("/tipos-proyecto", lectura(() => bc.obtenerTiposProyecto()));
router.get("/unidades-producto", lectura(req => bc.obtenerUnidades(req.query.numprod)));
router.get("/movimientos-aplicables", lectura(req => bc.obtenerMovimientosAplicables(req.query.numprod)));
router.get("/operaciones", lectura(req => servicio.obtenerOperaciones(req.usuarioActual)));
router.get("/enviados", lectura(req => servicio.obtenerEnviados(req.usuarioActual)));
router.get("/registros-pendientes", lectura(req => registro.obtenerPendientes(req.usuarioActual)));
router.get("/entradas", lectura(() => bc.obtenerEntradas()));
router.get("/entradas/:id", lectura(req => bc.obtenerEntrada(req.params.id)));
router.post("/entradas", async (req, res, next) => {
  try {
    const resultado = await servicio.crearEntrada(req.body, req.usuarioActual);
    res.status(resultado.estado === "creada" ? 201 : resultado.estado === "rechazada" ? 422 : resultado.estado === "bloqueada" ? 409 : 202).json(resultado);
  } catch (error) { next(error); }
});
router.post("/entradas/:id/registrar", async (req, res, next) => {
  try {
    if (Object.keys(req.body || {}).some(key => key !== "claveintegracion")) return res.status(400).json({ error: "El registro solo admite la clave de la línea seleccionada." });
    const resultado = await registro.registrarEntrada({ idlinea: req.params.id, solicitudId: req.params.id, claveintegracion: req.body?.claveintegracion }, req.usuarioActual);
    res.status(resultado.estado === "creada" ? 200 : resultado.estado === "rechazada" ? 422 : resultado.estado === "bloqueada" ? 409 : 202).json(resultado);
  } catch (error) { next(error); }
});
for (const ruta of ["/movimientos", "/stock"]) router.get(ruta, (req, res) => res.status(501).json({ error: "Apartado previsto para una próxima fase" }));
router.use((error, req, res, next) => {
  // No devolver objetos Axios: contienen Authorization y configuración.
  res.status(error.status >= 400 && error.status <= 599 ? error.status : 503).json({ error: error.seguro ? error.message : "No se pudo completar la operación. Conserva los datos y reintenta la misma solicitud.", codigoError: error.codigo, definitivo: error.definitivo === true });
});
module.exports = router;
