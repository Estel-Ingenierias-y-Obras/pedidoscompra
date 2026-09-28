const test = require("node:test");
const assert = require("node:assert/strict");
const { configuracionBC, urlProyectos, identidadBC, logSolicitudBC } = require("../services/bcConfig");
const env = { BC_TENANT_ID: "39ccbc87-eacc-4a33-bafb-312252fe0725", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_COMPANY_ID: "e2747643-9342-ed11-946f-000d3aa816c0", BC_COMPANY_NAME: "ESTEL INGENIERIA Y OBRAS", BC_ENVIRONMENT: "Production" };
test("todas las raíces siguen el entorno central y no una URL antigua", () => {
  for (const environment of ["Production", "Production-Estel-IT"]) {
    const config = { ...env, BC_ENVIRONMENT: environment, BC_API_URL: "https://example.com/Sandbox" };
    for (const url of [...Object.values(configuracionBC(config)), urlProyectos(config)]) {
      assert.ok(url.startsWith(`https://api.businesscentral.dynamics.com/v2.0/${env.BC_TENANT_ID}/${environment}/`));
    }
  }
  assert.equal(urlProyectos(env), `https://api.businesscentral.dynamics.com/v2.0/${env.BC_TENANT_ID}/Production/ODataV4/Company('ESTEL%20INGENIERIA%20Y%20OBRAS')/API_Proyectos`);
});
test("no admite un entorno ausente o una ruta que altere la raíz", () => {
  for (const environment of ["", "..", "Production/../Sandbox", "Production?x=1"]) assert.throws(() => configuracionBC({ ...env, BC_ENVIRONMENT: environment }));
  assert.throws(() => configuracionBC({ ...env, BC_COMPANY_ID: "empresa" }));
  assert.throws(() => urlProyectos({ ...env, BC_COMPANY_NAME: "" }));
  assert.ok(urlProyectos({ ...env, BC_COMPANY_NAME: "O'Brien" }).includes("O%27%27Brien"));
});
test("OAuth prioriza las credenciales BC y conserva compatibilidad", () => {
  assert.equal(identidadBC({ ...env, TENANT_ID: "otro", CLIENT_ID: "otro" }).clientId, "client");
  assert.equal(identidadBC({ TENANT_ID: env.BC_TENANT_ID, CLIENT_ID: "antiguo", CLIENT_SECRET: "secreto" }).clientId, "antiguo");
});
test("logs desactivables sin secretos ni parámetros", () => {
  const original = console.info, logs = [];
  console.info = (...args) => logs.push(args.join(" "));
  try {
    logSolicitudBC(urlProyectos(env), env);
    assert.equal(logs.length, 0);
    logSolicitudBC(`${urlProyectos(env)}?access_token=privado`, { ...env, BC_LOG_REQUESTS: "true" });
    assert.equal(logs.length, 1);
    assert.ok(logs[0].includes('"Environment":"Production"'));
    assert.ok(!logs[0].includes("privado") && !logs[0].includes("secret"));
  } finally { console.info = original; }
});
