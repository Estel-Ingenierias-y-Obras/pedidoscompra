require("dotenv").config();
const mongoose = require("mongoose");

const normalizarReferencia = valor => String(valor || "").trim().toLocaleUpperCase("es");

async function obtenerIndices(coleccion) {
  try {
    return await coleccion.indexes();
  } catch (error) {
    if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
    throw error;
  }
}

async function migrar() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Falta MONGODB_URI o MONGO_URI en la configuración");

  await mongoose.connect(uri);
  const materiales = mongoose.connection.collection("materiales");
  const indices = await obtenerIndices(materiales);

  for (const indice of indices.filter(item => item.unique && (
    item.key.nombreNormalizado === 1 ||
    item.key.referenciaNormalizada === 1 ||
    item.key["referencias.referenciaNormalizada"] === 1
  ))) {
    await materiales.dropIndex(indice.name);
  }

  const documentos = await materiales.find({}).toArray();
  let actualizados = 0;

  for (const material of documentos) {
    const nombre = String(material.nombre || "Material").trim();
    const descripcion = String(material.descripcion || nombre).trim();
    const variantes = Array.isArray(material.referencias) && material.referencias.length > 0
      ? material.referencias.map(item => ({
          referencia: String(item.referencia || "").trim(),
          unidadMedida: (item.unidadesMedida || []).map(String).map(unidad => unidad.trim()).filter(Boolean).join(", ") || "Unidad"
        })).filter(item => item.referencia)
      : [{
          referencia: String(material.referencia || `LEGACY-${String(material._id).slice(-8).toUpperCase()}`).trim(),
          unidadMedida: String(material.unidadMedida || "Unidad").trim()
        }];

    const [principal, ...adicionales] = variantes;
    await materiales.updateOne({ _id: material._id }, {
      $set: {
        nombre,
        nombreNormalizado: nombre.toLocaleLowerCase("es"),
        descripcion,
        referencia: principal.referencia,
        referenciaNormalizada: normalizarReferencia(principal.referencia),
        unidadMedida: principal.unidadMedida
      },
      $unset: { referencias: "" }
    });

    for (const variante of adicionales) {
      const referenciaNormalizada = normalizarReferencia(variante.referencia);
      await materiales.updateOne(
        { referenciaNormalizada },
        { $setOnInsert: {
          nombre,
          nombreNormalizado: nombre.toLocaleLowerCase("es"),
          descripcion,
          referencia: variante.referencia,
          referenciaNormalizada,
          unidadMedida: variante.unidadMedida,
          activo: material.activo !== false,
          createdAt: material.createdAt || new Date(),
          updatedAt: new Date()
        } },
        { upsert: true }
      );
    }
    actualizados += 1;
  }

  const duplicadas = await materiales.aggregate([
    { $group: { _id: "$referenciaNormalizada", total: { $sum: 1 } } },
    { $match: { _id: { $ne: null }, total: { $gt: 1 } } },
    { $limit: 1 }
  ]).toArray();
  if (duplicadas.length) throw new Error(`Hay referencias duplicadas: ${duplicadas[0]._id}`);

  await materiales.createIndex({ nombreNormalizado: 1 });
  await materiales.createIndex({ referenciaNormalizada: 1 }, { unique: true });
  console.log(`Migración completada: ${actualizados} materiales revisados`);
}

migrar()
  .catch(error => {
    console.error("Error ejecutando la migración de materiales:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
