const logger = require("../utils/logger");
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
    ...["productos", "diarioProductos", "tiposProyecto", "registrosProducto",
      "acopios", "lineasAcopio", "solicitudesAcopio", "recursosCandidatosAcopio", "valoresDimensionAcopio"
    ].map(nombre => [nombre, `${config.custom}/${nombre}`])
  ];
  if (process.env.BC_TEST_ITEM) {
    const unidades = new URL(`${config.custom}/unidadesProducto`);
    unidades.search = new URLSearchParams({ $filter: `numprod eq '${process.env.BC_TEST_ITEM.replace(/'/g, "''")}'` }).toString();
    endpoints.push(["unidadesProducto", unidades.href], ["movimientosAplicables", unidades.href.replace("/unidadesProducto?", "/movimientosAplicables?")]);
  } else logger.info("diagnostic.optional_skipped");
  for (const [, url] of endpoints) {
    logSolicitudBC(url);
    try {
      const response = await axios.get(url, { params: { $top: 1 }, headers: { Authorization: `Bearer ${token}` }, proxy: false, timeout: 15000, maxRedirects: 0 });
      const valido = Array.isArray(response.data?.value);
      logger.info("diagnostic.endpoint_checked", { status: response.status });
      if (!valido) process.exitCode = 1;
    } catch (error) {
      logger.warn("diagnostic.endpoint_failed", { status: error.response?.status });
      process.exitCode = 1;
    }
  }
  logger.info("diagnostic.completed", { count: endpoints.length });
}
main().catch(error => { logger.error("diagnostic.failed"); process.exitCode = 1; });
