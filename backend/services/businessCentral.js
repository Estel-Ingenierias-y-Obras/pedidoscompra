const axios = require("axios");
const { identidadBC, urlProyectos, logSolicitudBC } = require("./bcConfig");

async function obtenerToken() {
  const config = identidadBC();

  const response = await axios.post(
    `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: config.scope,
      grant_type: "client_credentials"
    }),
    {
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      proxy: false,
      timeout: 15000,
      maxRedirects: 0
    }
  );

  return response.data.access_token;
}

async function obtenerProyectos() {
  const url = urlProyectos();

  const token = await obtenerToken();

  logSolicitudBC(url);
  const response = await axios.get(
    url,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      proxy: false,
      timeout: 15000,
      maxRedirects: 0
    }
  );

  return response.data;
}

module.exports = {
  obtenerToken,
  obtenerProyectos
};
