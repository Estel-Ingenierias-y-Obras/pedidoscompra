const ExcelJS = require("exceljs");

const normalizarCabecera = valor => String(valor).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("es");

async function leerMateriales(buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  if (libro.worksheets.length !== 1) throw new Error("El Excel debe contener una sola hoja");
  const hoja = libro.worksheets[0];
  const columnas = ["Referencia", "Descripción", "Cantidad", "Coste"];
  if (hoja.columnCount !== 4 || columnas.some((titulo, i) => normalizarCabecera(hoja.getRow(1).getCell(i + 1).text) !== normalizarCabecera(titulo))) {
    throw new Error("Columnas esperadas: Referencia, Descripción, Cantidad, Coste (en ese orden)");
  }
  if (hoja.rowCount > 5001) throw new Error("Máximo 5.000 filas de materiales");
  const filas = [];
  for (let fila = 2; fila <= hoja.rowCount; fila++) {
    const valores = [1, 2, 3, 4].map(col => hoja.getRow(fila).getCell(col).value);
    if (valores.every(v => v == null || String(v).trim() === "")) {
      filas.push({ fila, omitida: true });
      continue;
    }
    const [referencia, descripcion, cantidadOriginal, costeOriginal] = valores;
    const esFormulaCantidad = cantidadOriginal && typeof cantidadOriginal === "object" &&
      ("formula" in cantidadOriginal || "sharedFormula" in cantidadOriginal);
    // ExcelJS lee el resultado guardado en el archivo; no ejecuta fórmulas.
    // El getter value de ExcelJS omite resultados falsy, como 0; result los conserva.
    const cantidad = esFormulaCantidad ? hoja.getRow(fila).getCell(3).result : cantidadOriginal;
    const coste = costeOriginal == null || (typeof costeOriginal === "string" && !costeOriginal.trim()) ? 0 : costeOriginal;
    const errores = [];
    for (const [campo, valor] of [["Referencia", referencia], ["Descripción", descripcion]]) {
      if (!((typeof valor === "string" || typeof valor === "number") && String(valor).trim())) {
        errores.push(`${campo}: valor obligatorio de texto o número; no se admiten fórmulas`);
      }
    }
    for (const [campo, valor] of [["Cantidad", cantidad], ["Coste", coste]]) {
      if (!(typeof valor === "number" && Number.isFinite(valor) && valor >= 0)) {
        errores.push(campo === "Cantidad" && esFormulaCantidad
          ? "Cantidad: la fórmula debe tener un resultado numérico no negativo guardado. Recalcula y guarda el archivo en Excel antes de importarlo"
          : `${campo}: debe ser un número no negativo${campo === "Coste" ? "; no se admiten fórmulas" : ""}`);
      }
    }
    if (errores.length) {
      filas.push({ fila, error: errores.join(". ") });
      continue;
    }
    filas.push({ fila, datos: { referencia: String(referencia).trim(), descripcion: String(descripcion).trim(), cantidad, coste } });
  }
  return filas;
}

async function importarFilas(filas, Material) {
  const resumen = { importados: 0, omitidos: 0, errores: 0, detalles: [] };
  for (const { fila, datos, error, omitida } of filas) {
    if (omitida) { resumen.omitidos++; resumen.detalles.push({ fila, mensaje: "Fila vacía" }); continue; }
    if (error) { resumen.errores++; resumen.detalles.push({ fila, mensaje: error }); continue; }
    try {
      // El índice único resuelve también duplicados dentro del fichero e importaciones concurrentes.
      await Material.create(datos);
      resumen.importados++;
    } catch (error) {
      if (error.code === 11000) {
        resumen.omitidos++;
        resumen.detalles.push({ fila, mensaje: `Referencia duplicada: ${datos.referencia}` });
      } else {
        resumen.errores++;
        resumen.detalles.push({ fila, mensaje: "No se pudo guardar el material" });
      }
    }
  }
  return resumen;
}

module.exports = { leerMateriales, importarFilas };
