const { test } = require("node:test");
const assert = require("node:assert/strict");
const { frontendOrigin, configurarCors } = require("../services/webConfig");

test("normaliza el origen usado en correos y CORS", () => {
  assert.equal(frontendOrigin({}), "https://pedidoscompra.esteling.com");
  assert.equal(frontendOrigin({ FRONTEND_URL: "https://pedidoscompra.esteling.com/" }), frontendOrigin({}));
  for (const url of ["https://example.com/ruta", "https://user:pass@example.com", "file:///tmp/"]) {
    assert.throws(() => frontendOrigin({ FRONTEND_URL: url }));
  }
});

test("produccion acepta el nuevo dominio incluso con configuracion anterior y rechaza terceros", () => {
  const cors = configurarCors({ NODE_ENV: "production", FRONTEND_URL: "https://pedidoscompra-backend.onrender.com/" });
  for (const origin of [undefined, "https://pedidoscompra.esteling.com", "https://pedidoscompra-backend.onrender.com"]) {
    cors.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  }
  for (const origin of ["https://evil.example", "http://localhost:3000", "https://pedidoscompra.esteling.com.evil.example"]) {
    cors.origin(origin, error => assert.equal(error.status, 403));
  }
});
