jest.mock("@azure/msal-browser", () => ({ PublicClientApplication: jest.fn() }));

test("el callback mantiene el origen actual aunque quede configurado el dominio antiguo", () => {
  process.env.REACT_APP_ENTRA_REDIRECT_URI = "https://pedidoscompra-backend.onrender.com/redirect";
  const { msalConfig } = require("./authConfig");
  expect(msalConfig.auth.redirectUri).toBe(`${window.location.origin}/redirect`);
  delete process.env.REACT_APP_ENTRA_REDIRECT_URI;
});
