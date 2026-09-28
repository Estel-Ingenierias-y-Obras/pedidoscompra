export const modosMonetarios = [
  ["bc", "Usar valores de BC"], ["preciounitario", "Introducir precio unitario"],
  ["importe", "Introducir importe total"], ["costeunitario", "Introducir coste unitario"]
];
export function prepararEntrada(fila) {
  if (!fila.numprod || !Number.isFinite(Number(fila.cantidad)) || Number(fila.cantidad) <= 0) throw new Error("Selecciona un producto y una cantidad mayor que cero.");
  const cuerpo = { solicitudId: fila.solicitudId, numprod: fila.numprod, cantidad: Number(fila.cantidad) };
  if (fila.codudmedida) cuerpo.codudmedida = fila.codudmedida;
  if (fila.tipoproyectocodigo) cuerpo.tipoproyectocodigo = fila.tipoproyectocodigo;
  if (fila.liqpornumorden) {
    const numero = Number(fila.liqpornumorden);
    if (!Number.isInteger(numero) || numero < 0) throw new Error("Selecciona un movimiento válido.");
    cuerpo.liqpornumorden = numero;
  }
  if (!modosMonetarios.some(([modo]) => modo === fila.modoMonetario)) throw new Error("Selecciona un modo monetario.");
  if (fila.modoMonetario !== "bc") {
    if (String(fila.valorMonetario ?? "").trim() === "" || !Number.isFinite(Number(fila.valorMonetario))) throw new Error("Introduce un valor monetario válido; cero es un valor explícito.");
    cuerpo[fila.modoMonetario] = Number(fila.valorMonetario);
  }
  return cuerpo;
}
export function filaDesdeOperacion(op) {
  const { claveintegracion, ...datos } = op.cuerpo;
  const modoMonetario = modosMonetarios.find(([campo]) => Object.prototype.hasOwnProperty.call(datos, campo))?.[0] || "bc";
  return { ...datos, solicitudId: op.solicitudId, modoMonetario, valorMonetario: datos[modoMonetario] ?? "",
    codudmedida: datos.codudmedida || "", liqpornumorden: datos.liqpornumorden || "", tipoproyectocodigo: datos.tipoproyectocodigo || "",
    estado: op.estado, error: op.error, codigoError: op.codigoError, proximoIntento: op.proximoIntento,
    cuerpoEnviado: { solicitudId: op.solicitudId, ...datos } };
}
