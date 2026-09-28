// Solo GET: no crea ni registra entradas ni modifica existencias.
require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), quiet: true });
const axios = require("axios");
const { obtenerToken } = require("../services/businessCentral");
const { configuracionBC, urlProyectos, logSolicitudBC } = require("../services/bcConfig");

async function main() {
  const config = configuracionBC();
  const token = await obtenerToken();
  const endpoints = [
    ["proyectos", urlProyectos()],
    ...["items", "locations"].map(nombre => [nombre, `${config.standard}/${nombre}`]),
    ...["diarioProductos", "tiposProyecto", "unidadesProducto", "movimientosAplicables", "registrosProducto"].map(nombre => [nombre, `${config.custom}/${nombre}`])
  ];
  for (const [nombre, url] of endpoints) {
    logSolicitudBC(url);
    try {
      const response = await axios.get(url, { params: { $top: 1 }, headers: { Authorization: `Bearer ${token}` }, proxy: false, timeout: 15000, maxRedirects: 0 });
      const valido = Array.isArray(response.data?.value);
      console.log(JSON.stringify({ endpoint: nombre, status: response.status, coleccionValida: valido }));
      if (!valido) process.exitCode = 1;
    } catch (error) {
      console.log(JSON.stringify({ endpoint: nombre, status: error.response?.status || "sin respuesta", codigo: error.response?.data?.error?.code || error.code }));
      process.exitCode = 1;
    }
  }
}
main().catch(error => { console.error(error.isAxiosError ? `Autenticación BC: HTTP ${error.response?.status || "sin respuesta"}` : error.message); process.exitCode = 1; });
