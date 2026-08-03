const obtenerMensajeErrorInterno = (error) =>
  process.env.NODE_ENV === "production"
    ? "Error interno del servidor"
    : error.message;

const responderErrorInterno = (res, error, contexto = "Error interno") => {
  console.error(contexto, error);
  res.status(500).json({ error: obtenerMensajeErrorInterno(error) });
};

module.exports = {
  obtenerMensajeErrorInterno,
  responderErrorInterno
};
