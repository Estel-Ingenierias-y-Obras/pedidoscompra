import api from "../api";
export const obtenerStock = () => api.get("/api/almacen/stock").then(res => res.data);
export const obtenerConfiguracion = () => api.get("/api/almacen/configuracion").then(res => res.data);
// Compatibilidad con respuestas del catálogo personalizado y de la API estándar.
export function normalizarProductos(datos) {
  if (!Array.isArray(datos)) throw new Error("El catálogo de materiales no tiene un formato válido.");
  return datos.map(item => {
    const numprod = item.numprod || item.number;
    if (typeof numprod !== "string" || !numprod.trim()) throw new Error("El catálogo de materiales contiene productos sin código.");
    const descripcion = item.descripcion || item.displayName || numprod;
    const unidad = item.codudmedida || item.baseUnitOfMeasureCode || "";
    return { ...item, numprod, number: numprod, descripcion, displayName: descripcion,
      codudmedida: unidad, baseUnitOfMeasureCode: unidad };
  });
}
export const obtenerProductos = () => api.get("/api/almacen/productos").then(res => normalizarProductos(res.data));
const lecturasProductos = new Map();
function lecturaProducto(params, ttl, cargar) {
  const clave = JSON.stringify([localStorage.getItem("microsoftAuthToken"), params]);
  const previa = lecturasProductos.get(clave);
  if (previa && (previa.pendiente || previa.expira > Date.now())) return previa.promesa;
  for (const [key, entrada] of lecturasProductos) if (!entrada.pendiente && entrada.expira <= Date.now()) lecturasProductos.delete(key);
  if (lecturasProductos.size >= 100) lecturasProductos.delete(lecturasProductos.keys().next().value);
  const entrada = { pendiente: true };
  entrada.promesa = Promise.resolve().then(cargar).then(datos => {
    entrada.pendiente = false; entrada.expira = Date.now() + ttl; return datos;
  }).catch(error => { if (lecturasProductos.get(clave) === entrada) lecturasProductos.delete(clave); throw error; });
  lecturasProductos.set(clave, entrada);
  return entrada.promesa;
}
// Evita enviar filtros a un backend antiguo que los ignore y descargue todo el catálogo.
const comprobarBusquedaProductos = () => lecturaProducto("capacidad-busqueda", 60000, async () => {
  const { data } = await api.get("/api/almacen/configuracion", { timeout: 10000 });
  if (data?.busquedaProductos !== true) throw new Error("El servidor necesita actualizarse para buscar artículos. Actualiza el backend y recarga la aplicación.");
});
export async function obtenerCatalogosMovimiento() {
  await comprobarBusquedaProductos();
  return api.get("/api/almacen/movimientos/catalogos", { params: { sinArticulos: "1" } });
}
export function buscarProductos(texto) {
  const buscar = texto.trim().toLocaleLowerCase("es");
  if (buscar.length < 3) return Promise.resolve({ articulos: [], hayMas: false });
  return lecturaProducto({ buscar }, 30000, async () => {
    await comprobarBusquedaProductos();
    const { data } = await api.get("/api/almacen/productos", { params: { buscar }, timeout: 20000 });
    if (!Array.isArray(data?.articulos) || data.articulos.length > 20 || typeof data.hayMas !== "boolean") throw new Error("El servidor no ha devuelto una búsqueda de artículos válida.");
    const articulos = normalizarProductos(data.articulos);
    if (articulos.some(item => typeof item.referenciaTlm !== "string" || !item.referenciaTlm.trim())) throw new Error("La búsqueda contiene artículos sin referencia válida.");
    return { articulos, hayMas: data.hayMas };
  });
}
export function obtenerProducto(numprod) {
  return lecturaProducto({ numprod }, 0, async () => {
    await comprobarBusquedaProductos();
    const res = await api.get("/api/almacen/productos", { params: { numprod }, timeout: 20000 });
    const producto = normalizarProductos(res.data).find(item => item.numprod === numprod);
    if (!producto || !Number.isFinite(producto.inventory)) throw new Error("No se pudo consultar el inventario del artículo.");
    return producto;
  });
}
export const obtenerTiposProyecto = () => api.get("/api/almacen/tipos-proyecto").then(res => res.data);
export const obtenerUnidades = numprod => api.get("/api/almacen/unidades-producto", { params: { numprod } }).then(res => validarCatalogo(res.data));
export const obtenerEntradas = () => api.get("/api/almacen/entradas").then(res => res.data);
export const obtenerOperaciones = () => api.get("/api/almacen/operaciones").then(res => res.data);
export const obtenerEnviados = () => api.get("/api/almacen/enviados").then(res => res.data);
export const guardarEntrada = cuerpo => api.post("/api/almacen/entradas", cuerpo).then(res => res.data);
export const registrarEntrada = entrada => api.post(`/api/almacen/entradas/${entrada.id}/registrar`, { claveintegracion: entrada.claveintegracion }).then(res => res.data);
export const obtenerRegistrosPendientes = () => api.get("/api/almacen/registros-pendientes").then(res => res.data);

export const obtenerMovimientosAplicables = numprod => api.get("/api/almacen/movimientos-aplicables", { params: { numprod } }).then(res => validarCatalogo(res.data));

function validarCatalogo(datos) {
  if (!Array.isArray(datos)) throw new Error("El backend devolvió una respuesta de catálogo no válida.");
  return datos;
}
