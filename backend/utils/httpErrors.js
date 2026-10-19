const logger = require("./logger");
const obtenerMensajeErrorInterno = () => "No se pudo completar la operación. Inténtalo de nuevo.";

const responderErrorInterno = (res, error, contexto = "Error interno") => {
  logger.error("application.error", { status: error.status || error.response?.status });
  res.status(500).json({ error: obtenerMensajeErrorInterno(error) });
};

module.exports = {
  obtenerMensajeErrorInterno,
  responderErrorInterno
};
