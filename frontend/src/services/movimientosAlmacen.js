import api from "../api";

export function validarMovimiento(documento) {
  const { cabecera, lineas } = documento;
  if (!cabecera.origen || !cabecera.destino) return "Selecciona origen y destino.";
  if (cabecera.tipoorigen === cabecera.tipodestino && cabecera.origen === cabecera.destino) return "El origen y el destino deben ser distintos.";
  if (!cabecera.solicitante) return "Selecciona el solicitante.";
  if (!cabecera.tipoproyectocodigo || !cabecera.departamento) return "Selecciona el tipo de proyecto y el departamento.";
  if (!lineas.length) return "Añade al menos una línea de artículo.";
  if (lineas.some(linea => !linea.numprod || !Number.isFinite(Number(linea.cantidad)) || Number(linea.cantidad) <= 0)) return "Selecciona un artículo y una cantidad mayor que cero en cada línea.";
  return "";
}
export function construirMovimiento(documento) {
  const error = validarMovimiento(documento);
  if (error) throw new Error(error);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documento.solicitudId || "")) throw new Error("El borrador no tiene una identidad válida.");
  const c = documento.cabecera;
  return { solicitudId: documento.solicitudId, tipoOperacion: "acopio", serie: "ACO-ALM", cabecera: { tipoorigen: c.tipoorigen, origen: c.origen, tipodestino: c.tipodestino, destino: c.destino, solicitante: c.solicitante, tipoproyectocodigo: c.tipoproyectocodigo, departamento: c.departamento }, lineas: documento.lineas.map(l => ({ id: l.id, numprod: l.numprod, cantidad: Number(l.cantidad) })) };
}
// Preparar solo valida y consulta catálogos; no envía escrituras a BC.
export const prepararMovimiento = documento => api.post("/api/almacen/movimientos/preparar", construirMovimiento(documento)).then(res => res.data);
// Las rutas de escritura devuelven 501 hasta implementar el contrato AL.
export const enviarMovimiento = documento => api.post("/api/almacen/movimientos", construirMovimiento(documento)).then(res => res.data);
export const registrarMovimiento = ({ id, claveintegracion }) => api.post(`/api/almacen/movimientos/${encodeURIComponent(id)}/registrar`, { claveintegracion }).then(res => res.data);
