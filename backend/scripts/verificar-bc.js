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
    ...["productos", "diarioProductos", "tiposProyecto", "registrosProducto"].map(nombre => [nombre, `${config.custom}/${nombre}`])
  ];
  if (process.env.BC_TEST_ITEM) {
    const unidades = new URL(`${config.custom}/unidadesProducto`);
    unidades.search = new URLSearchParams({ $filter: `numprod eq '${process.env.BC_TEST_ITEM.replace(/'/g, "''")}'` }).toString();
    endpoints.push(["unidadesProducto", unidades.href], ["movimientosAplicables", unidades.href.replace("/unidadesProducto?", "/movimientosAplicables?")]);
  } else console.log("Unidades: pendiente; definir BC_TEST_ITEM para consultar un material concreto.");
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
