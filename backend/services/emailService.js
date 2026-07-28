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

const COLORS = {
  navy: "#17324D",
  blue: "#0F6CBD",
  amber: "#C9862B",
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  border: "#E5E9EE",
  text: "#1F2937",
  textMuted: "#5F6B7A"
};

const BADGE_COLORS = {
  neutral: { background: "#EEF1F4", text: "#4B5563" },
  pending: { background: "#FFF4CE", text: "#8A6100" },
  assigned: { background: "#E6F2FA", text: "#0F548C" },
  progress: { background: "#F3E8FF", text: "#5C2E91" },
  completed: { background: "#DFF6DD", text: "#0B6A0B" },
  rejected: { background: "#FDE7E9", text: "#A4262C" }
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const getStatusColors = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "pendiente") return BADGE_COLORS.pending;
  if (["pedido", "asignado"].includes(normalized)) {
    return BADGE_COLORS.assigned;
  }
  if (["recibido", "en curso"].includes(normalized)) {
    return BADGE_COLORS.progress;
  }
  if (["entregado", "completado"].includes(normalized)) {
    return BADGE_COLORS.completed;
  }
  if (normalized === "rechazado") return BADGE_COLORS.rejected;

  return BADGE_COLORS.neutral;
};

const buildBadge = (value, colors) => `
  <span style="display:inline-block;padding:5px 10px;border-radius:999px;background-color:${colors.background};color:${colors.text};font-size:12px;font-weight:600;line-height:16px;">
    ${escapeHtml(value)}
  </span>`;

const buildInfoRows = (rows) => rows.map((row) => {
  const value = row.badgeColors
    ? buildBadge(row.value, row.badgeColors)
    : `<span style="color:${COLORS.text};font-size:15px;font-weight:600;line-height:22px;">${escapeHtml(row.value)}</span>`;

  return `
    <tr>
      <td class="info-cell" style="padding:14px 18px;border-bottom:1px solid ${COLORS.border};">
        <div style="margin-bottom:4px;color:${COLORS.textMuted};font-size:12px;font-weight:600;line-height:16px;text-transform:uppercase;letter-spacing:0.4px;">
          ${escapeHtml(row.label)}
        </div>
        ${value}
      </td>
    </tr>`;
}).join("");

const buildButton = (frontendUrl) => {
  const safeUrl = escapeHtml(frontendUrl);

  return `
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:44px;v-text-anchor:middle;width:230px;" arcsize="10%" stroke="f" fillcolor="${COLORS.blue}">
      <w:anchorlock/>
      <center style="color:#FFFFFF;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;">Acceder a la plataforma</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a href="${safeUrl}" target="_blank" style="display:inline-block;min-width:198px;padding:12px 16px;border-radius:6px;background-color:${COLORS.blue};color:#FFFFFF;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;line-height:20px;text-align:center;text-decoration:none;">
      Acceder a la plataforma
    </a>
    <!--<![endif]-->`;
};

const buildCorporateEmail = ({
  preheader,
  title,
  paragraphs,
  rows,
  frontendUrl
}) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .mobile-padding { padding-left: 22px !important; padding-right: 22px !important; }
      .info-cell { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.background};font-family:'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.background}" style="width:100%;background-color:${COLORS.background};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-container" style="width:600px;max-width:600px;background-color:${COLORS.surface};">
          <tr>
            <td bgcolor="${COLORS.navy}" style="padding:24px 32px;background-color:${COLORS.navy};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="color:#FFFFFF;font-size:23px;font-weight:700;line-height:28px;letter-spacing:0.4px;">ESTEL</td>
                  <td align="right" style="color:#DCE8F2;font-size:11px;font-weight:600;line-height:16px;letter-spacing:1px;">PLATAFORMA DE COMPRAS</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td height="4" bgcolor="${COLORS.amber}" style="height:4px;background-color:${COLORS.amber};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:38px 42px 18px;">
              <h1 style="margin:0 0 18px;color:${COLORS.navy};font-size:26px;font-weight:700;line-height:34px;">${escapeHtml(title)}</h1>
              ${paragraphs.map((paragraph) => `
                <p style="margin:0 0 12px;color:${COLORS.textMuted};font-size:15px;line-height:23px;">${escapeHtml(paragraph)}</p>`).join("")}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:4px 42px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.surfaceMuted}" style="width:100%;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.surfaceMuted};border-collapse:separate;overflow:hidden;">
                ${buildInfoRows(rows)}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="mobile-padding" style="padding:2px 42px 38px;">
              ${buildButton(frontendUrl)}
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#EEF2F6" class="mobile-padding" style="padding:22px 42px;background-color:#EEF2F6;border-top:1px solid ${COLORS.border};">
              <p style="margin:0 0 5px;color:${COLORS.textMuted};font-size:12px;line-height:18px;">Este mensaje ha sido generado automáticamente.</p>
              <p style="margin:0;color:${COLORS.navy};font-size:12px;font-weight:600;line-height:18px;">ESTEL · Plataforma de Gestión de Compras</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const buildPurchaseRequestBody = (pedido, frontendUrl) =>
  buildCorporateEmail({
    preheader: `Nueva solicitud registrada para ${pedido.proyecto || ""}`,
    title: "Nueva solicitud de compra",
    paragraphs: [
      "Se ha registrado una nueva solicitud de compra en la plataforma."
    ],
    rows: [
      { label: "Solicitante", value: pedido.solicitante || "" },
      { label: "Email", value: pedido.email || "" },
      { label: "Proyecto", value: pedido.proyecto || "" },
      {
        label: "Prioridad",
        value: pedido.urgente ? "Urgente" : "Normal",
        badgeColors: pedido.urgente
          ? BADGE_COLORS.pending
          : BADGE_COLORS.assigned
      },
      { label: "Fecha", value: formatDate(pedido.fechaCreacion) }
    ],
    frontendUrl
  });

const buildStatusChangeBody = (pedido, frontendUrl) =>
  buildCorporateEmail({
    preheader:
      `La solicitud ${pedido.proyecto || ""} ahora está ${pedido.estado || ""}`,
    title: "Actualización de solicitud de compra",
    paragraphs: [
      "Se ha actualizado el estado de una solicitud de compra."
    ],
    rows: [
      { label: "Solicitante", value: pedido.solicitante || "" },
      { label: "Proyecto", value: pedido.proyecto || "" },
      {
        label: "Nuevo estado",
        value: pedido.estado || "",
        badgeColors: getStatusColors(pedido.estado)
      },
      { label: "Fecha de actualización", value: formatDate() }
    ],
    frontendUrl
  });

const buildAccessApprovedBody = (rol, frontendUrl) =>
  buildCorporateEmail({
    preheader: "Ya puedes acceder a la Plataforma de Compras",
    title: "Acceso aprobado",
    paragraphs: [
      "Tu solicitud de acceso ha sido aprobada.",
      "Ya puedes acceder a la plataforma utilizando tu cuenta corporativa de Microsoft 365."
    ],
    rows: [{
      label: "Rol asignado",
      value: rol,
      badgeColors: BADGE_COLORS.completed
    }],
    frontendUrl
  });

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
        body: { contentType: "HTML", content: body },
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
