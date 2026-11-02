const axios = require("axios");
const { baseBC } = require("./bcConfig");
const { obtenerToken, buscarArticulos } = require("./businessCentral");
const fallo = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status, seguro: true });
const literal = valor => `'${valor.replace(/'/g, "''")}'`;
const estados = ["Open", "Released", "Pending Approval", "Pending Prepayment"];

function crearCliente({ request = config => axios.request(config), token = obtenerToken, articulo = numero => buscarArticulos({ numero }), raiz = () => {
  if (!/^[0-9a-f-]{36}$/i.test(process.env.BC_COMPANY_ID || "")) throw fallo("Configura BC_COMPANY_ID.", 503);
  return `${baseBC()}/api/estel/purchase/v1.0/companies(${process.env.BC_COMPANY_ID})`;
} } = {}) {
  async function consultar(entidad, params, maximo) {
    const base = new URL(`${raiz()}/${entidad}`);
    const inicio = new URL(base);
    inicio.search = new URLSearchParams(params).toString();
    const credencial = await token();
    const filas = [], visitadas = new Set();
    let siguiente = inicio.href, total;
    const limite = Date.now() + 45000;
    while (siguiente) {
      const url = new URL(siguiente, base);
      if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || visitadas.has(url.href) || visitadas.size >= 1000 || Date.now() >= limite) throw fallo("BC devolvió una paginación inválida o agotó el tiempo de consulta.", 502);
      visitadas.add(url.href);
      const { data } = await request({ method: "GET", url: url.href, headers: { Authorization: `Bearer ${credencial}`, Prefer: "odata.maxpagesize=100" }, timeout: Math.min(15000, limite - Date.now()), proxy: false, maxRedirects: 0 });
      if (!Array.isArray(data?.value)) throw fallo("Respuesta de pedidos de BC no válida.", 502);
      if (total === undefined) total = data["@odata.count"];
      filas.push(...data.value);
      if (filas.length > maximo) throw fallo("BC devolvió más registros de los solicitados.", 502);
      siguiente = data["@odata.nextLink"] || null;
    }
    return { filas, total };
  }
  return {
    async listar(query = {}) {
      const anio = Number(query.anio), pagina = query.pagina === undefined ? 1 : Number(query.pagina);
      if (!/^\d{4}$/.test(String(query.anio)) || anio < 2000 || anio > 9998 || !Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000) throw fallo("Selecciona un año desde 2000 y una página válidos.");
      const filtros = [`documentType eq 'Order'`, `documentDate ge ${anio}-01-01`, `documentDate lt ${anio + 1}-01-01`];
      for (const [campo, clave] of [["Proyecto", "proyecto"], ["number", "numero"]]) {
        const valor = query[clave] || "";
        if (typeof valor !== "string" || valor.length > 100 || /[\x00-\x1f]/.test(valor)) throw fallo("Filtro no válido.");
        if (valor.trim()) filtros.push(`contains(${campo},${literal(valor.trim())})`);
      }
      if (query.estado) {
        if (!estados.includes(query.estado)) throw fallo("Estado no válido.");
        filtros.push(`Estado eq ${literal(query.estado)}`);
      }
      const campo = query.ordenar || "documentDate", direccion = query.direccion || "desc";
      if (!["number", "buyFromVendorNumber", "NombreCliente", "documentDate", "Estado", "amount", "amountIncludingVAT", "Proyecto"].includes(campo) || !["asc", "desc"].includes(direccion)) throw fallo("Ordenación no válida.");
      const orden = `${campo} ${direccion}${campo === "number" ? "" : ",number asc"}`;
      const { filas, total } = await consultar("purchaseHeadersDetailed", { $filter: filtros.join(" and "), $orderby: orden, $top: 100, $skip: (pagina - 1) * 100, $count: "true" }, 100);
      if (!Number.isSafeInteger(total) || total < 0 || filas.some(f => typeof f.number !== "string" || typeof f.documentDate !== "string" || typeof f.buyFromVendorNumber !== "string" || typeof f.amount !== "number" || typeof f.amountIncludingVAT !== "number")) throw fallo("La API PedidosCompraALL necesita la ampliación de campos de Visualizar.", 502);
      return { pedidos: filas, total, pagina, paginas: Math.ceil(total / 100) };
    },
    async lineas(numero) {
      if (typeof numero !== "string" || !numero.trim() || numero.length > 20 || /[\x00-\x1f]/.test(numero)) throw fallo("Número de pedido no válido.");
      const { filas } = await consultar("purchaseLine", { $filter: `documentType eq 'Order' and PC eq ${literal(numero)}`, $orderby: "lineNumber asc" }, 10000);
      const productos = new Map();
      const numeros = [...new Set(filas.filter(f => f.lineType === "Item" && f.Referencia).map(f => f.Referencia))];
      for (let i = 0; i < numeros.length; i += 5) {
        await Promise.all(numeros.slice(i, i + 5).map(async no => {
          try { productos.set(no, (await articulo(no)).articulos[0]); } catch (_) { productos.set(no, null); }
        }));
      }
      return filas.map(f => {
        const producto = f.lineType === "Item" ? productos.get(f.Referencia) : null;
        return { ...f, referencia: producto?.referenciaTlm || f.Referencia, inventario: producto?.inventory ?? null, unidadInventario: producto?.baseUnitOfMeasureCode || null };
      });
    }
  };
}
module.exports = { crearCliente, ...crearCliente() };
