const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fallo = mensaje => Object.assign(new Error(mensaje), { status: 503, seguro: true });

function identidadBC(env = process.env) {
  const tenant = env.BC_TENANT_ID || env.TENANT_ID;
  const clientId = env.BC_CLIENT_ID || env.CLIENT_ID;
  const clientSecret = env.BC_CLIENT_SECRET || env.CLIENT_SECRET;
  if (!UUID.test(tenant || "") || !clientId || !clientSecret) throw fallo("Configura BC_TENANT_ID, BC_CLIENT_ID y BC_CLIENT_SECRET (o sus nombres anteriores sin BC_).");
  return { tenant, clientId, clientSecret, scope: env.BC_SCOPE || "https://api.businesscentral.dynamics.com/.default" };
}

function baseBC(env = process.env) {
  const environment = (env.BC_ENVIRONMENT || "").trim();
  if (!environment || /[\x00-\x1f/\\?#]/.test(environment) || [".", ".."].includes(environment)) throw fallo("Configura BC_ENVIRONMENT con el nombre exacto del entorno.");
  const { tenant } = identidadBC(env);
  return `https://api.businesscentral.dynamics.com/v2.0/${tenant}/${encodeURIComponent(environment)}`;
}

function configuracionBC(env = process.env) {
  const base = baseBC(env);
  if (!UUID.test(env.BC_COMPANY_ID || "")) throw fallo("BC_COMPANY_ID debe ser un UUID válido.");
  return { custom: `${base}/api/Estel/GestionMaterial/v1.0/companies(${env.BC_COMPANY_ID})`, standard: `${base}/api/v2.0/companies(${env.BC_COMPANY_ID})` };
}

function urlProyectos(env = process.env) {
  if (!env.BC_COMPANY_NAME) throw fallo("Configura BC_COMPANY_NAME con el nombre interno de la empresa para OData.");
  const empresa = encodeURIComponent(env.BC_COMPANY_NAME.replace(/'/g, "''")).replace(/'/g, "%27");
  return `${baseBC(env)}/ODataV4/Company('${empresa}')/API_Proyectos`;
}

function logSolicitudBC(url, env = process.env) {
  if (env.BC_LOG_REQUESTS !== "true") return;
  const destino = new URL(url);
  console.info("[BC]", JSON.stringify({ Tenant: identidadBC(env).tenant, Environment: env.BC_ENVIRONMENT,
    Company: env.BC_COMPANY_ID, URL: `${destino.origin}${destino.pathname}` }));
}

module.exports = { identidadBC, baseBC, configuracionBC, urlProyectos, logSolicitudBC };
