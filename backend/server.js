require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const usuariosRoutes = require("./routes/usuarios");
const pedidosRoutes = require("./routes/pedidos");
const proyectosRoutes = require("./routes/proyectos");

const app = express();

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

app.get("/", (req, res) => {
  res.send("API funcionando");
});

app.use(
  "/api/usuarios",
  usuariosRoutes
);

app.use(
  "/api/pedidos",
  pedidosRoutes
);

app.use(
  "/api/proyectos",
  proyectosRoutes
);


app.listen(process.env.PORT, () => {
  console.log(
    `Servidor ejecutándose en puerto ${process.env.PORT}`
  );
});