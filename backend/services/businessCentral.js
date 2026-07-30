const axios = require("axios");

async function obtenerToken() {

  const response = await axios.post(
    `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      scope: process.env.BC_SCOPE,
      grant_type: "client_credentials"
    }),
    {
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      proxy: false
    }
  );

  return response.data.access_token;
}

async function obtenerProyectos() {

  const token = await obtenerToken();

  const response = await axios.get(
    process.env.BC_API_URL,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      proxy: false
    }
  );

  return response.data;
}

module.exports = {
  obtenerProyectos
};
