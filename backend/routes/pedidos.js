const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const Pedido = require("../models/Pedido");
const DestinatarioCompra = require("../models/DestinatarioCompra");
const { obtenerUsuarioActual, permitirRoles } = require("../middleware/auth");
const {
  sendPurchaseRequestNotification,
  sendStatusChangeNotification
} = require("../services/emailService");

const router = express.Router();

router.use(obtenerUsuarioActual);

const TIPOS_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, callback) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      const error = new Error("Tipo de archivo no permitido");
      error.status = 400;
      callback(error);
      return;
    }

    callback(null, true);
  }
});

const recibirArchivos = (req, res, next) => {
  upload.fields([
    { name: "archivos", maxCount: 10 },
    { name: "archivosDescripcion", maxCount: 10 },
    { name: "archivosUrgente", maxCount: 10 },
    { name: "archivosNoUrgente", maxCount: 10 }
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const status =
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
        ? 413
        : error.status || 400;

    res.status(status).json({
      error:
        status === 413
          ? "El archivo supera el límite de 10 MB"
          : error.message
    });
  });
};

const obtenerBucket = () =>
  new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: "adjuntos" }
  );

const guardarArchivo = (file) =>
  new Promise((resolve, reject) => {
    const bucket = obtenerBucket();
    const uploadStream = bucket.openUploadStream(
      file.originalname,
      {
        contentType: file.mimetype,
        metadata: { tipo: "pedido" }
      }
    );

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => {
      resolve({
        fileId: uploadStream.id,
        nombre: file.originalname,
        tipoMime: file.mimetype,
        tamano: file.size
      });
    });

    uploadStream.end(file.buffer);
  });

const eliminarArchivo = async (fileId) => {
  const bucket = obtenerBucket();
  await bucket.delete(
    new mongoose.Types.ObjectId(fileId)
  );
};

const normalizarBooleano = (value) =>
  value === true || value === "true" || value === "Sí";

const parsearArchivosExistentes = (value) => {
  if (!value) {
    return [];
  }

  const parsed = Array.isArray(value) ? value : JSON.parse(value);

  return Array.isArray(parsed)
    ? parsed.map(item => String(item)).filter(mongoose.isValidObjectId)
    : [];
};

const crearClaveArchivo = (archivo) =>
  `${archivo.nombre || archivo.originalname}-${archivo.tamano || archivo.size}-${archivo.tipoMime || archivo.mimetype}`;

const obtenerArchivosRecibidos = (req, campo = "archivos") => {
  if (Array.isArray(req.files)) {
    return campo === "archivos" ? req.files : [];
  }

  return Array.isArray(req.files?.[campo]) ? req.files[campo] : [];
};

const obtenerTodosLosArchivosPedido = (pedido) => [
  ...(pedido.archivos || []),
  ...(pedido.archivosDescripcion || []),
  ...(pedido.archivosUrgente || []),
  ...(pedido.archivosNoUrgente || []),
  ...(pedido.adjuntosCompras || [])
];

const eliminarArchivosPedido = async (pedido) => {
  const archivos = obtenerTodosLosArchivosPedido(pedido);
  const idsEliminados = new Set();

  for (const archivo of archivos) {
    const fileId = archivo.fileId?.toString();

    if (!fileId || idsEliminados.has(fileId)) {
      continue;
    }

    try {
      await eliminarArchivo(fileId);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.message !== "FileNotFound") {
        throw error;
      }
    }

    idsEliminados.add(fileId);
  }
};
const construirActualizacionArchivos = async ({
  archivosActuales,
  idsConservados,
  archivosNuevos,
  archivosGuardados
}) => {
  const ids = new Set(idsConservados);
  const conservados = (archivosActuales || [])
    .filter(archivo => ids.has(archivo.fileId.toString()));
  const eliminados = (archivosActuales || [])
    .filter(archivo => !ids.has(archivo.fileId.toString()));
  const clavesArchivos = new Set(conservados.map(crearClaveArchivo));
  const guardadosBloque = [];

  for (const file of archivosNuevos || []) {
    const claveArchivo = crearClaveArchivo(file);

    if (clavesArchivos.has(claveArchivo)) {
      continue;
    }

    const archivoGuardado = await guardarArchivo(file);
    archivosGuardados.push(archivoGuardado);
    guardadosBloque.push(archivoGuardado);
    clavesArchivos.add(claveArchivo);
  }

  return {
    archivos: [...conservados, ...guardadosBloque],
    eliminados
  };
};

const puedeGestionarPedidos = (usuario) =>
  ["Admin", "Comprador"].includes(usuario?.rol);

const esPropietarioPedido = (pedido, usuario) =>
  String(pedido.email || "").toLowerCase() === String(usuario?.email || "").toLowerCase();

router.get("/", async (req, res) => {
  try {
    const filtro = puedeGestionarPedidos(req.usuarioActual)
      ? {}
      : { email: req.usuarioActual.email };
    const pedidos = await Pedido.find(filtro);
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", recibirArchivos, async (req, res) => {
  const archivosGuardados = [];

  try {
    const archivosLegacy = [];
    const archivosDescripcion = [];
    const archivosUrgente = [];
    const archivosNoUrgente = [];

    for (const file of obtenerArchivosRecibidos(req, "archivos")) {
      const archivoGuardado = await guardarArchivo(file);
      archivosGuardados.push(archivoGuardado);
      archivosLegacy.push(archivoGuardado);
    }

    for (const file of obtenerArchivosRecibidos(req, "archivosDescripcion")) {
      const archivoGuardado = await guardarArchivo(file);
      archivosGuardados.push(archivoGuardado);
      archivosDescripcion.push(archivoGuardado);
    }

    for (const file of obtenerArchivosRecibidos(req, "archivosUrgente")) {
      const archivoGuardado = await guardarArchivo(file);
      archivosGuardados.push(archivoGuardado);
      archivosUrgente.push(archivoGuardado);
    }

    for (const file of obtenerArchivosRecibidos(req, "archivosNoUrgente")) {
      const archivoGuardado = await guardarArchivo(file);
      archivosGuardados.push(archivoGuardado);
      archivosNoUrgente.push(archivoGuardado);
    }

    const pedido = new Pedido({
      ...req.body,
      solicitante: req.usuarioActual.nombre,
      email: req.usuarioActual.email,
      archivos: archivosLegacy,
      archivosDescripcion,
      archivosUrgente,
      archivosNoUrgente
    });

    await pedido.save();

    try {
      const destinatarios = await DestinatarioCompra.find()
        .select("email")
        .lean();
      const recipients = destinatarios.map(item => item.email);

      if (recipients.length > 0) {
        await sendPurchaseRequestNotification(pedido, recipients);
      }
    } catch (emailError) {
      console.error(
        `Error enviando notificación del pedido ${pedido._id}:`,
        emailError.response?.data || emailError.message
      );
    }

    res.status(201).json(pedido);
  } catch (error) {
    for (const archivoGuardado of archivosGuardados) {
      try {
        await eliminarArchivo(archivoGuardado.fileId);
      } catch (cleanupError) {
        console.error(
          "Error eliminando archivo huérfano:",
          cleanupError
        );
      }
    }

    res.status(500).json({ error: error.message });
  }
});

router.get("/:pedidoId/archivos/:fileId", async (req, res) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.pedidoId) ||
      !mongoose.isValidObjectId(req.params.fileId)
    ) {
      return res.status(400).json({
        error: "Identificador de archivo no válido"
      });
    }

    const pedido = await Pedido.findOne({
      _id: req.params.pedidoId,
      $or: [
        { "archivos.fileId": req.params.fileId },
        { "archivosDescripcion.fileId": req.params.fileId },
        { "archivosUrgente.fileId": req.params.fileId },
        { "archivosNoUrgente.fileId": req.params.fileId },
        { "adjuntosCompras.fileId": req.params.fileId }
      ]
    });

    if (!pedido) {
      return res.status(404).json({
        error: "Archivo no encontrado"
      });
    }

    if (!puedeGestionarPedidos(req.usuarioActual) && !esPropietarioPedido(pedido, req.usuarioActual)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const archivo = [
      ...(pedido.archivos || []),
      ...(pedido.archivosDescripcion || []),
      ...(pedido.archivosUrgente || []),
      ...(pedido.archivosNoUrgente || []),
      ...(pedido.adjuntosCompras || [])
    ].find(
      item => item.fileId.toString() === req.params.fileId
    );
    const bucket = obtenerBucket();
    const gridFile = await bucket
      .find({
        _id: new mongoose.Types.ObjectId(req.params.fileId)
      })
      .next();

    if (!gridFile || !archivo) {
      return res.status(404).json({
        error: "Archivo no encontrado"
      });
    }

    const descargar = req.query.download === "1";
    const nombreCodificado = encodeURIComponent(archivo.nombre);

    res.setHeader(
      "Content-Type",
      archivo.tipoMime || "application/octet-stream"
    );
    res.setHeader("Content-Length", gridFile.length);
    res.setHeader(
      "Content-Disposition",
      `${descargar ? "attachment" : "inline"}; filename*=UTF-8''${nombreCodificado}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    bucket
      .openDownloadStream(gridFile._id)
      .on("error", (streamError) => {
        console.error("Error leyendo archivo:", streamError);

        if (!res.headersSent) {
          res.status(500).json({
            error: "No se pudo leer el archivo"
          });
        } else {
          res.destroy(streamError);
        }
      })
      .pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", recibirArchivos, async (req, res) => {
  const archivosGuardados = [];

  try {
    const pedidoAnterior = await Pedido.findById(req.params.id);

    if (!pedidoAnterior) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const esGestorPedido = puedeGestionarPedidos(req.usuarioActual);

    if (!esGestorPedido && !esPropietarioPedido(pedidoAnterior, req.usuarioActual)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const camposGestion = new Set(["estado", "compradorAsignado"]);
    const camposAdjuntos = new Set(["archivosExistentes"]);
    const camposInfoCompras = new Set([
      "comentarioCompras",
      "adjuntosComprasExistentes"
    ]);
    const camposActualizacion = Object.keys(req.body || {});
    const esActualizacionGestion =
      camposActualizacion.length > 0 &&
      camposActualizacion.every(campo => camposGestion.has(campo));
    const esActualizacionAdjuntos =
      camposActualizacion.length > 0 &&
      camposActualizacion.every(campo => camposAdjuntos.has(campo));
    const tieneCamposInfoCompras =
      Object.prototype.hasOwnProperty.call(req.body, "comentarioCompras") ||
      Object.prototype.hasOwnProperty.call(req.body, "adjuntosComprasExistentes");
    const esActualizacionInfoCompras =
      tieneCamposInfoCompras &&
      camposActualizacion.every(campo => camposInfoCompras.has(campo));

    if (!esGestorPedido && (esActualizacionGestion || esActualizacionInfoCompras)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (
      !esActualizacionGestion &&
      !esActualizacionAdjuntos &&
      !esActualizacionInfoCompras &&
      pedidoAnterior.estado !== "Pendiente"
    ) {
      return res.status(409).json({
        error:
          "No es posible modificar un pedido que ya está siendo gestionado."
      });
    }

    let datosActualizacion = esActualizacionGestion
      ? req.body
      : esActualizacionAdjuntos
        ? {}
        : esActualizacionInfoCompras
          ? { comentarioCompras: req.body.comentarioCompras || "" }
          : {
              proyecto: req.body.proyecto,
              urgente: normalizarBooleano(req.body.urgente),
              motivoUrgencia: req.body.motivoUrgencia,
              descripcion: req.body.descripcion
            };

    const debeActualizarArchivos =
      !esActualizacionGestion &&
      !esActualizacionInfoCompras &&
      (
        Object.prototype.hasOwnProperty.call(req.body, "archivosExistentes") ||
        (req.files || []).length > 0
      );

    const debeActualizarInfoCompras = esActualizacionInfoCompras;

    let archivosEliminados = [];

    if (debeActualizarArchivos) {
      const resultadoArchivos = await construirActualizacionArchivos({
        archivosActuales: pedidoAnterior.archivos || [],
        idsConservados: parsearArchivosExistentes(req.body.archivosExistentes),
        archivosNuevos: obtenerArchivosRecibidos(req, "archivos"),
        archivosGuardados
      });

      archivosEliminados = resultadoArchivos.eliminados;
      datosActualizacion = {
        ...datosActualizacion,
        archivos: resultadoArchivos.archivos
      };
    }

    const bloquesAdjuntosPedido = [
      {
        campo: "archivosDescripcion",
        campoExistentes: "archivosDescripcionExistentes"
      },
      {
        campo: "archivosUrgente",
        campoExistentes: "archivosUrgenteExistentes"
      },
      {
        campo: "archivosNoUrgente",
        campoExistentes: "archivosNoUrgenteExistentes"
      }
    ];

    if (!esActualizacionGestion && !esActualizacionInfoCompras) {
      for (const bloque of bloquesAdjuntosPedido) {
        const debeActualizarBloque =
          Object.prototype.hasOwnProperty.call(req.body, bloque.campoExistentes) ||
          obtenerArchivosRecibidos(req, bloque.campo).length > 0;

        if (!debeActualizarBloque) {
          continue;
        }

        const resultadoBloque = await construirActualizacionArchivos({
          archivosActuales: pedidoAnterior[bloque.campo] || [],
          idsConservados: parsearArchivosExistentes(req.body[bloque.campoExistentes]),
          archivosNuevos: obtenerArchivosRecibidos(req, bloque.campo),
          archivosGuardados
        });

        archivosEliminados = [
          ...archivosEliminados,
          ...resultadoBloque.eliminados
        ];
        datosActualizacion = {
          ...datosActualizacion,
          [bloque.campo]: resultadoBloque.archivos
        };
      }
    }

    if (debeActualizarInfoCompras) {
      const idsConservadosCompras = new Set(
        parsearArchivosExistentes(req.body.adjuntosComprasExistentes)
      );
      const adjuntosComprasConservados = (pedidoAnterior.adjuntosCompras || [])
        .filter(archivo => idsConservadosCompras.has(archivo.fileId.toString()));
      archivosEliminados = [
        ...archivosEliminados,
        ...(pedidoAnterior.adjuntosCompras || [])
          .filter(archivo => !idsConservadosCompras.has(archivo.fileId.toString()))
      ];
      const clavesAdjuntosCompras = new Set(
        adjuntosComprasConservados.map(crearClaveArchivo)
      );

      for (const file of obtenerArchivosRecibidos(req, "archivos")) {
        const claveArchivo = crearClaveArchivo(file);

        if (clavesAdjuntosCompras.has(claveArchivo)) {
          continue;
        }

        const archivoGuardado = await guardarArchivo(file);
        archivosGuardados.push(archivoGuardado);
        clavesAdjuntosCompras.add(claveArchivo);
      }

      datosActualizacion = {
        ...datosActualizacion,
        adjuntosCompras: [...adjuntosComprasConservados, ...archivosGuardados]
      };
    }

    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      datosActualizacion,
      { returnDocument: "after" }
    );

    for (const archivo of archivosEliminados) {
      try {
        await eliminarArchivo(archivo.fileId);
      } catch (cleanupError) {
        console.error(
          "Error eliminando adjunto retirado del pedido:",
          cleanupError
        );
      }
    }

    if (pedidoAnterior.estado !== pedido.estado) {
      try {
        await sendStatusChangeNotification(pedido);
      } catch (emailError) {
        console.error(
          `Error enviando actualización de estado del pedido ${pedido._id}:`,
          emailError.response?.data || emailError.message
        );
      }
    }

    res.json(pedido);
  } catch (error) {
    for (const archivoGuardado of archivosGuardados) {
      try {
        await eliminarArchivo(archivoGuardado.fileId);
      } catch (cleanupError) {
        console.error(
          "Error eliminando archivo huérfano:",
          cleanupError
        );
      }
    }

    res.status(500).json({ error: error.message });
  }
});
router.delete("/admin/:id", permitirRoles("Admin"), async (req, res) => {
  try {
const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    await eliminarArchivosPedido(pedido);
    await Pedido.findByIdAndDelete(req.params.id);

    res.json({ mensaje: "Pedido eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    if (!esPropietarioPedido(pedido, req.usuarioActual)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (pedido.estado !== "Pendiente") {
      return res.status(409).json({
        error:
          "No es posible eliminar un pedido que ya está siendo gestionado."
      });
    }

    await eliminarArchivosPedido(pedido);
    await Pedido.findByIdAndDelete(req.params.id);

    res.json({ mensaje: "Pedido eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;





















