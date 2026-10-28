const { test } = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const Material = require("../models/Material");
const { leerMateriales, importarFilas } = require("../services/importarMateriales");

async function archivo(filas, columnas = ["Referencia", "Descripción", "Cantidad", "Coste"]) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Materiales");
  hoja.addRow(columnas);
  filas.forEach(fila => hoja.addRow(fila));
  return libro.xlsx.writeBuffer();
}

test("Excel real: ceros, decimales, filas vacías, valores incorrectos y duplicados sin sobrescribir", async () => {
  const filas = await leerMateriales(await archivo([
    [" MAT001 ", "Cable", 150, 1.25], ["mat001", "Otro", 10, 5], [],
    ["MAT002", "Tubo", 0, 0], ["MAT003", "Error", -1, 4],
    ["MAT004", "Error", 1, "2,50"], ["MAT005", "Error", 1, { formula: "1+1", result: 2 }]
  ]));
  const guardados = new Map();
  const resumen = await importarFilas(filas, { create: async datos => {
    const material = new Material(datos);
    await material.validate();
    if (guardados.has(material.referenciaNormalizada)) throw Object.assign(new Error(), { code: 11000 });
    guardados.set(material.referenciaNormalizada, datos);
  } });
  assert.deepEqual([resumen.importados, resumen.omitidos, resumen.errores], [2, 2, 3]);
  assert.equal(guardados.get("MAT001").descripcion, "Cable");
  assert.equal(guardados.get("MAT002").coste, 0);
  assert.equal(guardados.get("MAT001").referencia, "MAT001");
});

test("rechaza cabeceras incorrectas y archivos corruptos antes de crear materiales", async () => {
  await assert.rejects(leerMateriales(await archivo([], ["Nombre", "Descripción", "Cantidad", "Coste"])), /Columnas/);
  await assert.rejects(leerMateriales(Buffer.from("no es un Excel")));
});

test("acepta cabeceras en mayúsculas sin tildes y con espacios exteriores", async () => {
  for (const columnas of [
    ["REFERENCIA", "DESCRIPCION", "CANTIDAD", "COSTE"],
    [" referencia ", " DESCRIPCIÓN ", "cantidad", "Coste "]
  ]) {
    const filas = await leerMateriales(await archivo([["MAT001", "Cable", 150, 1.25]], columnas));
    assert.deepEqual(filas[0].datos, { referencia: "MAT001", descripcion: "Cable", cantidad: 150, coste: 1.25 });
  }
  await assert.rejects(leerMateriales(await archivo([], ["REFERENCIA", "CANTIDAD", "DESCRIPCION", "COSTE"])), /Columnas/);
});

test("modelo nuevo no exige nombre ni unidad y conserva datos antiguos", async () => {
  const nuevo = new Material({ referencia: "a", descripcion: "Material", cantidad: 1.5, coste: 0 });
  await nuevo.validate();
  assert.equal(nuevo.referenciaNormalizada, "A");
  const antiguo = new Material({ referencia: "b", descripcion: "Material", nombre: "Cable", unidadMedida: "Metros" });
  await antiguo.validate();
  assert.equal(antiguo.unidadMedida, "Metros");
  assert.equal(antiguo.cantidad, 0);
});

test("importa el formato de la captura con coste vacío como cero", async () => {
  const filas = await leerMateriales(await archivo([
    ["A50ZZSDDR", "COFEM base direccionable con sirena", 4],
    ["A30XZSL", "COFEM base con sirena", 1, ""],
    ["30050KMAY", "COFEM modulo master", 1, "   "],
    ["MDA1Y", "COFEM modulo salida 1 rele", 13, 0]
  ], ["REFERENCIA", "DESCRIPCION", "CANTIDAD", "COSTE"]));
  const guardados = [];
  const resumen = await importarFilas(filas, { create: async datos => {
    await new Material(datos).validate();
    guardados.push(datos);
  } });
  assert.deepEqual([resumen.importados, resumen.omitidos, resumen.errores], [4, 0, 0]);
  assert.deepEqual(guardados.map(material => material.coste), [0, 0, 0, 0]);
  assert.deepEqual(guardados.map(material => material.cantidad), [4, 1, 1, 13]);
});

test("identifica el campo incorrecto sin convertir cantidad vacía o coste inválido en cero", async () => {
  const filas = await leerMateriales(await archivo([
    ["MAT1", "Cable", null, null],
    ["MAT2", "Cable", 1, -2],
    ["MAT3", "Cable", 1, "texto"],
    ["MAT4", "Cable", 1, { formula: "1+1", result: 2 }]
  ]));
  assert.match(filas[0].error, /^Cantidad:/);
  filas.slice(1).forEach(fila => assert.match(fila.error, /^Coste:/));
});

test("cantidad usa el resultado numérico guardado de fórmulas, incluidos cero y decimales", async () => {
  const filas = await leerMateriales(await archivo([
    ["MAT1", "Cable", { formula: "SUM(2,3)", result: 5 }, null],
    ["MAT2", "Tubo", { formula: "1-1", result: 0 }, null],
    ["MAT3", "Pieza", { formula: "5/2", result: 2.5 }, null],
    ["MAT4", "Pieza", { sharedFormula: "C2", result: 8 }, null]
  ]));
  const guardados = [];
  const resumen = await importarFilas(filas, { create: async datos => {
    await new Material(datos).validate();
    guardados.push(datos);
  } });
  assert.deepEqual([resumen.importados, resumen.errores], [4, 0]);
  assert.deepEqual(guardados.map(material => material.cantidad), [5, 0, 2.5, 8]);
});

test("rechaza fórmulas de cantidad sin resultado, con error, texto o resultado negativo", async () => {
  const filas = await leerMateriales(await archivo([
    ["MAT1", "Cable", { formula: "SUM(2,3)" }, null],
    ["MAT2", "Cable", { formula: "1/0", result: { error: "#DIV/0!" } }, null],
    ["MAT3", "Cable", { formula: '"texto"', result: "texto" }, null],
    ["MAT4", "Cable", { formula: "1-2", result: -1 }, null]
  ]));
  filas.forEach(fila => {
    assert.equal(fila.datos, undefined);
    assert.match(fila.error, /Cantidad:.*Recalcula y guarda/);
  });
});
