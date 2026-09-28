// Consulta de solo lectura en BC y configuración local. No crea líneas de diario.
const fs = require("node:fs");
const path = require("node:path");
const axios = require("axios");
const dotenv = require("dotenv");
const { obtenerToken } = require("../services/businessCentral");

async function main() {
  const [entorno, empresa] = process.argv.slice(2);
  if (!entorno || !empresa) throw new Error("Indica el entorno y el nombre exacto de empresa.");
  const archivo = path.join(__dirname, "../.env");
  const contenido = fs.readFileSync(archivo, "utf8");
  dotenv.config({ path: archivo, quiet: true });
  if (!/^[0-9a-f-]{36}$/i.test(process.env.TENANT_ID || "")) throw new Error("TENANT_ID no configurado correctamente.");
  const raiz = `https://api.businesscentral.dynamics.com/v2.0/${process.env.TENANT_ID}/${encodeURIComponent(entorno)}/api/v2.0/companies`;
  const token = await obtenerToken();
  const empresas = [], visitadas = new Set();
  let siguiente = raiz;
  while (siguiente) {
    const url = new URL(siguiente, raiz);
    if (url.origin !== new URL(raiz).origin || url.pathname !== new URL(raiz).pathname || url.username || url.password || visitadas.has(url.href) || visitadas.size >= 100) throw new Error("Paginación de empresas no válida.");
    visitadas.add(url.href);
    const { data } = await axios.get(url.href, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000, maxRedirects: 0, proxy: false });
    if (!Array.isArray(data.value)) throw new Error("Respuesta de empresas no válida.");
    empresas.push(...data.value);
    siguiente = data["@odata.nextLink"];
  }
  const normalizar = valor => String(valor || "").normalize("NFC").trim().toLocaleLowerCase("es");
  const coincidencias = empresas.filter(item => [item.name, item.displayName].some(nombre => normalizar(nombre) === normalizar(empresa)));
  if (coincidencias.length !== 1) throw new Error(`Se encontraron ${coincidencias.length} coincidencias exactas para la empresa indicada. No se ha cambiado la configuración.`);
  const encontrada = coincidencias[0];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(encontrada.id)) throw new Error("BC no devolvió un UUID de empresa válido.");
  let actualizado = contenido;
  for (const [clave, valor] of Object.entries({ BC_ENVIRONMENT: entorno, BC_COMPANY_ID: encontrada.id })) {
    const linea = `${clave}=${JSON.stringify(valor)}`;
    const patron = new RegExp(`^${clave}=.*$`, "gm");
    actualizado = patron.test(actualizado) ? actualizado.replace(patron, () => linea) : `${actualizado.trimEnd()}\n${linea}\n`;
  }
  fs.writeFileSync(archivo, actualizado, "utf8");
  console.log(JSON.stringify({ entorno, empresa: encontrada.name, companyId: encontrada.id, configuracionLocal: "actualizada" }));
}
main().catch(error => {
  // Nunca imprimir el error Axios completo: incluye credenciales/cabeceras.
  console.error(error.isAxiosError ? `Consulta BC fallida: HTTP ${error.response?.status || "sin respuesta"}; código ${error.code || "desconocido"}.` : error.message);
  process.exitCode = 1;
});
