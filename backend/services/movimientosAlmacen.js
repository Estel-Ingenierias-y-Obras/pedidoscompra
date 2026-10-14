const bc = require("./almacenBC");
const businessCentral = require("./businessCentral");
const { UUID } = bc;
const fallo = (mensaje, status = 400, codigo = "MOVIMIENTO_INVALIDO") => Object.assign(new Error(mensaje), { status, seguro: true, codigo });
const objeto = valor => valor && typeof valor === "object" && !Array.isArray(valor);
function campos(valor, permitidos) {
  if (!objeto(valor) || Object.keys(valor).some(campo => !permitidos.includes(campo))) throw fallo("El movimiento contiene campos no admitidos.");
}
function validarDTO(datos) {
  campos(datos, ["solicitudId", "tipoOperacion", "serie", "cabecera", "lineas"]);
  if (!UUID.test(datos.solicitudId || "")) throw fallo("La solicitud debe tener una identidad UUID estable.");
  if (datos.tipoOperacion !== "acopio" || datos.serie !== "ACO-ALM") throw fallo("Esta operación debe ser un acopio de la serie ACO-ALM.");
  const c = datos.cabecera;
  campos(c, ["tipoorigen", "origen", "tipodestino", "destino", "solicitante", "tipoproyectocodigo", "departamento"]);
  for (const lado of ["origen", "destino"]) if (!["Location", "Job"].includes(c[`tipo${lado}`])) throw fallo("Tipo de origen o destino no válido.");
  for (const campo of ["origen", "destino", "solicitante", "tipoproyectocodigo", "departamento"]) if (typeof c[campo] !== "string" || !c[campo].trim() || c[campo].length > 20) throw fallo(`Selecciona un valor válido para ${campo}.`);
  if (c.tipoorigen === c.tipodestino && c.origen === c.destino) throw fallo("El origen y el destino deben ser distintos.");
  if (!Array.isArray(datos.lineas) || !datos.lineas.length) throw fallo("Añade al menos una línea.");
  const ids = new Set();
  for (const l of datos.lineas) {
    campos(l, ["id", "numprod", "cantidad"]);
    if (typeof l.id !== "string" || !l.id || l.id.length > 100 || ids.has(l.id)) throw fallo("Las líneas deben tener identificadores únicos.");
    ids.add(l.id);
    if (typeof l.numprod !== "string" || !l.numprod.trim() || l.numprod.length > 20 || typeof l.cantidad !== "number" || !Number.isFinite(l.cantidad) || l.cantidad <= 0) throw fallo("Cada línea necesita un artículo y una cantidad mayor que cero.");
  }
  return datos;
}
function crearServicio({ catalogos = bc, proyectos = () => businessCentral.obtenerProyectos({ soloAbiertos: true }), recursos = () => businessCentral.obtenerSolicitantesActivos() } = {}) {
  return {
    preparar: async cuerpo => {
      const dto = validarDTO(cuerpo);
      const [almacenes, articulos, solicitantes, departamentos, tipos, obras] = await Promise.all([
        catalogos.obtenerAlmacenesMovimiento(), catalogos.obtenerArticulosMovimiento(), recursos(), catalogos.obtenerDepartamentos(), catalogos.obtenerTiposProyecto(), proyectos()
      ]);
      const c = dto.cabecera;
      for (const lado of ["origen", "destino"]) {
        const existe = c[`tipo${lado}`] === "Location" ? almacenes.some(a => a.code === c[lado]) : obras.value.some(p => p.nomProyecto === c[lado]);
        if (!existe) throw fallo(`El ${lado} ya no está disponible en BC. Actualiza los datos.`, 422);
      }
      if (!solicitantes.some(r => r.codigo === c.solicitante)) throw fallo("El solicitante ya no está activo en BC.", 422);
      if (!departamentos.some(d => d.code === c.departamento)) throw fallo("El departamento no existe en BC.", 422);
      if (!["DIRECTO", "INDIRECTO"].includes(c.tipoproyectocodigo) || !tipos.some(t => t.codigo === c.tipoproyectocodigo && t.bloqueado !== true)) throw fallo("El tipo de proyecto no está disponible en BC.", 422);
      const porNumero = new Map(articulos.map(a => [a.number, a]));
      const lineas = dto.lineas.map(l => {
        const articulo = porNumero.get(l.numprod);
        if (!articulo || !articulo.baseUnitOfMeasureCode) throw fallo(`El artículo ${l.numprod} no está disponible o no tiene unidad base.`, 422);
        return { idintegracion: l.id, numprod: l.numprod, cantidad: l.cantidad, codudmedida: articulo.baseUnitOfMeasureCode };
      });
      return {
        solicitudId: dto.solicitudId, estado: "preparado", enviadoBC: false, registrado: false, contratoALConfirmado: false,
        // Propuesta de mapeo, NO un POST válido para las páginas AL de solo lectura.
        propuestaBC: { claveintegracion: dto.solicitudId, cabecera: { serie: "ACO-ALM", tipoorigen: c.tipoorigen, origen: c.origen, tipodestino: c.tipodestino, destino: c.destino, solicitante: c.solicitante }, dimensiones: [{ codigo: "TIPO PROYECTO", valor: c.tipoproyectocodigo }, { codigo: "DEPART", valor: c.departamento }], lineas },
        advertencias: ["Datos contrastados con BC. El movimiento todavía no se ha enviado.", "Falta comprobar la disponibilidad del origen y las dimensiones obligatorias.", "La creación y el registro necesitan el contrato de escritura de la extensión AL."]
      };
    },
    enviar: async cuerpo => {
      validarDTO(cuerpo);
      throw fallo("La API AL de acopios solo admite consultas. No se ha creado ningún documento.", 501, "ACOPIO_CREACION_NO_DISPONIBLE");
    },
    registrar: async ({ id, claveintegracion } = {}) => {
      if (!UUID.test(id || "") || !UUID.test(claveintegracion || "")) throw fallo("Selecciona un documento de BC y su clave de integración.");
      throw fallo("El registro de acopios requiere una rutina soportada del partner y un comprobante verificable. No se ha registrado el movimiento.", 501, "ACOPIO_REGISTRO_NO_DISPONIBLE");
    }
  };
}
module.exports = { ...crearServicio(), crearServicio, validarDTO };
