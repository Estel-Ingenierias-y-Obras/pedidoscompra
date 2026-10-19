const bc = require("./almacenBC");
const EnvioAcopio = require("../models/EnvioAcopio");
const { obtenerSolicitantesActivos } = require("./businessCentral");
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
  campos(c, ["tipoorigen", "origen", "tipodestino", "destino", "solicitante", "tipoproyectocodigo", "departamento", "zona"]);
  for (const lado of ["origen", "destino"]) if (!["Location", "Job"].includes(c[`tipo${lado}`])) throw fallo("Tipo de origen o destino no válido.");
  for (const campo of ["origen", "destino", "solicitante", "tipoproyectocodigo", "departamento", "zona"]) if (typeof c[campo] !== "string" || !c[campo].trim() || c[campo].length > 20) throw fallo(`Selecciona un valor válido para ${campo}.`);
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
function crearServicio({ historial = EnvioAcopio, cliente = bc, recursos = obtenerSolicitantesActivos } = {}) {
  const alcance = usuario => {
    if (!usuario?.email) throw fallo("Usuario no identificado.", 401);
    bc.configuracionBC();
    return { entorno: process.env.BC_ENVIRONMENT, empresa: process.env.BC_COMPANY_ID, creadoPor: usuario.email.toLowerCase(), confirmadoBC: true };
  };
  const respuesta = registro => ({ solicitudId: registro.solicitudId, estado: registro.estado, confirmadoBC: registro.confirmadoBC, bcId: registro.bcId, numero: registro.numero, registrado: registro.estado === "registrado", fechaRegistro: registro.fechaRegistro, comprobanteRegistro: registro.comprobanteRegistro });
  const comprobarCreacion = (recibo, dto) => recibo?.creado === true && UUID.test(recibo.id || "") && UUID.test(recibo.idacopio || "") && recibo.claveintegracion?.toLowerCase() === dto.solicitudId.toLowerCase() && typeof recibo.numero === "string" && !!recibo.numero.trim();
  const reciboUnico = async clave => {
    const registros = await cliente.obtenerSolicitudAcopio(clave);
    if (registros.length !== 1) throw fallo("BC no confirma una única solicitud de acopio. Conserva los datos y revisa el resultado.", 409, "GM_ACOPIO_REVIEW");
    return registros[0];
  };
  return {
    recuperarBorrador: async (solicitudId, usuario) => {
      if (!UUID.test(solicitudId || "")) throw fallo("Referencia de envío no válida.");
      const { confirmadoBC, ...scope } = alcance(usuario);
      const op = await historial.findOne({ ...scope, solicitudId }).lean();
      if (!op) throw fallo("No se encontró el envío original.", 404);
      // Guardar el rechazo HTTP de creación permite recuperar cualquier validación,
      // sin depender del idioma o formato del mensaje de BC. Los patrones solo
      // cubren incidencias antiguas anteriores a ese dato persistido.
      const rechazoProyecto = /Status\s+must\s+be\s+equal\s+to\s+['"]Open['"]\s+in\s+(?:Job|Project)\b/i.test(op.error || "");
      const rechazoStock = /The\s+Total\s+Requested\s+quantity\s+of\s+item\b[\s\S]*\bexceeds\s+the\s+quantity\s+in\s+location\b/i.test(op.error || "");
      const revision = () => fallo("El intento anterior requiere revisión en BC antes de volver a enviar. Puedes seguir editando el borrador.", 409, "GM_ACOPIO_REVIEW");
      if (op.confirmadoBC || op.estado !== "error" || !(op.rechazoCreacion === true || rechazoProyecto || rechazoStock)) throw revision();
      const solicitudes = await cliente.obtenerSolicitudAcopio(solicitudId);
      if (solicitudes.length > 1) throw revision();
      if (solicitudes.length === 1) {
        const recibo = solicitudes[0];
        if (recibo.claveintegracion?.toLowerCase() !== solicitudId.toLowerCase()
          || recibo.creado !== false || recibo.registroiniciado !== false || recibo.registrado !== false
          || !UUID.test(recibo.idacopio || "") || !recibo.numero) throw revision();
        let ausente = false;
        try { await cliente.obtenerCabeceraAcopio(recibo.idacopio); }
        catch (error) { if (error.status !== 404) throw error; ausente = true; }
        if (!ausente || (await cliente.obtenerLineasAcopio(recibo.numero)).length) throw revision();
      }
      // No borrar ni reutilizar la solicitud rechazada: AL conserva su recibo.
      return { solicitudId, editable: true };
    },
    obtenerEnviados: async usuario => {
      const envios = await historial.find(alcance(usuario)).sort({ fechaEnvio: -1 }).lean();
      const registrado = envio => envio.estado === "registrado" && !!envio.comprobanteRegistro?.id && !!envio.fechaRegistro;
      if (!envios.some(envio => !registrado(envio))) return envios;
      // La existencia del borrador se consulta en BC, no en el recibo de creación:
      // ese recibo se conserva incluso después de borrar o registrar el acopio.
      const acopios = await cliente.obtenerAcopios();
      if (!Array.isArray(acopios) || acopios.some(acopio => !UUID.test(acopio?.id || ""))) {
        throw fallo("BC no devolvió una lista válida de acopios. No se pudo actualizar el listado.", 502);
      }
      const actuales = new Map(acopios.map(acopio => [acopio.id.toLowerCase(), acopio]));
      return envios.filter(envio => registrado(envio) || actuales.has(envio.bcId?.toLowerCase()))
        .map(envio => registrado(envio) ? envio : { ...envio, cabecera: { ...envio.cabecera, ...actuales.get(envio.bcId.toLowerCase()) } });
    },
    obtenerDetalle: async (id, usuario) => {
      if (!UUID.test(id || "")) throw fallo("Identificador de movimiento no válido.");
      const envio = await historial.findOne({ ...alcance(usuario), bcId: id }).lean();
      if (!envio) throw fallo("No se encontró el movimiento enviado.", 404);
      return envio;
    },
    enviar: async (cuerpo, usuario) => {
      const dto = validarDTO(cuerpo);
      const scope = alcance(usuario);
      const identidad = { entorno: scope.entorno, empresa: scope.empresa, solicitudId: dto.solicitudId };
      const op = await historial.findOneAndUpdate(identidad, { $setOnInsert: { ...identidad, creadoPor: scope.creadoPor, confirmadoBC: false, estado: "borrador", cabecera: dto.cabecera, lineas: dto.lineas, datosEnviados: dto } }, { upsert: true, new: true }).lean();
      if (op.creadoPor !== scope.creadoPor) throw fallo("La clave corresponde a otra solicitud.", 403);
      if (JSON.stringify(op.datosEnviados) !== JSON.stringify(dto)) throw fallo("La clave ya está vinculada a otros datos. No se creará un segundo movimiento.", 409, "GM_KEY_CONFLICT");
      if (op.confirmadoBC) return respuesta(op);
      let creacionRespondio = false;
      try {
        const activos = await recursos();
        if (!activos.some(r => r.codigo === dto.cabecera.solicitante)) {
          if (op.creacionIntentada) throw fallo("El solicitante ya no está activo y existe un envío pendiente de confirmar. Revisa la solicitud original.", 409, "GM_ACOPIO_REVIEW");
          await historial.deleteOne({ ...identidad, confirmadoBC: false });
          throw fallo("El solicitante no está activo en BC.", 422);
        }
        await historial.updateOne({ ...identidad, confirmadoBC: false }, { $set: { creacionIntentada: true } });
        await cliente.crearAcopio(dto);
        creacionRespondio = true;
        const recibo = await reciboUnico(dto.solicitudId);
        if (!comprobarCreacion(recibo, dto) || recibo.registrado === true) throw fallo("BC no confirma la creación pendiente de este acopio. Revisa la solicitud original.", 409, "GM_ACOPIO_REVIEW");
        const [cabecera, lineas] = await Promise.all([cliente.obtenerCabeceraAcopio(recibo.idacopio), cliente.obtenerLineasAcopio(recibo.numero)]);
        if (cabecera.id !== recibo.idacopio || lineas.length !== dto.lineas.length) throw fallo("La cabecera o las líneas no coinciden con el comprobante de creación.", 409, "GM_ACOPIO_REVIEW");
        const cambios = { bcId: recibo.idacopio, bcRequestId: recibo.id, numero: recibo.numero, confirmadoBC: true, estado: "enviadoBC", fechaEnvio: new Date(), cabecera: { ...dto.cabecera, ...cabecera }, lineas, error: "" };
        const confirmado = await historial.findOneAndUpdate({ ...identidad, creadoPor: scope.creadoPor }, { $set: cambios }, { new: true }).lean();
        return respuesta(confirmado);
      } catch (error) {
        await historial.updateOne({ ...identidad, confirmadoBC: false }, { $set: {
          estado: "error", error: error.seguro ? error.message : "Resultado del envío pendiente de confirmar.",
          rechazoCreacion: op.rechazoCreacion === true || (!creacionRespondio && error.status === 400 && !error.incierto)
        } });
        if (error.status === 404 && !creacionRespondio && !op.creacionIntentada) {
          await historial.deleteOne({ ...identidad, confirmadoBC: false });
          throw fallo("Instala API-GestionMaterial 1.1.6 en el sandbox para habilitar solicitudesAcopio. No se ha confirmado ningún envío.", 501, "ACOPIO_API_NO_PUBLICADA");
        }
        if (error.status === 404) throw fallo("No se encuentra el recurso de una solicitud previamente enviada. No se creará un sustituto.", 409, "GM_ACOPIO_REVIEW");
        if (error.status === 400) {
          const solicitudes = await cliente.obtenerSolicitudAcopio(dto.solicitudId);
          if (solicitudes.length === 0 && !op.creacionIntentada) { await historial.deleteOne({ ...identidad, confirmadoBC: false }); throw error; }
          throw fallo(error.message, 409, "GM_ACOPIO_REVIEW");
        }
        throw error;
      }
    },
    registrar: async ({ id, claveintegracion } = {}, usuario) => {
      if (!UUID.test(id || "") || !UUID.test(claveintegracion || "")) throw fallo("Selecciona un documento de BC y su clave de integración.");
      const filtro = { ...alcance(usuario), bcId: id, solicitudId: claveintegracion };
      const op = await historial.findOne(filtro).lean();
      if (!op || !UUID.test(op.bcRequestId || "")) throw fallo("No se encontró una solicitud confirmada para este movimiento.", 404);
      if (op.estado === "registrado" && op.comprobanteRegistro?.id) return respuesta(op);
      try {
        try {
          await cliente.registrarAcopio(op.bcRequestId);
        } catch (errorOriginal) {
          // El partner puede confirmar movimientos y después fallar al abrir su
          // diálogo de histórico. La rama AL registroiniciado solo verifica lo
          // existente: nunca vuelve a ejecutar la codeunit del partner.
          try {
            const pendiente = await reciboUnico(claveintegracion);
            if (!comprobarCreacion(pendiente, op) || pendiente.idacopio !== id || pendiente.registroiniciado !== true) throw errorOriginal;
            await cliente.registrarAcopio(op.bcRequestId);
          } catch (_) { throw errorOriginal; }
        }
        const recibo = await reciboUnico(claveintegracion);
        if (!comprobarCreacion(recibo, op) || recibo.idacopio !== id || recibo.registrado !== true || !UUID.test(recibo.idhistorico || "") || !Number.isFinite(Date.parse(recibo.fecharegistro)) || !(recibo.idmovproducto > 0 || recibo.idmovproyecto > 0)) throw fallo("BC no devuelve un comprobante verificable de registro para este acopio.", 409, "GM_ACOPIO_REVIEW");
        const cambios = { estado: "registrado", fechaRegistro: new Date(recibo.fecharegistro), comprobanteRegistro: { id: recibo.id, historicoId: recibo.idhistorico, movimientoProducto: recibo.idmovproducto, movimientoProyecto: recibo.idmovproyecto }, error: "" };
        const registrado = await historial.findOneAndUpdate(filtro, { $set: cambios }, { new: true }).lean();
        return respuesta(registrado);
      } catch (error) {
        await historial.updateOne(filtro, { $set: { estado: "error", error: error.seguro ? error.message : "Registro pendiente de confirmar." } });
        throw error;
      }
    }
  };
}
module.exports = { ...crearServicio(), crearServicio, validarDTO };
