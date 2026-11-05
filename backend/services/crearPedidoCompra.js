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
  const permitidos = ["proveedor", "proyecto", "tarea", "usuarioAsignado", "fechaRecepcion", "entrega", "pago", "lineas"];
  if (Object.keys(cuerpo).some(k => !permitidos.includes(k))) throw fallo("El pedido contiene campos no permitidos.");
  const entrega = cuerpo.entrega;
  if (!entrega || !["empresa", "cliente", "almacen", "personalizada"].includes(entrega.tipo) || Object.keys(entrega).some(k => !["tipo", "cliente", "codigoDireccion", "almacen", "personalizada"].includes(k))) throw fallo("Selecciona una dirección de envío válida.");
  const envio = { tipo: entrega.tipo, cliente: texto(entrega.cliente ?? "", 20, entrega.tipo === "cliente"), codigoDireccion: texto(entrega.codigoDireccion ?? "", 10), almacen: texto(entrega.almacen ?? "", 10, entrega.tipo === "almacen") };
  if ((envio.tipo !== "cliente" && (envio.cliente || envio.codigoDireccion)) || (envio.tipo !== "almacen" && envio.almacen)) throw fallo("La dirección de envío no corresponde al destino seleccionado.");
  if (entrega.personalizada !== undefined && envio.tipo !== "personalizada") throw fallo("Los datos personalizados solo se admiten para Dirección personalizada.");
  if (envio.tipo === "personalizada") {
    const campos = [["nombre", 100], ["nombre2", 50], ["direccion", 100], ["direccion2", 50], ["ciudad", 30], ["provincia", 30], ["codigoPostal", 20], ["pais", 10], ["telefono", 30], ["contacto", 100]];
    if (!entrega.personalizada || Object.keys(entrega.personalizada).some(k => !campos.some(([c]) => c === k))) throw fallo("Dirección personalizada no válida.");
    envio.personalizada = Object.fromEntries(campos.map(([k, max]) => [k, texto(entrega.personalizada[k] ?? "", max, ["nombre", "direccion"].includes(k))]));
  }
  return {
    ...(cuerpo.pago === undefined ? {} : { pago: validarPago(cuerpo.pago) }),
    proveedor: texto(cuerpo.proveedor, 20, true), proyecto: texto(cuerpo.proyecto, 20, true), tarea: texto(cuerpo.tarea, 20, true),
    usuarioAsignado: texto(cuerpo.usuarioAsignado, 50, true), fechaRecepcion: fecha(cuerpo.fechaRecepcion),
    entrega: envio,
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
function validarPago(pago) {
  if (!pago || !["proveedor", "otro", "personalizada"].includes(pago.tipo) || Object.keys(pago).some(k => !["tipo", "proveedor", "codigoContacto", "contacto", "personalizada"].includes(k))) throw fallo("Dirección de pago no válida.");
  const r = { tipo: pago.tipo, proveedor: texto(pago.proveedor ?? "", 20, pago.tipo === "otro"), codigoContacto: texto(pago.codigoContacto ?? "", 20), contacto: texto(pago.contacto ?? "", 100) };
  if (pago.tipo !== "otro" && r.proveedor) throw fallo("Selecciona Otro proveedor para cambiar el proveedor de pago.");
  if (pago.tipo === "proveedor" && (r.contacto || r.codigoContacto || pago.personalizada)) throw fallo("El pago predeterminado utiliza los datos del proveedor.");
  if (pago.personalizada !== undefined) {
    const campos = [["direccion", 100], ["direccion2", 50], ["ciudad", 30], ["provincia", 30], ["codigoPostal", 20], ["pais", 10]];
    if (pago.tipo !== "personalizada" || !pago.personalizada || Object.keys(pago.personalizada).some(k => !campos.some(([c]) => c === k))) throw fallo("Datos de pago personalizados no válidos.");
    r.personalizada = Object.fromEntries(campos.map(([k, max]) => [k, texto(pago.personalizada[k] ?? "", max)]));
  }
  return r;
}
function crearServicio({ modelo = Modelo, request = c => axios.request(c), token = obtenerToken, lineas = numero => require("./pedidosCompraBC").lineas(numero), raiz = () => {
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
    if (!op || (op.usuario !== usuario.email.toLowerCase() && !["Admin", "Comprador"].includes(usuario.rol))) throw fallo("Solicitud no encontrada.", 404);
    if (op.destino !== endpoint()) throw fallo("La solicitud pertenece a otra empresa o entorno de BC.", 409);
    return op;
  }
  function confirmar(r, op) {
    if (!r || r.id?.toLowerCase() !== op._id.toLowerCase() || r.fingerprint !== op.huella || !UUID.test(r.headerId || "") || !r.number || !["Open", "Released", "Pending Approval", "Pending Prepayment", "Deleted", "Missing"].includes(r.status)) throw fallo("No se ha podido confirmar el pedido original en BC. Conserva la solicitud y reintenta.", 409);
    return { solicitudId: op._id, id: r.headerId, numero: r.number, estado: r.status, fechaEnvio: r.createdAt || op.createdAt || null };
  }
  async function consultar(op) {
    try { return confirmar(await ejecutar("GET", `${op.destino}(${op._id})`), op); }
    catch (e) { if (e.response?.status === 404) return null; throw e; }
  }
  return {
    async enviados(query = {}, usuario) {
      if (!["Admin", "Comprador"].includes(usuario?.rol)) throw fallo("No tienes acceso al historial de compras.", 403);
      const pagina = Number(query.pagina || 1);
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000) throw fallo("Página no válida.");
      const buscar = texto(query.buscar ?? "", 100).toLocaleLowerCase("es").replace(/'/g, "''");
      const lanzados = query.estado === "Released";
      const filtros = [`headerStatus ${lanzados ? "eq" : "ne"} 'Released'`];
      if (query.incluirEliminados !== "1") filtros.push("deleted eq false");
      if (buscar) filtros.push(`contains(tolower(number),'${buscar}')`);
      const base = new URL(endpoint());
      let siguiente = `${base}?${new URLSearchParams({ $top: 100, $skip: (pagina - 1) * 100, $count: "true", $orderby: lanzados ? "releasedAt desc,createdAt desc,id desc" : "createdAt desc,id desc", $schemaversion: "2.1", ...(filtros.length ? { $filter: filtros.join(" and ") } : {}) })}`;
      const filas = [], visitadas = new Set();
      let total;
      const limite = Date.now() + 45000;
      while (siguiente) {
        const url = new URL(siguiente, base);
        if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || visitadas.has(url.href) || visitadas.size > 100 || Date.now() > limite) throw fallo("Paginación del historial no válida.", 502);
        visitadas.add(url.href);
        const r = await ejecutar("GET", url.href);
        if (!Array.isArray(r?.value)) throw fallo("Historial de BC no válido.", 502);
        if (total === undefined) total = r["@odata.count"];
        filas.push(...r.value);
        if (filas.length > 100) throw fallo("BC devolvió más de 100 pedidos por página.", 502);
        siguiente = r["@odata.nextLink"] || null;
      }
      if (!Number.isSafeInteger(total) || total < 0 || filas.some(r => !UUID.test(r.id || "") || !r.number)) throw fallo("Actualiza la extensión de compras para consultar Enviados a BC.", 502);
      const ops = await modelo.find({ _id: { $in: filas.map(r => r.id) }, destino: endpoint() }).lean();
      const porId = new Map(ops.map(op => [op._id.toLowerCase(), op]));
      return { pedidos: filas.map(r => {
        const op = porId.get(r.id.toLowerCase());
        return { solicitudId: r.id, numero: r.number, estado: r.status, fechaEnvio: r.createdAt, fechaLanzamiento: r.releasedAt, proveedor: r.vendorNumber || op?.cuerpo?.proveedor || "", nombreProveedor: r.vendorName || "", proyecto: r.projectNumber || op?.cuerpo?.proyecto || "", enviadoPor: op?.usuario || "", gestionable: Boolean(op) };
      }), pagina, paginas: Math.ceil(total / 100), total };
    },
    async detalles(id, usuario) {
      const op = await operacion(id, usuario);
      const resultado = await consultar(op);
      if (!resultado) throw fallo("No se encontró el envío confirmado en BC.", 404);
      if (["Deleted", "Missing"].includes(resultado.estado)) return { resultado, cuerpo: op.cuerpo, cabecera: null, lineas: [], enviadoPor: op.usuario };
      const [cabecera, articulos] = await Promise.all([ejecutar("GET", `${raiz()}/purchaseHeadersDetailed(${resultado.id})`), lineas(resultado.numero)]);
      if (cabecera.id?.toLowerCase() !== resultado.id.toLowerCase() || cabecera.number !== resultado.numero || !Array.isArray(articulos)) throw fallo("BC no confirmó los detalles del pedido original.", 502);
      return { resultado, cuerpo: op.cuerpo, cabecera, lineas: articulos, enviadoPor: op.usuario };
    },
    async eliminar(id, usuario, numero) {
      const op = await operacion(id, usuario);
      const actual = await consultar(op);
      if (!actual || actual.numero !== numero) throw fallo("Confirma el número del pedido que quieres eliminar.", 409);
      if (actual.estado === "Deleted") return actual;
      if (!["Open", "Released"].includes(actual.estado)) throw fallo("Solo se pueden eliminar pedidos abiertos o lanzados sin recepciones ni facturas.", 409);
      try { await ejecutar("POST", `${op.destino}(${id})/Microsoft.NAV.eliminar`, {}); }
      catch (e) {
        const r = await consultar(op).catch(() => null);
        if (r?.estado === "Deleted") return r;
        throw e;
      }
      const r = await consultar(op);
      if (r?.estado !== "Deleted") throw fallo("No se ha confirmado la eliminación. Actualiza el estado antes de reintentar.", 409);
      return r;
    },
    async contactosPago(proveedor) {
      const numero = texto(proveedor, 20, true).replace(/'/g, "''");
      const relaciones = await ejecutar("GET", `${raiz()}/purchaseVendorContactLinks?${new URLSearchParams({ $filter: `vendorNumber eq '${numero}'` })}`);
      if (!Array.isArray(relaciones?.value) || relaciones["@odata.nextLink"]) throw fallo("No se pudieron cargar los contactos.", 502);
      const empresas = [...new Set(relaciones.value.map(r => r.contactNumber))];
      if (!empresas.length) return [];
      if (empresas.length > 20) throw fallo("El proveedor tiene demasiadas relaciones de contacto para completar la consulta.", 502);
      const filtros = empresas.flatMap(empresa => [`companyNumber eq '${empresa.replace(/'/g, "''")}'`, `number eq '${empresa.replace(/'/g, "''")}'`]);
      const listas = await Promise.all(filtros.map(async filter => {
        const r = await ejecutar("GET", `${raiz()}/purchasePayContacts?${new URLSearchParams({ $filter: filter, $top: 1000 })}`);
        if (!Array.isArray(r?.value) || r["@odata.nextLink"]) throw fallo("No se pudo completar el catálogo de contactos.", 502);
        return r.value;
      }));
      return [...new Map(listas.flat().map(c => [c.number, c])).values()];
    },
    async proveedorPago(numero) {
      const r = await ejecutar("GET", `${raiz()}/purchasePayVendors?${new URLSearchParams({ $filter: `number eq '${texto(numero, 20, true).replace(/'/g, "''")}'`, $top: 1 })}`);
      if (!Array.isArray(r?.value) || r.value.length !== 1) throw fallo("Proveedor de pago no encontrado.", 404);
      return r.value[0];
    },
    async crear(id, cuerpo, usuario) {
      if (!UUID.test(id || "")) throw fallo("Solicitud no válida.");
      const limpio = validar(cuerpo);
      const huella = crypto.createHash("sha256").update(JSON.stringify(limpio)).digest("hex");
      try { await modelo.create({ _id: id, usuario: usuario.email.toLowerCase(), destino: endpoint(), huella, cuerpo: limpio }); }
      catch (e) { if (e.code !== 11000) throw e; }
      const op = await operacion(id, usuario);
      if (op.huella !== huella) throw fallo("Esta solicitud ya está asociada a otros datos. Reintenta el pedido original.", 409);
      const anterior = await consultar(op);
      if (anterior) {
        if (["Deleted", "Missing"].includes(anterior.estado)) throw fallo("El pedido original ya no está disponible en BC. No se creará otro con esta solicitud.", 409);
        return anterior;
      }
      if (limpio.entrega.tipo === "empresa") {
        try {
          const capacidad = await ejecutar("GET", `${raiz()}/purchaseProjectAddresses?$top=0`);
          if (!Array.isArray(capacidad?.value)) throw fallo("No se pudo verificar la API de dirección del proyecto.", 502);
        } catch (e) {
          if (e.response?.status === 404) throw fallo("Actualiza PedidosCompraALL antes de enviar: el destino Predeterminado debe usar la dirección del proyecto.", 501);
          throw e;
        }
      }
      if (limpio.pago !== undefined) {
        try {
          const capacidad = await ejecutar("GET", `${raiz()}/purchasePayVendors?$top=0`);
          if (!Array.isArray(capacidad?.value)) throw fallo("No se pudo verificar la versión de la API de pagos.", 502);
        } catch (e) {
          if (e.response?.status === 404) throw fallo("Actualiza PedidosCompraALL antes de enviar: la versión instalada no admite Dirección pago.", 501);
          throw e;
        }
      }
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
    async abrir(id, usuario) {
      const op = await operacion(id, usuario);
      const actual = await consultar(op);
      if (actual?.estado === "Open") return actual;
      if (actual?.estado !== "Released") throw fallo("Solo se puede abrir un pedido lanzado.", 409);
      try { await ejecutar("POST", `${op.destino}(${id})/Microsoft.NAV.abrir`, {}); }
      catch (e) {
        const recuperado = await consultar(op).catch(() => null);
        if (recuperado?.estado === "Open") return recuperado;
        throw e;
      }
      const resultado = await consultar(op);
      if (resultado?.estado !== "Open") throw fallo("BC no ha confirmado el estado Abierto. Actualiza los datos antes de reintentar.", 409);
      return resultado;
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
    async proveedores(busqueda, clientes = false) {
      const buscar = texto(busqueda ?? "", 100).replace(/'/g, "''").toLocaleLowerCase("es");
      const cargar = async campo => {
        const params = new URLSearchParams({ $top: 30, $select: "number,displayName", $orderby: "number", $schemaversion: "2.1", ...(buscar ? { $filter: `contains(tolower(${campo}),'${buscar}')` } : {}) });
        const datos = await ejecutar("GET", `${configuracionBC().standard}/${clientes ? "customers" : "vendors"}?${params}`);
        if (!Array.isArray(datos?.value)) throw fallo("No se pudieron cargar proveedores.", 502);
        return datos.value;
      };
      const listas = buscar ? await Promise.all([cargar("number"), cargar("displayName")]) : [await cargar("number")];
      return [...new Map(listas.flat().map(p => [p.number, p])).values()].slice(0, 30);
    },
    async catalogo(entidad, proyecto) {
      if (!["assignedPurchaseUsers", "purchaseJobTasks", "purchaseShipToAddresses", "purchaseCompanyAddresses", "purchaseCountries"].includes(entidad)) throw fallo("Catálogo no válido.");
      const params = new URLSearchParams(entidad === "purchaseJobTasks" ? { $filter: `jobNumber eq '${texto(proyecto, 20, true).replace(/'/g, "''")}' and taskType eq 'Posting'` } : entidad === "purchaseShipToAddresses" ? { $filter: `customerNumber eq '${texto(proyecto, 20, true).replace(/'/g, "''")}'` } : {});
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
    },
    async direccionEntrega(query) {
      const tipo = query.tipo;
      const normalizar = p => ({ nombre: p.displayName || p.name || "", nombre2: p.name2 || "", direccion: p.addressLine1 || p.address || "", direccion2: p.addressLine2 || p.address2 || "", ciudad: p.city || "", provincia: p.state || p.county || "", codigoPostal: p.postalCode || p.postCode || "", pais: p.country || p.countryCode || "", telefono: p.phoneNumber || "", contacto: p.contact || "" });
      let datos;
      if (tipo === "empresa") {
        const proyecto = texto(query.proyecto, 20, true).replace(/'/g, "''");
        datos = await ejecutar("GET", `${raiz()}/purchaseProjectAddresses?${new URLSearchParams({ $filter: `number eq '${proyecto}'`, $top: 1 })}`);
      } else if (tipo === "almacen" || tipo === "cliente") {
        const codigo = texto(tipo === "almacen" ? query.almacen : query.cliente, tipo === "almacen" ? 10 : 20, true).replace(/'/g, "''");
        const alternativa = tipo === "cliente" ? texto(query.codigoDireccion ?? "", 10) : "";
        const params = new URLSearchParams({ $top: 1, $filter: alternativa ? `customerNumber eq '${codigo}' and code eq '${alternativa.replace(/'/g, "''")}'` : `${tipo === "almacen" ? "code" : "number"} eq '${codigo}'` });
        datos = await ejecutar("GET", alternativa ? `${raiz()}/purchaseShipToAddresses?${params}` : `${configuracionBC().standard}/${tipo === "almacen" ? "locations" : "customers"}?${params}`);
      } else throw fallo("Destino de entrega no válido.");
      if (!Array.isArray(datos?.value) || datos.value.length !== 1) throw fallo("No se encontró la dirección seleccionada en BC.", 404);
      return normalizar(datos.value[0]);
    }
  };
}
module.exports = { validar, crearServicio, ...crearServicio() };
