const axios = require("axios");
const authBC = require("./businessCentral");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fallo = (mensaje, status = 503) => Object.assign(new Error(mensaje), { status, seguro: true });

function configuracionBC(env = process.env) {
  const faltan = ["TENANT_ID", "CLIENT_ID", "CLIENT_SECRET", "BC_SCOPE", "BC_ENVIRONMENT", "BC_COMPANY_ID"].filter(campo => !env[campo]);
  if (faltan.length) throw fallo(`Falta configurar la integración de almacén: ${faltan.join(", ")}.`);
  if (!UUID.test(env.TENANT_ID) || !UUID.test(env.BC_COMPANY_ID)) throw fallo("TENANT_ID y BC_COMPANY_ID deben ser UUID válidos.");
  const base = `https://api.businesscentral.dynamics.com/v2.0/${env.TENANT_ID}/${encodeURIComponent(env.BC_ENVIRONMENT)}`;
  return { custom: `${base}/api/Estel/GestionMaterial/v1.0/companies(${env.BC_COMPANY_ID})`, standard: `${base}/api/v2.0/companies(${env.BC_COMPANY_ID})` };
}

function clasificarError(error) {
  if (error.seguro) return { mensaje: error.message, status: error.status, transitorio: false, incierto: false, codigo: "CONFIGURACION" };
  const status = error.response?.status;
  const texto = String(error.response?.data?.error?.message || "");
  const codigo = ["GM_KEY_CONFLICT", "GM_ENTRY_GONE"].find(valor => texto.includes(valor) || error.response?.data?.error?.code === valor);
  if (codigo) return { codigo, status: 409, transitorio: false, incierto: false,
    mensaje: codigo === "GM_KEY_CONFLICT" ? "La clave de integración ya está asociada a otros datos. Requiere revisión; no se creará otra entrada." : "La línea original ya no está en el diario (puede haberse registrado o eliminado). No se creará una sustituta." };
  const transitorio = !status || [408, 429, 500, 502, 503, 504].includes(status);
  let mensaje = "No se pudo confirmar el resultado en Business Central. Reintenta la misma operación.";
  if (status === 401) mensaje = "Business Central ha rechazado la autenticación de la aplicación. Revisa las credenciales del backend que estás utilizando.";
  else if (status === 403) mensaje = "Business Central ha denegado un permiso a la aplicación de integración. Revisa GM ENTRADAS API en la empresa configurada.";
  else if (status === 404) mensaje = "No se encontró el recurso en Business Central. Revisa la publicación de la API y la empresa configurada.";
  if (!transitorio && texto && status !== 401) {
    const detalle = texto.split(/CorrelationId|Correlation ID/i)[0]
      .replace(/Bearer\s+\S+/gi, "[oculto]").replace(/https?:\/\/\S+/gi, "[servicio BC]")
      .replace(/(client_secret|access_token|refresh_token)\s*[:=]\s*\S+/gi, "$1=[oculto]")
      .replace(/[\x00-\x1f]/g, " ").slice(0, 600);
    mensaje = status === 403 ? `${mensaje} Detalle: ${detalle}` : detalle;
    if (process.env.CLIENT_SECRET) mensaje = mensaje.split(process.env.CLIENT_SECRET).join("[oculto]");
  }
  const cabecera = error.response?.headers?.["retry-after"];
  const retryMs = cabecera == null ? 0 : /^\d+(\.\d+)?$/.test(String(cabecera)) ? Number(cabecera) * 1000 : Math.max(0, Date.parse(cabecera) - Date.now()) || 0;
  return { mensaje, status: status === 401 || status === 403 ? 502 : status || 502, codigo: "BC_ERROR", transitorio, incierto: !status || status >= 500 || status === 408, retryMs };
}

function crearCliente({ request = config => axios.request(config), token = () => authBC.obtenerToken(), config = () => configuracionBC(), esperar = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  async function ejecutar(method, url, data) {
    let huboIncertidumbre = false;
    for (let intento = 0; intento < 3; intento++) {
      try {
        return (await request({ method, url, ...(data === undefined ? {} : { data }), headers: { Authorization: `Bearer ${await token()}` }, timeout: 15000, maxRedirects: 0, proxy: false })).data;
      } catch (error) {
        const info = clasificarError(error);
        huboIncertidumbre ||= info.incierto;
        const demora = Math.max(500 * (2 ** intento), info.retryMs || 0);
        if (!info.transitorio || intento === 2 || demora > 5000) throw Object.assign(new Error(info.mensaje), { ...info, incierto: huboIncertidumbre, seguro: true });
        await esperar(demora);
      }
    }
  }
  function endpoint(tipo, entidad, params = {}) {
    const url = new URL(`${config()[tipo]}/${entidad}`);
    url.search = new URLSearchParams(params).toString();
    return url.href;
  }
  async function coleccion(tipo, entidad, params) {
    let siguiente = endpoint(tipo, entidad, params);
    const raiz = config()[tipo];
    const resultado = [], visitadas = new Set();
    while (siguiente) {
      const url = new URL(siguiente, `${raiz}/`);
      if (url.origin !== new URL(raiz).origin || !url.pathname.startsWith(`${new URL(raiz).pathname}/`) || url.username || url.password || visitadas.has(url.href) || visitadas.size >= 1000) throw fallo("La API devolvió un enlace de paginación no válido.", 502);
      visitadas.add(url.href);
      const data = await ejecutar("GET", url.href);
      if (!Array.isArray(data?.value)) throw fallo("La respuesta de Business Central no coincide con el contrato de colección.", 502);
      resultado.push(...data.value);
      siguiente = data["@odata.nextLink"] ? new URL(data["@odata.nextLink"], url).href : null;
    }
    return resultado;
  }
  const filtroProducto = numprod => {
    if (typeof numprod !== "string" || !numprod.trim() || numprod.length > 20) throw fallo("Selecciona un único producto válido.", 400);
    return { $filter: `numprod eq '${numprod.replace(/'/g, "''")}'` };
  };
  return {
    destino: () => config().custom,
    obtenerProductos: () => coleccion("standard", "items", { $filter: "blocked eq false and type eq 'Inventory'", $select: "id,number,displayName,baseUnitOfMeasureCode,blocked" }),
    obtenerAlmacenes: () => coleccion("standard", "locations", { $filter: "code eq 'CENTRAL 3'" }),
    obtenerTiposProyecto: () => coleccion("custom", "tiposProyecto"),
    obtenerUnidades: numprod => coleccion("custom", "unidadesProducto", filtroProducto(numprod)),
    obtenerMovimientosAplicables: numprod => coleccion("custom", "movimientosAplicables", filtroProducto(numprod)),
    obtenerEntradas: () => coleccion("custom", "diarioProductos"),
    obtenerEntrada: id => {
      if (!UUID.test(id)) throw fallo("Identificador de entrada no válido.", 400);
      return ejecutar("GET", endpoint("custom", `diarioProductos(${id})`));
    },
    crearEntrada: cuerpo => ejecutar("POST", endpoint("custom", "diarioProductos"), cuerpo),
    registrarEntrada: async cuerpo => {
      try { return await ejecutar("POST", endpoint("custom", "registrosProducto"), cuerpo); }
      catch (error) {
        if (error.status === 404) error.message = "La operación de registro todavía no está publicada en BC. Publica la extensión 1.0.2.20260928 y asigna GM REGISTRAR API a la identidad de integración.";
        throw error;
      }
    }
  };
}
module.exports = { ...crearCliente(), crearCliente, configuracionBC, clasificarError, UUID };
