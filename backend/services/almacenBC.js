const axios = require("axios");
const { obtenerToken } = require("./businessCentral");

// Contrato de lectura de la futura API AL; credenciales exclusivamente en backend.
async function leerColeccion(variable) {
  const endpoint = process.env[variable];
  if (!endpoint) throw Object.assign(new Error("La conexión de almacén con Business Central todavía no está configurada."), { status: 503 });
  const origen = new URL(endpoint);
  if (origen.protocol !== "https:") throw new Error("La API de almacén requiere HTTPS");
  const token = await obtenerToken();
  let siguiente = endpoint;
  const resultado = [];
  const visitadas = new Set();
  while (siguiente) {
    const url = new URL(siguiente, endpoint);
    if (url.origin !== origen.origin || visitadas.has(url.href) || visitadas.size >= 1000) throw new Error("Paginación de BC no válida");
    visitadas.add(url.href);
    const { data } = await axios.get(url.href, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000, maxRedirects: 0, proxy: false });
    if (!Array.isArray(data.value)) throw new Error("Respuesta de BC no válida");
    resultado.push(...data.value);
    siguiente = data["@odata.nextLink"];
  }
  return resultado;
}

async function obtenerProductos() {
  const items = await leerColeccion("BC_ALMACEN_ITEMS_URL");
  return items.filter(item => !item.blocked).map(item => ({
    numero: item.number, descripcion: item.displayName, unidadMedida: item.baseUnitOfMeasureCode || ""
  })).filter(item => item.numero && item.descripcion);
}

async function comprobarAlmacen() {
  const locations = await leerColeccion("BC_ALMACEN_LOCATIONS_URL");
  if (!locations.some(location => location.code === "CENTRAL 3")) {
    throw Object.assign(new Error("El almacén CENTRAL 3 no existe en Business Central."), { status: 422 });
  }
}

module.exports = { obtenerProductos, comprobarAlmacen };
