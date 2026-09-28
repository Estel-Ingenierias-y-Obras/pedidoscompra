const Registro = require("../models/RegistroAlmacen");
const bc = require("./almacenBC");
const { crearServicio } = require("./almacen");

function validarRegistro(body) {
  if (!body || !bc.UUID.test(body.idlinea || "") || !bc.UUID.test(body.claveintegracion || "") || body.solicitudId !== body.idlinea || Object.keys(body).some(key => !["idlinea", "solicitudId", "claveintegracion"].includes(key))) {
    throw Object.assign(new Error("Selecciona una línea de BC con su clave de integración para registrar."), { status: 400, seguro: true, definitivo: true });
  }
  return { idlinea: body.idlinea, claveintegracion: body.claveintegracion };
}
const confirmarRegistro = (respuesta, cuerpo) => respuesta.registrado === true && respuesta.idlinea === cuerpo.idlinea && respuesta.claveintegracion === cuerpo.claveintegracion;
const servicio = crearServicio({ modelo: Registro, cliente: { destino: () => `${bc.destino()}/registrosProducto`, crearEntrada: cuerpo => bc.registrarEntrada(cuerpo) }, validar: validarRegistro, confirmar: confirmarRegistro, reintentarRechazadas: true });
module.exports = { registrarEntrada: servicio.crearEntrada, obtenerPendientes: servicio.obtenerOperaciones, validarRegistro, confirmarRegistro };
