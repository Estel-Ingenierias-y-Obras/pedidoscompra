const PUBLIC_ORIGIN = "https://pedidoscompra.esteling.com";

function frontendOrigin(env = process.env) {
  const url = new URL(env.FRONTEND_URL || PUBLIC_ORIGIN);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("FRONTEND_URL debe ser un origen HTTP(S), sin ruta ni credenciales");
  }
  return url.origin;
}

function configurarCors(env = process.env) {
  const origins = new Set([PUBLIC_ORIGIN, frontendOrigin(env)]);
  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:5000");
  }
  return {
    origin(origin, callback) {
      if (!origin || origins.has(origin)) return callback(null, true);
      const error = new Error("Origen no permitido por CORS");
      error.status = 403;
      callback(error);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };
}

module.exports = { frontendOrigin, configurarCors };
