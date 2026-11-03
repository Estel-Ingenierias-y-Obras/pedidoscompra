const axios = require("axios");
const crypto = require("node:crypto");
const Modelo = require("../models/OperacionPedidoCompra");
const { baseBC, configuracionBC } = require("./bcConfig");
const { obtenerToken } = require("./businessCentral");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fallo = (mensaje, status = 400) => Object.assign(new Error(mensaje), { seguro: true, status });
const texto = (v, max, obligatorio = false) => {
  if (typeof v !== "string" || v.length > max || /[\x00-\x1f]/.test(v) || (obligatorio && !v.trim())) throw fallo("Revisa los campos del pedido.");
  return v.trim();
};
const fecha = v => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v || v < "2000-01-01") throw fallo("Introduce fechas válidas desde el año 2000.");
  return v;
};
function validar(cuerpo) {
  if (!cuerpo || !Array.isArray(cuerpo.lineas) || cuerpo.lineas.length < 1 || cuerpo.lineas.length > 100) throw fallo("Añade entre 1 y 100 líneas.");
  const permitidos = ["proveedor", "proyecto", "tarea", "usuarioAsignado", "fechaRecepcion", "entrega", "lineas"];
  if (Object.keys(cuerpo).some(k => !permitidos.includes(k))) throw fallo("El pedido contiene campos no permitidos.");
  return {
    proveedor: texto(cuerpo.proveedor, 20, true), proyecto: texto(cuerpo.proyecto, 20, true), tarea: texto(cuerpo.tarea, 20, true),
    usuarioAsignado: texto(cuerpo.usuarioAsignado, 50, true), fechaRecepcion: fecha(cuerpo.fechaRecepcion),
    entrega: Object.fromEntries([["nombre", 100, true], ["direccion", 100, true], ["direccion2", 50, false], ["ciudad", 30, true], ["provincia", 30, false], ["codigoPostal", 20, true], ["pais", 10, true], ["contacto", 100, false]].map(([k, max, obligatorio]) => [k, texto(cuerpo.entrega?.[k] ?? "", max, obligatorio)])),
    lineas: cuerpo.lineas.map(l => {
      if (!l || Object.keys(l).some(k => !["articulo", "cantidad", "coste", "almacen", "unidad", "tarea"].includes(k)) || typeof l.cantidad !== "number" || !Number.isFinite(l.cantidad) || l.cantidad <= 0) throw fallo("Revisa los artículos y sus cantidades.");
      const linea = { articulo: texto(l.articulo, 20, true), cantidad: l.cantidad, almacen: texto(l.almacen ?? "", 10), unidad: texto(l.unidad ?? "", 10), tarea: texto(l.tarea ?? "", 20) };
      if (l.coste !== undefined) {
        if (typeof l.coste !== "number" || !Number.isFinite(l.coste) || l.coste < 0) throw fallo("El coste debe ser un número positivo o cero.");
        linea.coste = l.coste;
      }
      return linea;
    })
  };
}
function crearServicio({ modelo = Modelo, request = c => axios.request(c), token = obtenerToken, raiz = () => {
  configuracionBC();
  return `${baseBC()}/api/estel/purchase/v1.0/companies(${process.env.BC_COMPANY_ID})`;
} } = {}) {
  const endpoint = () => `${raiz()}/purchaseRequests`;
  async function ejecutar(method, url, data) {
    return (await request({ method, url, ...(data === undefined ? {} : { data }), headers: { Authorization: `Bearer ${await token()}` }, proxy: false, maxRedirects: 0, timeout: 30000 })).data;
  }
  async function operacion(id, usuario) {
    if (!UUID.test(id || "")) throw fallo("Solicitud no válida.");
    const op = await modelo.findById(id);
    if (!op || op.usuario !== usuario.email.toLowerCase()) throw fallo("Solicitud no encontrada.", 404);
    if (op.destino !== endpoint()) throw fallo("La solicitud pertenece a otra empresa o entorno de BC.", 409);
    return op;
  }
  function confirmar(r, op) {
    if (!r || r.id?.toLowerCase() !== op._id.toLowerCase() || r.fingerprint !== op.huella || !UUID.test(r.headerId || "") || !r.number || !["Open", "Released", "Pending Approval", "Pending Prepayment"].includes(r.status)) throw fallo("No se ha podido confirmar el pedido original en BC. Conserva la solicitud y reintenta.", 409);
    return { solicitudId: op._id, id: r.headerId, numero: r.number, estado: r.status };
  }
  async function consultar(op) {
    try { return confirmar(await ejecutar("GET", `${op.destino}(${op._id})`), op); }
    catch (e) { if (e.response?.status === 404) return null; throw e; }
  }
  return {
    async crear(id, cuerpo, usuario) {
      if (!UUID.test(id || "")) throw fallo("Solicitud no válida.");
      const limpio = validar(cuerpo);
      const huella = crypto.createHash("sha256").update(JSON.stringify(limpio)).digest("hex");
      try { await modelo.create({ _id: id, usuario: usuario.email.toLowerCase(), destino: endpoint(), huella, cuerpo: limpio }); }
      catch (e) { if (e.code !== 11000) throw e; }
      const op = await operacion(id, usuario);
      if (op.huella !== huella) throw fallo("Esta solicitud ya está asociada a otros datos. Reintenta el pedido original.", 409);
      const anterior = await consultar(op);
      if (anterior) return anterior;
      try {
        return confirmar(await ejecutar("POST", endpoint(), { id, fingerprint: huella, payload: JSON.stringify(limpio) }), op);
      } catch (e) {
        let consultaConfirmada = false;
        const recuperado = await consultar(op).then(r => { consultaConfirmada = true; return r; }).catch(() => null);
        if (recuperado) return recuperado;
        if (e.response?.status === 404) throw fallo("Publica la ampliación de creación de PedidosCompraALL antes de crear pedidos.", 501);
        if (consultaConfirmada && [400, 422].includes(e.response?.status)) e.definitivo = true;
        throw e;
      }
    },
    async recuperar(id, usuario) {
      const op = await operacion(id, usuario);
      const resultado = await consultar(op);
      return { resultado, cuerpo: op.cuerpo };
    },
    async lanzar(id, usuario) {
      const op = await operacion(id, usuario);
      const actual = await consultar(op);
      if (!actual) throw fallo("No se encuentra el pedido en BC. Reintenta la misma creación.", 409);
      if (actual.estado === "Released") return actual;
      if (actual.estado !== "Open") throw fallo("Solo se puede lanzar un pedido abierto. Revisa las aprobaciones en BC.", 409);
      try { await ejecutar("POST", `${op.destino}(${id})/Microsoft.NAV.lanzar`, {}); }
      catch (e) {
        const r = await consultar(op).catch(() => null);
        if (r?.estado === "Released") return r;
        throw e;
      }
      const resultado = await consultar(op);
      if (resultado?.estado !== "Released") throw fallo("BC no ha confirmado el estado Lanzado. Actualiza el estado antes de reintentar.", 409);
      return resultado;
    },
    async proveedores(busqueda) {
      const buscar = texto(busqueda ?? "", 100).replace(/'/g, "''").toLocaleLowerCase("es");
      const cargar = async campo => {
        const params = new URLSearchParams({ $top: 30, $select: "number,displayName", $orderby: "number", $schemaversion: "2.1", ...(buscar ? { $filter: `contains(tolower(${campo}),'${buscar}')` } : {}) });
        const datos = await ejecutar("GET", `${configuracionBC().standard}/vendors?${params}`);
        if (!Array.isArray(datos?.value)) throw fallo("No se pudieron cargar proveedores.", 502);
        return datos.value;
      };
      const listas = buscar ? await Promise.all([cargar("number"), cargar("displayName")]) : [await cargar("number")];
      return [...new Map(listas.flat().map(p => [p.number, p])).values()].slice(0, 30);
    },
    async catalogo(entidad, proyecto) {
      if (!["assignedPurchaseUsers", "purchaseJobTasks"].includes(entidad)) throw fallo("Catálogo no válido.");
      const params = new URLSearchParams(entidad === "purchaseJobTasks" ? { $filter: `jobNumber eq '${texto(proyecto, 20, true).replace(/'/g, "''")}' and taskType eq 'Posting'` } : {});
      const base = new URL(`${raiz()}/${entidad}`);
      let siguiente = `${base}?${params}`;
      const filas = [], visitadas = new Set();
      const limite = Date.now() + 45000;
      while (siguiente) {
        const url = new URL(siguiente, base);
        if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || visitadas.has(url.href) || visitadas.size > 100 || Date.now() > limite) throw fallo("Paginación de catálogo no válida.", 502);
        visitadas.add(url.href);
        const datos = await ejecutar("GET", url.href);
        if (!Array.isArray(datos?.value)) throw fallo("Catálogo de compras no válido.", 502);
        filas.push(...datos.value);
        siguiente = datos["@odata.nextLink"] || null;
      }
      return filas;
    }
  };
}
module.exports = { validar, crearServicio, ...crearServicio() };
