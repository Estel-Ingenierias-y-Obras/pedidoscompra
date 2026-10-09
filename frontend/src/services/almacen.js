import api from "../api";
export const obtenerStock = () => api.get("/api/almacen/stock").then(res => res.data);
export const obtenerConfiguracion = () => api.get("/api/almacen/configuracion").then(res => res.data);
// Compatibilidad con respuestas del catálogo personalizado y de la API estándar.
export function normalizarProductos(datos) {
  if (!Array.isArray(datos)) throw new Error("El catálogo de materiales no tiene un formato válido.");
  return datos.map(item => {
    const numprod = item.numprod || item.number;
    if (typeof numprod !== "string" || !numprod.trim()) throw new Error("El catálogo de materiales contiene productos sin código.");
    return { ...item, numprod, descripcion: item.descripcion || item.displayName || numprod,
      codudmedida: item.codudmedida || item.baseUnitOfMeasureCode || "" };
  });
}
export const obtenerProductos = () => api.get("/api/almacen/productos").then(res => normalizarProductos(res.data));
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
