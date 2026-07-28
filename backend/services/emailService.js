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

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  const parts = Object.fromEntries(
    dateFormatter
      .formatToParts(date)
      .map(({ type, value: partValue }) => [type, partValue])
  );

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};

const SEPARATOR = "--------------------------------------------------";

const buildFooter = () => [
  SEPARATOR,
  "Este mensaje ha sido generado automáticamente por",
  "la plataforma de gestión de compras.",
  SEPARATOR
];

const buildPurchaseRequestBody = (pedido, frontendUrl) => [
  SEPARATOR,
  "NUEVA SOLICITUD DE COMPRA",
  SEPARATOR,
  "",
  "Se ha registrado una nueva solicitud de compra en la plataforma.",
  "",
  "Solicitante:",
  pedido.solicitante || "",
  "",
  "Email:",
  pedido.email || "",
  "",
  "Proyecto:",
  pedido.proyecto || "",
  "",
  "Prioridad:",
  pedido.urgente ? "Urgente" : "Normal",
  "",
  "Fecha:",
  formatDate(pedido.fechaCreacion),
  "",
  SEPARATOR,
  "",
  "Acceso a la plataforma:",
  frontendUrl,
  "",
  ...buildFooter()
].join("\n");

const buildStatusChangeBody = (pedido, frontendUrl) => [
  SEPARATOR,
  "ACTUALIZACIÓN DE SOLICITUD DE COMPRA",
  SEPARATOR,
  "",
  "Se ha actualizado el estado de una solicitud de compra.",
  "",
  "Solicitante:",
  pedido.solicitante || "",
  "",
  "Proyecto:",
  pedido.proyecto || "",
  "",
  "Nuevo estado:",
  pedido.estado || "",
  "",
  "Fecha de actualización:",
  formatDate(),
  "",
  SEPARATOR,
  "",
  "Acceso a la plataforma:",
  frontendUrl,
  "",
  ...buildFooter()
].join("\n");

const buildAccessApprovedBody = (rol, frontendUrl) => [
  SEPARATOR,
  "ACCESO APROBADO",
  SEPARATOR,
  "",
  "Tu solicitud de acceso ha sido aprobada.",
  "",
  "Ya puedes acceder a la plataforma utilizando",
  "tu cuenta corporativa de Microsoft 365.",
  "",
  "Rol asignado:",
  rol,
  "",
  "Acceso a la plataforma:",
  frontendUrl,
  "",
  ...buildFooter()
].join("\n");

const sendMail = async ({
  recipient,
  subject,
  body,
  startMessage,
  successMessage
}) => {
  const sender = requiredEnv("GRAPH_SENDER_EMAIL");
  const accessToken = await getAccessToken();

  console.log(startMessage);
  await axios.post(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{
          emailAddress: { address: recipient }
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
  console.log(successMessage);
};

const sendPurchaseRequestNotification = async (pedido) => {
  const frontendUrl = requiredEnv("FRONTEND_URL");

  await sendMail({
    recipient: requiredEnv("NOTIFICATION_EMAIL"),
    subject: `Nueva solicitud de compra - ${pedido.proyecto}`,
    body: buildPurchaseRequestBody(pedido, frontendUrl),
    startMessage: `[EMAIL] Enviando notificación del pedido ${pedido._id}`,
    successMessage:
      `[EMAIL] Notificación enviada correctamente para el pedido ${pedido._id}`
  });
};

const sendStatusChangeNotification = async (pedido) => {
  const frontendUrl = requiredEnv("FRONTEND_URL");

  await sendMail({
    recipient: pedido.email,
    subject: `Actualización de solicitud de compra - ${pedido.proyecto}`,
    body: buildStatusChangeBody(pedido, frontendUrl),
    startMessage:
      `[EMAIL] Enviando actualización de estado del pedido ${pedido._id}`,
    successMessage:
      `[EMAIL] Actualización de estado enviada para el pedido ${pedido._id}`
  });
};

const sendAccessApprovedNotification = async ({ email, rol }) => {
  const frontendUrl = requiredEnv("FRONTEND_URL");

  await sendMail({
    recipient: email,
    subject: "Acceso aprobado - Plataforma de Compras",
    body: buildAccessApprovedBody(rol, frontendUrl),
    startMessage: `[EMAIL] Enviando acceso aprobado a ${email}`,
    successMessage: `[EMAIL] Acceso aprobado enviado a ${email}`
  });
};

module.exports = {
  sendPurchaseRequestNotification,
  sendStatusChangeNotification,
  sendAccessApprovedNotification
};
