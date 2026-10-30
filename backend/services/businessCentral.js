const axios = require("axios");
const { identidadBC, urlProyectos, logSolicitudBC } = require("./bcConfig");
const { crearCacheLecturas } = require("../utils/cacheLecturas");
const cacheTokens = crearCacheLecturas({ ttl: 60000 });
const cacheProyectos = crearCacheLecturas({ ttl: 60000 });
const cacheReferencias = crearCacheLecturas({ ttl: 5 * 60000 });
const cacheBusquedaArticulos = crearCacheLecturas({ ttl: 30000, maxEntradas: 200 });
const lecturasArticulo = crearCacheLecturas({ ttl: 0, maxEntradas: 200 });

async function obtenerToken() {
  const config = identidadBC();
  return cacheTokens(JSON.stringify(config), async () => {
    const response = await axios.post(
      `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: config.scope,
        grant_type: "client_credentials"
      }),
      {
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        proxy: false,
        timeout: 15000,
        maxRedirects: 0
      }
    );

    return response.data.access_token;
  });
}

async function obtenerColeccionOData({ request = (url, options) => axios.get(url, options), token = obtenerToken, env = process.env, servicio, params = {}, tamanoPagina, timeout = 15000, tiempoTotal = 45000, maxRegistros = Infinity } = {}) {
  const limite = Date.now() + tiempoTotal;
  const raiz = new URL(urlProyectos(env));
  if (servicio) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(servicio)) throw new Error("Servicio OData no válido.");
    raiz.pathname = raiz.pathname.replace(/[^/]+$/, servicio);
  }
  const inicio = new URL(raiz);
  inicio.search = new URLSearchParams(params).toString();
  const credencial = await token();
  const proyectos = [], visitadas = new Set();
  let siguiente = inicio.href;
  const fallo = mensaje => Object.assign(new Error(mensaje), { status: 502, seguro: true });
  while (siguiente) {
    const url = new URL(siguiente, raiz);
    if (url.origin !== raiz.origin || url.pathname !== raiz.pathname || url.username || url.password || visitadas.has(url.href) || visitadas.size >= 1000) throw fallo("BC devolvió una paginación de proyectos no válida.");
    visitadas.add(url.href);
    if (Date.now() >= limite) throw fallo("Business Central está tardando demasiado en devolver el catálogo. Vuelve a actualizar los datos.");
    logSolicitudBC(url.href, env);
    const { data } = await request(url.href, { headers: { Authorization: `Bearer ${credencial}`, ...(tamanoPagina ? { Prefer: `odata.maxpagesize=${tamanoPagina}` } : {}) }, proxy: false, timeout: Math.min(timeout, Math.max(1, limite - Date.now())), maxRedirects: 0 });
    if (!Array.isArray(data?.value)) throw fallo("BC devolvió un catálogo de proyectos no válido.");
    proyectos.push(...data.value.slice(0, maxRegistros - proyectos.length));
    if (proyectos.length >= maxRegistros) break;
    siguiente = data["@odata.nextLink"] ? new URL(data["@odata.nextLink"], url).href : null;
  }
  return proyectos;
}

// Los selectores nunca recorren el catálogo entero ni calculan Inventory para cada coincidencia.
async function buscarArticulos({ busqueda, numero, ...opciones } = {}) {
  const exacto = numero !== undefined;
  const texto = exacto ? numero : busqueda;
  const invalido = mensaje => Object.assign(new Error(mensaje), { status: 400, seguro: true });
  if (typeof texto !== "string" || texto.length > (exacto ? 20 : 100) || /[\x00-\x1f]/.test(texto)) throw invalido("Búsqueda de artículos no válida.");
  const termino = texto.trim();
  if (exacto && !termino) throw invalido("Selecciona un artículo válido.");
  if (!exacto && termino.length < 3) return { articulos: [], hayMas: false };
  const campos = "No,Referencia_TLM,Description,Base_Unit_of_Measure,Blocked,Type";
  const base = "Referencia_TLM ne '' and Blocked eq false and Type eq 'Inventory'";
  const normalizar = valor => valor.trim().toLocaleLowerCase("es");
  const valor = normalizar(termino).replace(/'/g, "''");
  const limiteBusqueda = Date.now() + 15000;
  const consultar = ($filter, limite) => obtenerColeccionOData({ ...opciones,
      servicio: "Ficha_producto_Excel", tamanoPagina: limite, maxRegistros: limite,
      tiempoTotal: Math.max(1, limiteBusqueda - Date.now()), params: { $select: campos + (exacto ? ",Inventory" : ""), $filter,
        $top: limite, $orderby: "No", $schemaversion: "2.1" }
  });
  const normalizarFilas = filas => {
    const unicos = new Map();
    for (const item of filas) {
      if ([item.No, item.Referencia_TLM, item.Description, item.Base_Unit_of_Measure].some(v => typeof v !== "string")
        || !item.No.trim() || (exacto && (typeof item.Inventory !== "number" || !Number.isFinite(item.Inventory)))) {
        throw Object.assign(new Error("BC devolvió un artículo no válido."), { status: 502, seguro: true });
      }
      if (!item.Referencia_TLM.trim() || item.Blocked !== false || item.Type !== "Inventory" || (exacto && item.No !== termino)) continue;
      unicos.set(item.No, { number: item.No, numprod: item.No, referenciaTlm: item.Referencia_TLM.trim(),
        displayName: item.Description, descripcion: item.Description, baseUnitOfMeasureCode: item.Base_Unit_of_Measure,
        codudmedida: item.Base_Unit_of_Measure, ...(exacto ? { inventory: item.Inventory } : {}), blocked: false });
    }
    if (exacto && unicos.size > 1) throw Object.assign(new Error("BC devolvió más de un artículo para el mismo código."), { status: 502, seguro: true });
    return [...unicos.values()];
  };
  const cargar = async () => {
    // Consultas acotadas en paralelo: una referencia exacta no oculta las coincidencias del prefijo.
    // BC no permite OR entre campos distintos. El número interno se busca además de la referencia TLM.
    const listas = exacto ? [await consultar(`${base} and No eq '${termino.replace(/'/g, "''")}'`, 2)]
      : await Promise.all([
        consultar(`${base} and tolower(Referencia_TLM) eq '${valor}'`, 21),
        consultar(`${base} and startswith(tolower(Referencia_TLM),'${valor}')`, 21),
        consultar(`${base} and contains(tolower(Description),'${valor}')`, 21),
        termino.length <= 20 ? consultar(`${base} and startswith(tolower(No),'${valor}')`, 21) : Promise.resolve([])
      ]);
    const articulos = normalizarFilas(listas.flat());
    if (!exacto) {
      const prioridad = item => normalizar(item.number) === normalizar(termino) || normalizar(item.referenciaTlm) === normalizar(termino) ? 0
        : normalizar(item.referenciaTlm).startsWith(normalizar(termino)) ? 1 : normalizar(item.displayName).startsWith(normalizar(termino)) ? 2 : 3;
      articulos.sort((a, b) => prioridad(a) - prioridad(b));
    }
    return { articulos: articulos.slice(0, exacto ? 1 : 20), hayMas: !exacto && (articulos.length > 20 || listas.some(lista => lista.length === 21)) };
  };
  // El inventario individual sigue siendo actual; solo se agrupan consultas simultáneas.
  if (opciones.request || opciones.token) return cargar();
  const clave = JSON.stringify([urlProyectos(opciones.env), identidadBC(opciones.env), exacto, exacto ? termino : termino.toLocaleLowerCase("es")]);
  if (exacto) return lecturasArticulo(clave, cargar);
  return cacheBusquedaArticulos(clave, cargar);
}

async function obtenerProyectos({ soloAbiertos = false, ...opciones } = {}) {
  const cargar = () => obtenerColeccionOData({ ...opciones, tamanoPagina: 5000, ...(soloAbiertos ? { params: { $filter: "status eq 'Open' and blocked eq ' ' and complete eq false" } } : {}) });
  const datos = opciones.request || opciones.token ? await cargar()
    : await cacheProyectos(JSON.stringify([urlProyectos(opciones.env), identidadBC(opciones.env), soloAbiertos]), cargar);
  const proyectos = [];
  for (const item of datos) {
      if (soloAbiertos && !(item.status === "Open" && typeof item.blocked === "string" && !item.blocked.trim() && item.complete === false)) continue;
      const codigo = item.nomProyecto ?? item.no ?? item.No;
      const descripcion = item.descProyecto ?? item.description ?? item.Description ?? "";
      if (typeof codigo !== "string" || !codigo.trim() || typeof descripcion !== "string") throw Object.assign(new Error("BC devolvió un proyecto sin código o descripción válidos."), { status: 502, seguro: true });
      proyectos.push({ ...item, nomProyecto: codigo, descProyecto: descripcion });
  }
  return { value: proyectos };
}

async function obtenerSolicitantesActivos(opciones = {}) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [recursos, empleados] = await Promise.all([
    obtenerColeccionOData({ ...opciones, servicio: "Recursos", params: { $select: "No,Name,Type,Blocked,Privacy_Blocked", $filter: "Type eq 'Person' and Blocked eq false and Privacy_Blocked eq false" } }),
    obtenerColeccionOData({ ...opciones, servicio: "Ficha_empleado_Excel", params: { $select: "Resource_No,Status,Termination_Date,Privacy_Blocked,ALXFechaFinContrato", $filter: "Status eq 'Active' and Privacy_Blocked eq false" } })
  ]);
  const vigente = fecha => fecha === "0001-01-01" || (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoy);
  const activos = new Set(empleados.filter(e => e.Status === "Active" && e.Privacy_Blocked === false && vigente(e.Termination_Date) && vigente(e.ALXFechaFinContrato)).map(e => e.Resource_No));
  return recursos.filter(r => r.Type === "Person" && r.Blocked === false && r.Privacy_Blocked === false && activos.has(r.No)).map(r => ({ codigo: r.No, nombre: r.Name }));
}

async function obtenerReferenciasTlm({ numeros, ...opciones } = {}) {
  const codigos = numeros ? [...new Set(numeros)].sort() : [];
  const filtro = codigos.length && codigos.length <= 50
    ? `Referencia_TLM ne '' and (${codigos.map(no => `No eq '${no.replace(/'/g, "''")}'`).join(" or ")})`
    : "Referencia_TLM ne ''";
  const cargar = () => obtenerColeccionOData({ ...opciones, servicio: "Ficha_producto_Excel", tamanoPagina: 5000, timeout: 30000, params: { $select: "No,Referencia_TLM", $filter: filtro } }).catch(error => {
    if (error.code === "ECONNABORTED") throw Object.assign(new Error("Business Central está tardando demasiado en devolver las referencias de materiales. Pulsa Actualizar datos para reintentar."), { status: 504, seguro: true });
    throw error;
  });
  if (opciones.request || opciones.token) return cargar();
  return cacheReferencias(JSON.stringify([urlProyectos(opciones.env), identidadBC(opciones.env), filtro]), cargar);
}

// Catálogo completo para filtrado local. Inventory se consulta solo para el artículo seleccionado.
async function obtenerMaterialesConReferencia({ incluirInventario = false, ...opciones } = {}) {
  const params = {
    $select: `No,Referencia_TLM,Description,Base_Unit_of_Measure${incluirInventario ? ",Inventory" : ""},Blocked,Type`,
    $filter: "Referencia_TLM ne '' and Blocked eq false and Type eq 'Inventory'"
  };
  const cargar = async () => {
    try {
      const filas = await obtenerColeccionOData({ ...opciones, servicio: "Ficha_producto_Excel", tamanoPagina: 5000, timeout: 30000, params });
      const productos = [];
      for (const item of filas) {
        if (typeof item.No !== "string" || typeof item.Referencia_TLM !== "string" || typeof item.Description !== "string"
          || typeof item.Base_Unit_of_Measure !== "string" || (incluirInventario && (typeof item.Inventory !== "number" || !Number.isFinite(item.Inventory)))) {
          throw Object.assign(new Error("Business Central devolvió un material con referencia no válido."), { status: 502, seguro: true });
        }
        if (!item.Referencia_TLM.trim() || item.Blocked !== false || item.Type !== "Inventory") continue;
        productos.push({ number: item.No, numprod: item.No, referenciaTlm: item.Referencia_TLM.trim(),
          displayName: item.Description, descripcion: item.Description, baseUnitOfMeasureCode: item.Base_Unit_of_Measure,
          codudmedida: item.Base_Unit_of_Measure, ...(incluirInventario ? { inventory: item.Inventory } : {}), blocked: false });
      }
      return productos;
    } catch (error) {
      if (error.code === "ECONNABORTED") throw Object.assign(new Error("Business Central está tardando demasiado en devolver los materiales con referencia. Pulsa Actualizar datos para reintentar."), { status: 504, seguro: true });
      throw error;
    }
  };
  if (opciones.request || opciones.token) return cargar();
  return cacheReferencias(JSON.stringify([urlProyectos(opciones.env), identidadBC(opciones.env), params]), cargar);
}

module.exports = {
  buscarArticulos,
  obtenerToken,
  obtenerProyectos,
  obtenerSolicitantesActivos,
  obtenerReferenciasTlm,
  obtenerMaterialesConReferencia
};
