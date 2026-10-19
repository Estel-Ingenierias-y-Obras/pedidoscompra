const logger = require("./utils/logger");
require("dotenv").config({ quiet: true });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const usuariosRoutes = require("./routes/usuarios");
const pedidosRoutes = require("./routes/pedidos");
const proyectosRoutes = require("./routes/proyectos");
const solicitudesAccesoRoutes = require("./routes/solicitudesAcceso");
const materialesRoutes = require("./routes/materiales");
const destinatariosAccesoRoutes = require("./routes/destinatariosAcceso");
const destinatariosCompraRoutes = require("./routes/destinatariosCompra");
const Pedido = require("./models/Pedido");

const app = express();
const port = process.env.PORT || 5000;
const frontendBuildPath = path.join(__dirname, "../frontend/build");

const configurarCors = () => {
  const origenesPermitidos = new Set(process.env.NODE_ENV === "production" ? [] : [
    "http://localhost:3000", "http://localhost:5000"
  ]);

  if (process.env.FRONTEND_URL) {
    origenesPermitidos.add(process.env.FRONTEND_URL);
  }

  return {
    origin: (origin, callback) => {
      if (!origin || origenesPermitidos.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };
};

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'self'");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(cors(configurarCors()));
app.use(express.json({ limit: "100kb" }));

const migrarAdjuntosPorBloque = async () => {
  const pedidos = await Pedido.find({
    archivos: { $exists: true, $ne: [] }
  }).cursor();

  for await (const pedido of pedidos) {
    const archivosExistentes = pedido.archivos || [];

    if (archivosExistentes.length === 0) {
      continue;
    }

    if (!pedido.urgente && (!pedido.archivosDescripcion || pedido.archivosDescripcion.length === 0)) {
      pedido.archivosDescripcion = archivosExistentes;
      await pedido.save();
      continue;
    }

    if (pedido.urgente && (!pedido.archivosNoUrgente || pedido.archivosNoUrgente.length === 0)) {
      pedido.archivosNoUrgente = archivosExistentes;
      await pedido.save();
    }
  }
};

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    logger.info("database.connected");
    await migrarAdjuntosPorBloque();
  })
  .catch((error) => {
    logger.error("database.connection_failed");
    process.exit(1);
  });

app.get("/healthz", (req, res) => {
  const listo = mongoose.connection.readyState === 1;
  res.status(listo ? 200 : 503).json({ status: listo ? "ok" : "unavailable" });
});

app.use("/api/usuarios", usuariosRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/proyectos", proyectosRoutes);
app.use("/api/materiales", materialesRoutes);
app.use("/api/almacen", require("./routes/almacen"));
app.use("/api/solicitudes-acceso", solicitudesAccesoRoutes);
app.use(
  "/api/configuracion/notificaciones-acceso",
  destinatariosAccesoRoutes
);
app.use(
  "/api/configuracion/notificaciones-compras",
  destinatariosCompraRoutes
);
app.use("/api", (req, res) => res.status(404).json({ error: "Recurso no encontrado" }));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendBuildPath));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("API funcionando");
  });
}

app.use((error, req, res, next) => {
  logger.error("http.request_failed", { status: error.status });
  if (res.headersSent) return next(error);
  res.status(error.status === 413 ? 413 : error.status === 400 ? 400 : 500)
    .json({ error: error.status === 413 ? "La solicitud supera el tamaño permitido" : "No se pudo procesar la solicitud" });
});

app.listen(port, "0.0.0.0", () => {
  logger.info("application.ready");
});





