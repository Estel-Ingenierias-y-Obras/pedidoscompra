const crypto = require("crypto");
const Usuario = require("../models/Usuario");

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
let jwksCache = {
  expiresAt: 0,
  keys: []
};

const escaparRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decodificarBase64Url = (value) =>
  Buffer.from(
    String(value || "").replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );

const decodificarJsonBase64Url = (value) =>
  JSON.parse(decodificarBase64Url(value).toString("utf8"));

const obtenerJwks = async () => {
  const ahora = Date.now();

  if (jwksCache.keys.length > 0 && jwksCache.expiresAt > ahora) {
    return jwksCache.keys;
  }

  const tenantId = process.env.TENANT_ID;

  if (!tenantId) {
    throw new Error("TENANT_ID no está configurado");
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
  );

  if (!response.ok) {
    throw new Error("No se pudieron obtener las claves públicas de Microsoft");
  }

  const data = await response.json();
  jwksCache = {
    expiresAt: ahora + JWKS_CACHE_TTL_MS,
    keys: Array.isArray(data.keys) ? data.keys : []
  };

  return jwksCache.keys;
};

const validarTokenMicrosoft = async (token) => {
  const partes = String(token || "").split(".");

  if (partes.length !== 3) {
    throw new Error("Token JWT no válido");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = partes;
  const header = decodificarJsonBase64Url(encodedHeader);
  const payload = decodificarJsonBase64Url(encodedPayload);

  if (header.alg !== "RS256") {
    throw new Error("Algoritmo de firma no permitido");
  }

  const keys = await obtenerJwks();
  const jwk = keys.find(key => key.kid === header.kid);

  if (!jwk) {
    throw new Error("Clave pública Microsoft no encontrada para el token");
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const firmaValida = verifier.verify(publicKey, decodificarBase64Url(encodedSignature));

  if (!firmaValida) {
    throw new Error("Firma del token no válida");
  }

  const tenantId = process.env.TENANT_ID;
  const clientId = process.env.CLIENT_ID;
  const issuerEsperado = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const ahora = Math.floor(Date.now() / 1000);

  if (payload.tid !== tenantId) {
    throw new Error("Tenant del token no permitido");
  }

  if (payload.iss !== issuerEsperado) {
    throw new Error("Issuer del token no permitido");
  }

  if (payload.aud !== clientId) {
    throw new Error("Audience del token no permitida");
  }

  if (payload.exp && payload.exp <= ahora) {
    throw new Error("Token expirado");
  }

  if (payload.nbf && payload.nbf > ahora) {
    throw new Error("Token todavía no válido");
  }

  const email = String(
    payload.preferred_username ||
    payload.email ||
    payload.upn ||
    ""
  ).trim().toLowerCase();

  if (!email) {
    throw new Error("No se pudo extraer el email del token");
  }

  return {
    email,
    tenantId: payload.tid,
    audience: payload.aud,
    issuer: payload.iss
  };
};

const buscarUsuarioAutorizado = async (email) =>
  Usuario.findOne({
    email: {
      $regex: `^${escaparRegex(email)}$`,
      $options: "i"
    },
    activo: { $ne: false }
  });

const obtenerUsuarioActual = async (req, res, next) => {
  const authorization = String(req.get("authorization") || "").trim();
  const bearerPrefix = "Bearer ";
  let email = "";
  let metodoAutenticacion = "";

  try {
    if (authorization.startsWith(bearerPrefix)) {
      const token = authorization.slice(bearerPrefix.length).trim();
      const identidad = await validarTokenMicrosoft(token);
      email = identidad.email;
      metodoAutenticacion = "token";
      console.log(`[AUTH] Usuario autenticado mediante token Microsoft: ${email}`);
    } else {
      email = String(req.get("x-user-email") || "").trim().toLowerCase();
      metodoAutenticacion = "compatibilidad";

      if (email) {
        console.warn(`[AUTH] Usuario autenticado mediante compatibilidad temporal x-user-email: ${email}`);
      }
    }

    if (!email) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const usuario = await buscarUsuarioAutorizado(email);

    if (!usuario) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.usuarioActual = usuario;
    req.metodoAutenticacion = metodoAutenticacion;
    next();
  } catch (error) {
    console.error("[AUTH] Token Microsoft rechazado:", error.message);
    res.status(403).json({ error: "Forbidden" });
  }
};

const permitirRoles = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuarioActual || !rolesPermitidos.includes(req.usuarioActual.rol)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};

module.exports = {
  obtenerUsuarioActual,
  permitirRoles,
  validarTokenMicrosoft
};