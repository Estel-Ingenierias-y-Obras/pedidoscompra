import api from "../api";

export const obtenerConfiguracion = () => api.get("/api/almacen/configuracion").then(res => res.data);
export const obtenerProductos = () => api.get("/api/almacen/productos").then(res => res.data);
export const obtenerEntradas = pagina => api.get("/api/almacen/entradas", { params: { pagina } }).then(res => res.data);
export const guardarEntrada = fila => api.post("/api/almacen/entradas", {
  ...fila,
  ...Object.fromEntries(["cantidad", "precioUnitario", "importe", "importeDto", "costeUnitario"].map(campo => [campo, Number(fila[campo])]))
}).then(res => res.data);
