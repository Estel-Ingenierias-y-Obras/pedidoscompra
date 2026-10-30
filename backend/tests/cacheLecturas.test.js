const { test } = require("node:test");
const assert = require("node:assert/strict");
const { crearCacheLecturas } = require("../utils/cacheLecturas");

test("comparte peticiones simultáneas, cuenta TTL desde el éxito y separa claves", async () => {
  let tiempo = 0, cargas = 0, resolver;
  const cache = crearCacheLecturas({ ttl: 10, ahora: () => tiempo });
  const cargar = () => { cargas++; return new Promise(resolve => { resolver = resolve; }); };
  const primera = cache("empresa-1", cargar);
  await Promise.resolve();
  tiempo = 20;
  assert.equal(cache("empresa-1", cargar), primera);
  resolver(["completo"]);
  assert.deepEqual(await primera, ["completo"]);
  tiempo = 29;
  assert.equal(cache("empresa-1", cargar), primera);
  assert.equal(cargas, 1);
  assert.equal(await cache("empresa-2", () => "otra empresa"), "otra empresa");
  tiempo = 31;
  assert.equal(await cache("empresa-1", () => "nuevo"), "nuevo");
});

test("un error no queda en caché y el siguiente intento vuelve a consultar", async () => {
  const cache = crearCacheLecturas({ ttl: 1000 });
  await assert.rejects(cache("catalogo", () => { throw new Error("BC sin conexión"); }));
  assert.equal(await cache("catalogo", () => "recuperado"), "recuperado");
});

test("limita las claves retenidas y una expulsión no altera la promesa ya entregada", async () => {
  const cache = crearCacheLecturas({ ttl: 1000, maxEntradas: 2 });
  let resolver;
  const primera = cache("A", () => new Promise(resolve => { resolver = resolve; }));
  await Promise.resolve();
  await cache("B", () => "B"); await cache("C", () => "C");
  resolver("A original");
  assert.equal(await primera, "A original");
  assert.equal(await cache("A", () => "A nueva"), "A nueva");
});
