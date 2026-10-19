// Solo eventos de aplicación y metadatos numéricos. Nunca serializa errores,
// peticiones, credenciales ni objetos de servicios externos.
const niveles = { INFO: 0, WARN: 1, ERROR: 2, SILENT: 3 };
const escribir = (nivel, evento, datos = {}) => {
  const minimo = String(process.env.LOG_LEVEL || "INFO").toUpperCase();
  if (niveles[nivel] < (niveles[minimo] ?? niveles.INFO)) return;
  const registro = { timestamp: new Date().toISOString(), level: nivel,
    event: /^[a-z][a-z._]{0,63}$/.test(evento) ? evento : "application.event" };
  if (Number.isInteger(datos.status) && datos.status >= 100 && datos.status <= 599) registro.status = datos.status;
  if (Number.isSafeInteger(datos.count) && datos.count >= 0) registro.count = datos.count;
  const salida = nivel === "ERROR" ? console.error : nivel === "WARN" ? console.warn : console.info;
  salida(JSON.stringify(registro));
};
module.exports = { info: (evento, datos) => escribir("INFO", evento, datos),
  warn: (evento, datos) => escribir("WARN", evento, datos),
  error: (evento, datos) => escribir("ERROR", evento, datos) };
