import axios from "axios";
import { msalInstance } from "./authConfig";

const api = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "http://localhost:5000")
});

const TOKEN_REFRESH_MARGIN_SECONDS = 120;
const SESSION_EXPIRED_FLAG = "sessionExpired";

const finalizarSesionExpirada = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("microsoftAuthToken");
  sessionStorage.setItem(SESSION_EXPIRED_FLAG, "1");

  if (window.location.pathname !== "/") {
    window.location.assign("/");
  }
};

const decodificarPayloadJwt = (token) => {
  try {
    const payload = String(token || "").split(".")[1];

    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);

    return JSON.parse(json);
  } catch (_) {
    return null;
  }
};

const tokenNecesitaRenovacion = (token) => {
  const payload = decodificarPayloadJwt(token);

  if (!payload?.exp) {
    return true;
  }

  const ahora = Math.floor(Date.now() / 1000);
  return payload.exp <= ahora + TOKEN_REFRESH_MARGIN_SECONDS;
};

const obtenerCuentaMicrosoft = () => {
  const cuentaActiva = msalInstance.getActiveAccount();

  if (cuentaActiva) {
    return cuentaActiva;
  }

  const cuentas = msalInstance.getAllAccounts();
  const primeraCuenta = cuentas[0];

  if (primeraCuenta) {
    msalInstance.setActiveAccount(primeraCuenta);
  }

  return primeraCuenta;
};

const obtenerTokenMicrosoftActual = async () => {
  const tokenGuardado = localStorage.getItem("microsoftAuthToken");

  if (tokenGuardado && !tokenNecesitaRenovacion(tokenGuardado)) {
    return tokenGuardado;
  }

  const account = obtenerCuentaMicrosoft();

  if (!account) {
    finalizarSesionExpirada();
    return null;
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      account,
      scopes: ["openid", "profile", "email"]
    });

    const tokenRenovado = response.idToken || tokenGuardado;

    if (tokenRenovado) {
      localStorage.setItem("microsoftAuthToken", tokenRenovado);
    }

    return tokenRenovado;
  } catch (error) {
    console.error("Error renovando token Microsoft:", error);
    finalizarSesionExpirada();
    return null;
  }
};

api.interceptors.request.use(async (config) => {
  const microsoftAuthToken = await obtenerTokenMicrosoftActual();

  config.headers = config.headers || {};

  if (microsoftAuthToken) {
    config.headers.Authorization = `Bearer ${microsoftAuthToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      finalizarSesionExpirada();
    }

    return Promise.reject(error);
  }
);

export default api;
