const axios = require("axios");
const authBC = require("./businessCentral");
const { configuracionBC, logSolicitudBC } = require("./bcConfig");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fallo = (mensaje, status = 503) => Object.assign(new Error(mensaje), { status, seguro: true });


function clasificarError(error) {
  if (error.seguro) return { mensaje: error.message, status: error.status, transitorio: false, incierto: false, codigo: "CONFIGURACION" };
  const status = error.response?.status;
  const texto = String(error.response?.data?.error?.message || "");
  const codigo = ["GM_KEY_CONFLICT", "GM_ENTRY_GONE", "GM_POST_NOT_CONFIRMED", "GM_POST_AMBIGUOUS"].find(valor => texto.includes(valor) || error.response?.data?.error?.code === valor);
  if (codigo) return { codigo, status: 409, transitorio: false, incierto: false,
    mensaje: ["GM_POST_NOT_CONFIRMED", "GM_POST_AMBIGUOUS"].includes(codigo) ? (codigo === "GM_POST_AMBIGUOUS" ? "BC detectó movimientos existentes sin recibo confirmado. Requiere revisión en BC; no se reintentará automáticamente." : "BC no pudo verificar el movimiento de inventario esperado. El registro no está confirmado; revisa la operación en BC.") : codigo === "GM_KEY_CONFLICT" ? "La clave de integración ya está asociada a otros datos. Requiere revisión; no se creará otra entrada." : "La línea original ya no está en el diario (puede haberse registrado o eliminado). No se creará una sustituta." };
  const transitorio = !status || [408, 429, 500, 502, 503, 504].includes(status);
  let mensaje = "No se pudo confirmar el resultado en Business Central. Reintenta la misma operación.";
  if (status === 401) mensaje = "Business Central ha rechazado la autenticación de la aplicación. Revisa las credenciales del backend que estás utilizando.";
  else if (status === 403) {
    const permiso = /\/solicitudesAcopio(?:[(/?]|$)/i.test(error.config?.url || "") ? "GM ACOPIO API" : "GM ENTRADAS API";
    mensaje = `Business Central ha denegado un permiso a la aplicación de integración. Revisa ${permiso} en la empresa configurada.`;
  }
  else if (status === 404) mensaje = "No se encontró el recurso en Business Central. Revisa la publicación de la API y la empresa configurada.";
  if (!transitorio && texto && status !== 401) {
    const detalle = texto.split(/CorrelationId|Correlation ID/i)[0]
      .replace(/Bearer\s+\S+/gi, "[oculto]").replace(/https?:\/\/\S+/gi, "[servicio BC]")
      .replace(/(client_secret|access_token|refresh_token)\s*[:=]\s*\S+/gi, "$1=[oculto]")
      .replace(/[\x00-\x1f]/g, " ").slice(0, 600);
    mensaje = status === 403 ? `${mensaje} Detalle: ${detalle}` : detalle;
    for (const secreto of [process.env.BC_CLIENT_SECRET, process.env.CLIENT_SECRET].filter(Boolean)) mensaje = mensaje.split(secreto).join("[oculto]");
  }
  const cabecera = error.response?.headers?.["retry-after"];
  const retryMs = cabecera == null ? 0 : /^\d+(\.\d+)?$/.test(String(cabecera)) ? Number(cabecera) * 1000 : Math.max(0, Date.parse(cabecera) - Date.now()) || 0;
  return { mensaje, status: status === 401 || status === 403 ? 502 : status || 502, codigo: "BC_ERROR", transitorio, incierto: !status || status >= 500 || status === 408, retryMs };
}

function crearCliente({ request = config => axios.request(config), token = () => authBC.obtenerToken(), config = () => configuracionBC(), esperar = ms => new Promise(resolve => setTimeout(resolve, ms)), referencias = numeros => authBC.obtenerReferenciasTlm({ numeros }), materiales = () => authBC.obtenerMaterialesConReferencia() } = {}) {
  async function ejecutar(method, url, data, limite = Infinity) {
    let huboIncertidumbre = false;
    for (let intento = 0; intento < 3; intento++) {
      if (Date.now() >= limite) throw fallo("Business Central está tardando demasiado en devolver el catálogo. Vuelve a actualizar los datos.", 504);
      try {
        logSolicitudBC(url);
        return (await request({ method, url, ...(data === undefined ? {} : { data }), headers: { Authorization: `Bearer ${await token()}` }, timeout: Math.min(15000, Math.max(1, limite - Date.now())), maxRedirects: 0, proxy: false })).data;
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
    const limite = Date.now() + 45000;
    let siguiente = endpoint(tipo, entidad, params);
    const raiz = config()[tipo];
    const resultado = [], visitadas = new Set();
    while (siguiente) {
      const url = new URL(siguiente, `${raiz}/`);
      if (url.origin !== new URL(raiz).origin || !url.pathname.startsWith(`${new URL(raiz).pathname}/`) || url.username || url.password || visitadas.has(url.href) || visitadas.size >= 1000) throw fallo("La API devolvió un enlace de paginación no válido.", 502);
      visitadas.add(url.href);
      const data = await ejecutar("GET", url.href, undefined, limite);
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
  async function conReferencias(consulta) {
    const productos = await consulta;
    if (!productos.length) return [];
    const fichas = await referencias(productos.map(p => p.numprod || p.number));
    const porNumero = new Map();
    for (const ficha of fichas) {
      if (typeof ficha.No !== "string" || typeof ficha.Referencia_TLM !== "string") throw fallo("BC devolvió una referencia TLM no válida.", 502);
      porNumero.set(ficha.No, ficha.Referencia_TLM.trim());
    }
    return productos.map(producto => ({ ...producto, referenciaTlm: porNumero.get(producto.numprod || producto.number) || "" }));
  }
  const recibos = cuerpo => coleccion("custom", "registrosProducto", {
    $filter: `claveintegracion eq ${cuerpo.claveintegracion}${cuerpo.idlinea ? ` and idlinea eq ${cuerpo.idlinea}` : ""}`
  });
  return {
    destino: () => config().custom,
    obtenerAlmacenesMovimiento: () => coleccion("standard", "locations"),
    obtenerArticulosMovimiento: () => materiales(),
    obtenerRecursosAcopio: () => coleccion("custom", "recursosCandidatosAcopio"),
    obtenerAcopios: () => coleccion("custom", "acopios"),
    crearAcopio: cuerpo => ejecutar("POST", endpoint("custom", "solicitudesAcopio"), { claveintegracion: cuerpo.solicitudId, datos: JSON.stringify(cuerpo) }),
    obtenerCabeceraAcopio: id => {
      if (!UUID.test(id || "")) throw fallo("Identificador de acopio no válido.", 400);
      return ejecutar("GET", endpoint("custom", `acopios(${id})`));
    },
    obtenerLineasAcopio: numero => {
      if (typeof numero !== "string" || !numero || numero.length > 20) throw fallo("Número de acopio no válido.", 400);
      return coleccion("custom", "lineasAcopio", { $filter: `numeroacopio eq '${numero.replace(/'/g, "''")}'` });
    },
    obtenerSolicitudAcopio: clave => {
      if (!UUID.test(clave || "")) throw fallo("Clave de acopio no válida.", 400);
      return coleccion("custom", "solicitudesAcopio", { $filter: `claveintegracion eq ${clave}` });
    },
    registrarAcopio: id => {
      if (!UUID.test(id || "")) throw fallo("Identificador de solicitud AL no válido.", 400);
      return ejecutar("POST", endpoint("custom", `solicitudesAcopio(${id})/Microsoft.NAV.registrar`));
    },
    obtenerDepartamentos: async () => (await coleccion("custom", "valoresDimensionAcopio", { $filter: `dimension eq '${(process.env.BC_DEPARTMENT_DIMENSION || "DEPART").replace(/'/g, "''")}'` })).map(d => ({ ...d, code: d.codigo, displayName: d.nombre })),
    obtenerZonas: async () => (await coleccion("custom", "valoresDimensionAcopio", { $filter: "dimension eq 'ZONA'" })).map(d => ({ ...d, code: d.codigo, displayName: d.nombre })),
    obtenerStock: () => conReferencias(coleccion("custom", "productos")),
    obtenerProductos: () => materiales(),
    obtenerAlmacenes: () => coleccion("standard", "locations", { $filter: "code eq 'CENTRAL 3'" }),
    obtenerTiposProyecto: () => coleccion("custom", "tiposProyecto"),
    obtenerUnidades: numprod => coleccion("custom", "unidadesProducto", filtroProducto(numprod)),
    obtenerMovimientosAplicables: numprod => coleccion("custom", "movimientosAplicables", filtroProducto(numprod)),
    obtenerEntradas: () => conReferencias(coleccion("custom", "diarioProductos")),
    obtenerEntrada: id => {
      if (!UUID.test(id)) throw fallo("Identificador de entrada no válido.", 400);
      return ejecutar("GET", endpoint("custom", `diarioProductos(${id})`));
    },
    crearEntrada: async cuerpo => {
      try { return await ejecutar("POST", endpoint("custom", "diarioProductos"), cuerpo); }
      catch (error) {
        if (error.codigo === "GM_ENTRY_GONE") {
          const comprobantes = await recibos(cuerpo);
          const recibo = comprobantes.find(r => r.registrado === true && r.claveintegracion?.toLowerCase() === cuerpo.claveintegracion.toLowerCase());
          if (recibo) error.message = `La línea ya se registró. Documento ${recibo.numdoc}. No se creará otra línea.`;
        }
        throw error;
      }
    },
    registrarEntrada: async cuerpo => {
      if (!UUID.test(cuerpo?.idlinea || "") || !UUID.test(cuerpo?.claveintegracion || "")) throw fallo("Identificadores de registro no válidos.", 400);
      const coincide = registro => registro?.registrado === true && UUID.test(registro.id || "")
        && typeof registro.fecharegistrocontable === "string" && Number.isFinite(Date.parse(registro.fecharegistrocontable))
        && typeof registro.numdoc === "string" && !!registro.numdoc.trim()
        && typeof registro.idlinea === "string" && registro.idlinea.toLowerCase() === cuerpo.idlinea.toLowerCase()
        && typeof registro.claveintegracion === "string" && registro.claveintegracion.toLowerCase() === cuerpo.claveintegracion.toLowerCase();
      let postCompletado = false;
      try {
        const respuesta = await ejecutar("POST", endpoint("custom", "registrosProducto"), cuerpo);
        postCompletado = true;
        const reciboPost = respuesta;
        if (coincide(reciboPost)) return reciboPost;
        // El POST de la página AL puede devolver el buffer de inserción, no el
        // comprobante actualizado. Confirmar leyendo el registro persistido.
        // La extensión 1.1.1 expone UUID persistidos y filtrables.
        // Comprobar además identidades y confirmación en la respuesta.
        const registros = await recibos(cuerpo);
        const comprobantes = registros.filter(coincide);
        if (comprobantes.length === 1) return comprobantes[0];
        throw Object.assign(fallo("La API de BC ha respondido, pero no confirma registrado=true ni devuelve un recibo para esta línea. Revisa la extensión de registro publicada en BC (versión 1.1.1.20261008). No crees otra entrada para sustituirla."), { incierto: true, codigo: "BC_RECEIPT_MISSING" });
      }
      catch (error) {
        // Un fallo al consultar el recibo no demuestra que el POST haya fallado.
        if (postCompletado) error.incierto = true;
        if (error.codigo === "GM_ENTRY_GONE") {
          const encontrados = await recibos(cuerpo);
          const recibo = encontrados.find(coincide);
          if (recibo) return recibo;
        }
        throw error;
      }
    }
  };
}
module.exports = { ...crearCliente(), crearCliente, configuracionBC, clasificarError, UUID };
