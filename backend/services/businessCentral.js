const axios = require("axios");
const { identidadBC, urlProyectos, logSolicitudBC } = require("./bcConfig");

async function obtenerToken() {
  const config = identidadBC();

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
}

async function obtenerColeccionOData({ request = (url, options) => axios.get(url, options), token = obtenerToken, env = process.env, servicio, params = {}, tamanoPagina, timeout = 15000 } = {}) {
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
    logSolicitudBC(url.href, env);
    const { data } = await request(url.href, { headers: { Authorization: `Bearer ${credencial}`, ...(tamanoPagina ? { Prefer: `odata.maxpagesize=${tamanoPagina}` } : {}) }, proxy: false, timeout, maxRedirects: 0 });
    if (!Array.isArray(data?.value)) throw fallo("BC devolvió un catálogo de proyectos no válido.");
    proyectos.push(...data.value);
    siguiente = data["@odata.nextLink"] ? new URL(data["@odata.nextLink"], url).href : null;
  }
  return proyectos;
}

async function obtenerProyectos({ soloAbiertos = false, ...opciones } = {}) {
  const datos = await obtenerColeccionOData({ ...opciones, ...(soloAbiertos ? { params: { $filter: "status eq 'Open' and blocked eq ' ' and complete eq false" } } : {}) });
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

module.exports = {
  obtenerToken,
  obtenerProyectos,
  obtenerSolicitantesActivos,
  obtenerReferenciasTlm: opciones => obtenerColeccionOData({ ...opciones, servicio: "Ficha_producto_Excel", tamanoPagina: 1000, timeout: 60000, params: { $select: "No,Referencia_TLM", $filter: "Referencia_TLM ne ''" } })
};
