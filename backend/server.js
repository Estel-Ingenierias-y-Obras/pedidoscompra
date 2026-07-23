require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const usuariosRoutes = require("./routes/usuarios");
const pedidosRoutes = require("./routes/pedidos");
const proyectosRoutes = require("./routes/proyectos");

const app = express();
const port = process.env.PORT || 5000;
const frontendBuildPath = path.join(__dirname, "../frontend/build");

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB conectado");
  })
  .catch((error) => {
    console.log(error);
  });

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/usuarios", usuariosRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/proyectos", proyectosRoutes);

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor ejecutándose en puerto ${port}`);
});