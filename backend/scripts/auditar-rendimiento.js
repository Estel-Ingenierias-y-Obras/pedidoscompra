// Solo lectura. No imprime documentos, identidades, credenciales ni direcciones de BC.
require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

async function mongo() {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const db = mongoose.connection.db;
    const nombres = ["pedidos", "materiales", "usuarios", "solicitudes_acceso", "operacionesAlmacen", "registrosAlmacen", "enviosAcopio"];
    const colecciones = {};
    for (const nombre of nombres) {
      const col = db.collection(nombre);
      colecciones[nombre] = { documentos: await col.countDocuments(), indices: (await col.indexes().catch(() => [])).map(i => ({ nombre: i.name, clave: i.key })) };
    }
    const usuario = await db.collection("usuarios").findOne({}, { projection: { email: 1 } });
    const email = usuario?.email || "sin-coincidencias@example.invalid";
    const pruebas = [
      ["pedidos_activos", "pedidos", { estado: { $ne: "Archivar" } }, null],
      ["pedidos_historico", "pedidos", { estado: "Archivar" }, null],
      ["materiales_activos", "materiales", { activo: true }, { referencia: 1 }],
      ["materiales_todos", "materiales", {}, { referencia: 1 }],
      ["accesos_recientes", "solicitudes_acceso", {}, { fechaSolicitud: -1 }],
      ["operaciones_usuario", "operacionesAlmacen", { creadoPor: email, estado: { $nin: ["creada", "rechazada"] } }, { createdAt: -1 }],
      ["registros_usuario", "registrosAlmacen", { creadoPor: email, estado: { $nin: ["creada", "rechazada"] } }, { createdAt: -1 }],
      ["autorizacion_email", "usuarios", { email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, activo: { $ne: false } }, null]
    ];
    const consultas = [];
    for (const [nombre, coleccion, filtro, orden] of pruebas) {
      let consulta = db.collection(coleccion).find(filtro);
      if (orden) consulta = consulta.sort(orden);
      const plan = await consulta.explain("executionStats");
      const stages = [];
      const visitar = nodo => { if (!nodo || typeof nodo !== "object") return; if (nodo.stage) stages.push(nodo.stage); for (const valor of Object.values(nodo)) if (valor && typeof valor === "object") visitar(valor); };
      visitar(plan.queryPlanner.winningPlan);
      consultas.push({ nombre, devueltos: plan.executionStats.nReturned, documentosExaminados: plan.executionStats.totalDocsExamined,
        clavesExaminadas: plan.executionStats.totalKeysExamined, msServidor: plan.executionStats.executionTimeMillis, stages: [...new Set(stages)] });
    }
    return { colecciones, consultas };
  } finally { await mongoose.disconnect(); }
}

async function bc() {
  const axios = require("axios");
  const auth = require("../services/businessCentral");
  const { crearCliente } = require("../services/almacenBC");
  const requests = [];
  const medir = async (recurso, cargar) => { const inicio = performance.now(); try { const respuesta = await cargar(); requests.push({ recurso, ms: Math.round(performance.now() - inicio), ok: true }); return respuesta; } catch (error) { requests.push({ recurso, ms: Math.round(performance.now() - inicio), ok: false, status: error.response?.status || error.status }); throw error; } };
  const cliente = crearCliente({ request: config => medir(new URL(config.url).pathname.split("/").pop(), () => axios.request(config)) });
  const resultados = [];
  for (const nombre of ["obtenerAlmacenesMovimiento", "obtenerDepartamentos", "obtenerTiposProyecto", "obtenerZonas", "obtenerStock", "obtenerProductos", "obtenerAcopios", "obtenerEntradas"]) {
    for (let intento = 1; intento <= 2; intento++) {
      const antes = requests.length, inicio = performance.now();
      try { const datos = await cliente[nombre](); resultados.push({ consulta: nombre, intento, filas: datos.length, ms: Math.round(performance.now() - inicio), peticionesApi: requests.length - antes }); }
      catch (error) { resultados.push({ consulta: nombre, intento, error: error.code || error.codigo || error.status || "no_disponible", ms: Math.round(performance.now() - inicio) }); }
    }
  }
  // Recursos y proyectos tienen su propio cliente OData; solo se registran tiempos y recuentos.
  for (const nombre of ["obtenerProyectos", "obtenerSolicitantesActivos"]) {
    for (let intento = 1; intento <= 2; intento++) {
      const inicio = performance.now();
      try { const datos = await auth[nombre](); resultados.push({ consulta: nombre, intento, filas: (datos.value || datos).length, ms: Math.round(performance.now() - inicio) }); }
      catch (error) { resultados.push({ consulta: nombre, intento, error: error.code || error.status || "no_disponible", ms: Math.round(performance.now() - inicio) }); }
    }
  }
  return { resultados, requests };
}

(async () => {
  const modo = process.argv[2], salida = process.argv[3];
  if (!["mongo", "bc"].includes(modo) || !salida) throw new Error("Uso: node scripts/auditar-rendimiento.js mongo|bc ruta-salida.json");
  const resultado = { fechaUTC: new Date().toISOString(), modo, datos: await (modo === "mongo" ? mongo() : bc()) };
  fs.writeFileSync(path.resolve(salida), JSON.stringify(resultado, null, 2) + "\n");
  console.log(JSON.stringify(resultado));
})().catch(error => { console.error(JSON.stringify({ auditoria: "fallida", codigo: error.code || error.status || error.name })); process.exitCode = 1; });
