const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const Pedido = require("../models/Pedido");
const DestinatarioCompra = require("../models/DestinatarioCompra");
const {
  sendPurchaseRequestNotification,
  sendStatusChangeNotification
} = require("../services/emailService");

const router = express.Router();

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
  upload.array("archivos", 10)(req, res, (error) => {
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

router.get("/", async (req, res) => {
  try {
    const pedidos = await Pedido.find();
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", recibirArchivos, async (req, res) => {
  const archivosGuardados = [];

  try {
    for (const file of req.files || []) {
      const archivoGuardado = await guardarArchivo(file);
      archivosGuardados.push(archivoGuardado);
    }

    const pedido = new Pedido({
      ...req.body,
      archivos: archivosGuardados
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
      "archivos.fileId": req.params.fileId
    });

    if (!pedido) {
      return res.status(404).json({
        error: "Archivo no encontrado"
      });
    }

    const archivo = pedido.archivos.find(
      item => item.fileId.toString() === req.params.fileId
    );
    const bucket = obtenerBucket();
    const gridFile = await bucket
      .find({
        _id: new mongoose.Types.ObjectId(req.params.fileId)
      })
      .next();

    if (!gridFile) {
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

router.put("/:id", async (req, res) => {
  try {
    const pedidoAnterior = await Pedido.findById(req.params.id);
    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: "after" }
    );

    if (pedidoAnterior && pedido && pedidoAnterior.estado !== pedido.estado) {
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

    for (const archivo of pedido.archivos || []) {
      await eliminarArchivo(archivo.fileId);
    }

    await Pedido.findByIdAndDelete(req.params.id);

    res.json({ mensaje: "Pedido eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

