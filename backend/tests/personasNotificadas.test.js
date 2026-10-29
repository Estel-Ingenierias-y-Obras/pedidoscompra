const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const { normalizarPersonasNotificadas } = require("../utils/personasNotificadas");
const axios = require("axios");
const { sendPurchaseRequestNotification } = require("../services/emailService");

test("normaliza listas JSON y arrays, admite externos y rechaza correos inválidos", () => {
  assert.deepEqual(normalizarPersonasNotificadas('[" JUAN@empresa.com ", "externo@otra.org", "juan@empresa.com"]'), ["juan@empresa.com", "externo@otra.org"]);
  assert.deepEqual(normalizarPersonasNotificadas(), []);
  assert.deepEqual(normalizarPersonasNotificadas([]), []);
  for (const dato of ["no-json", null, {}, ["mal@"], [4], ["a@b.com\r\nBcc: otro@b.com"]]) {
    assert.throws(() => normalizarPersonasNotificadas(dato), { status: 400 });
  }
});

test("Graph conserva TO, asunto y cuerpo, y añade múltiples CC solo al correo de creación", async () => {
  const anterior = { ...process.env };
  Object.assign(process.env, { GRAPH_SENDER_EMAIL: "app@empresa.com", GRAPH_TENANT_ID: "tenant", GRAPH_CLIENT_ID: "client", GRAPH_CLIENT_SECRET: "secret", FRONTEND_URL: "https://compras.example.com" });
  const mensajes = [];
  const post = mock.method(axios, "post", async (url, payload) => {
    if (url.includes("/token")) return { data: { access_token: "token" } };
    mensajes.push(payload.message);
    return { data: {} };
  });
  try {
    const pedido = { proyecto: "Proyecto", solicitante: "Ana", fechaCreacion: "2026-10-29", descripcion: "Material", estado: "Pendiente" };
    await sendPurchaseRequestNotification(pedido, ["compras@empresa.com"]);
    await sendPurchaseRequestNotification({ ...pedido, personasNotificadas: ["juan@empresa.com", "externo@otra.org"] }, ["compras@empresa.com"]);
    assert.deepEqual(mensajes[1].toRecipients, [{ emailAddress: { address: "compras@empresa.com" } }]);
    assert.deepEqual(mensajes[1].ccRecipients, ["juan@empresa.com", "externo@otra.org"].map(address => ({ emailAddress: { address } })));
    assert.deepEqual(mensajes[0].body, mensajes[1].body);
    assert.equal(mensajes[0].subject, mensajes[1].subject);
    assert.equal(mensajes[0].ccRecipients, undefined);
  } finally { post.mock.restore(); process.env = anterior; }
});
