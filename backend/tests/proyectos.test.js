const test = require("node:test");
const assert = require("node:assert/strict");
const { obtenerProyectos, obtenerSolicitantesActivos } = require("../services/businessCentral");
const { urlProyectos } = require("../services/bcConfig");
const env = { BC_TENANT_ID: "39ccbc87-eacc-4a33-bafb-312252fe0725", BC_CLIENT_ID: "client", BC_CLIENT_SECRET: "secret", BC_ENVIRONMENT: "Production-Estel-IT", BC_COMPANY_NAME: "ESTEL INGENIERIA Y OBRAS", BC_PROJECTS_SERVICE: "proyectos" };
test("normaliza los proyectos del sandbox y recupera las páginas siguientes", async () => {
  const urls = [];
  const datos = await obtenerProyectos({ env, token: async () => "test", request: async url => {
    urls.push(url);
    return { data: urls.length === 1 ? { value: [{ no: "P1", description: "Obra 1" }], "@odata.nextLink": "?$skiptoken=2" } : { value: [{ No: "P2", Description: "Obra 2" }] } };
  } });
  assert.deepEqual(datos.value.map(p => [p.nomProyecto, p.descProyecto]), [["P1", "Obra 1"], ["P2", "Obra 2"]]);
  assert.equal(urls[0], urlProyectos(env));
  assert.equal(urls[1], `${urls[0]}?$skiptoken=2`);
});
test("conserva los campos del contrato anterior y el servicio por defecto", async () => {
  assert.ok(urlProyectos({ ...env, BC_PROJECTS_SERVICE: undefined }).endsWith("/API_Proyectos"));
  const original = { nomProyecto: "P1", descProyecto: "Obra", estado: "Abierto" };
  const datos = await obtenerProyectos({ env, token: async () => "test", request: async () => ({ data: { value: [original] } }) });
  assert.deepEqual(datos.value, [original]);
  assert.throws(() => urlProyectos({ ...env, BC_PROJECTS_SERVICE: "../Production" }));
});
test("no envía credenciales a enlaces externos ni devuelve proyectos parciales", async () => {
  let llamadas = 0;
  await assert.rejects(obtenerProyectos({ env, token: async () => "test", request: async () => {
    llamadas++;
    return { data: { value: [{ no: "P1" }], "@odata.nextLink": "https://example.org/proyectos" } };
  } }), /paginación/);
  assert.equal(llamadas, 1);
});
test("solo abiertos excluye cerrados, bloqueados y finalizados incluso si BC no filtra", async () => {
  let filtro;
  const base = { no: "P1", description: "Obra", status: "Open", blocked: " ", complete: false };
  const resultado = await obtenerProyectos({ env, soloAbiertos: true, token: async () => "test", request: async url => {
    filtro = new URL(url).searchParams.get("$filter");
    return { data: { value: [base, { ...base, status: "Completed" }, { ...base, blocked: "All" }, { ...base, complete: true }, { no: "sin estado" }] } };
  } });
  assert.match(filtro, /status eq 'Open'/);
  assert.deepEqual(resultado.value.map(p => p.nomProyecto), ["P1"]);
});
test("solicitantes requiere persona no bloqueada vinculada a empleado activo sin baja", async () => {
  const recurso = { No: "R1", Name: "Persona", Type: "Person", Blocked: false, Privacy_Blocked: false };
  const empleado = { Resource_No: "R1", Status: "Active", Privacy_Blocked: false, Termination_Date: "0001-01-01", ALXFechaFinContrato: "0001-01-01" };
  const resultado = await obtenerSolicitantesActivos({ env, token: async () => "test", request: async url => ({ data: { value: new URL(url).pathname.endsWith("/Recursos") ? [recurso, { ...recurso, No: "R2", Blocked: true }, { ...recurso, No: "R3", Type: "Machine" }, ...["R4", "R5", "R6", "R7"].map(No => ({ ...recurso, No }))] : [empleado, { ...empleado, Resource_No: "R2" }, { ...empleado, Resource_No: "R3" }, { ...empleado, Resource_No: "R4", Status: "Inactive" }, { ...empleado, Resource_No: "R5", Status: "Terminated" }, { ...empleado, Resource_No: "R6", Termination_Date: "2000-01-01" }, { ...empleado, Resource_No: "R7", ALXFechaFinContrato: "2000-01-01" }] } }) });
  assert.deepEqual(resultado, [{ codigo: "R1", nombre: "Persona" }]);
});
