const axios = require("axios");

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
};

const getAccessToken = async () => {
  const tenantId = requiredEnv("GRAPH_TENANT_ID");
  const body = new URLSearchParams({
    client_id: requiredEnv("GRAPH_CLIENT_ID"),
    client_secret: requiredEnv("GRAPH_CLIENT_SECRET"),
    scope: GRAPH_SCOPE,
    grant_type: "client_credentials"
  });
  console.log("[EMAIL] Obteniendo token Microsoft Graph");
  const response = await axios.post(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    body.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return response.data.access_token;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toISOString();
};

const buildBody = (pedido) => [
  "Nueva solicitud de compra recibida.", "",
  "Solicitante:", pedido.solicitante || "", "",
  "Email:", pedido.email || "", "",
  "Proyecto:", pedido.proyecto || "", "",
  "Urgente:", pedido.urgente ? "Sí" : "No", "",
  "Motivo de urgencia:", pedido.motivoUrgencia || "", "",
  "Descripción:", pedido.descripcion || "", "",
  "Número de adjuntos:", String((pedido.archivos || []).length), "",
  "Fecha:", formatDate(pedido.fechaCreacion)
].join("\n");

const sendPurchaseRequestNotification = async (pedido) => {
  const sender = requiredEnv("GRAPH_SENDER_EMAIL");
  const accessToken = await getAccessToken();

  console.log(`[EMAIL] Enviando notificación del pedido ${pedido._id}`);
  await axios.post(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      message: {
        subject: `Nueva solicitud de compra - ${pedido.proyecto}`,
        body: { contentType: "Text", content: buildBody(pedido) },
        toRecipients: [{
          emailAddress: { address: requiredEnv("NOTIFICATION_EMAIL") }
        }]
      },
      saveToSentItems: true
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );
  console.log(
    `[EMAIL] Notificación enviada correctamente para el pedido ${pedido._id}`
  );
};

module.exports = { sendPurchaseRequestNotification };
