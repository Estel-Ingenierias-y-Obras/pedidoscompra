const Registro = require("../models/RegistroAlmacen");
const bc = require("./almacenBC");
const { crearServicio } = require("./almacen");

function validarRegistro(body) {
  if (!body || !bc.UUID.test(body.idlinea || "") || !bc.UUID.test(body.claveintegracion || "") || body.solicitudId !== body.idlinea || Object.keys(body).some(key => !["idlinea", "solicitudId", "claveintegracion"].includes(key))) {
    throw Object.assign(new Error("Selecciona una línea de BC con su clave de integración para registrar."), { status: 400, seguro: true, definitivo: true });
  }
  return { idlinea: body.idlinea, claveintegracion: body.claveintegracion };
}
// BC puede devolver los GUID con otra capitalización; su identidad no cambia.
const mismoGuid = (a, b) => typeof a === "string" && typeof b === "string" && bc.UUID.test(a) && bc.UUID.test(b) && a.toLowerCase() === b.toLowerCase();
const confirmarRegistro = (respuesta, cuerpo) => respuesta?.registrado === true && mismoGuid(respuesta.idlinea, cuerpo.idlinea) && mismoGuid(respuesta.claveintegracion, cuerpo.claveintegracion);
const servicio = crearServicio({ modelo: Registro, cliente: { destino: () => `${bc.destino()}/registrosProducto`, crearEntrada: cuerpo => bc.registrarEntrada(cuerpo) }, validar: validarRegistro, confirmar: confirmarRegistro, reintentarRechazadas: true });
module.exports = { registrarEntrada: servicio.crearEntrada, obtenerPendientes: servicio.obtenerOperaciones, validarRegistro, confirmarRegistro };
