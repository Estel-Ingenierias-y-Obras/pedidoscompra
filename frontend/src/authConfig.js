import { PublicClientApplication }
  from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId:
      process.env.REACT_APP_ENTRA_CLIENT_ID ||
      "31a2f9db-babe-446c-a24f-5171bd99324a",
    authority:
      `https://login.microsoftonline.com/${
        process.env.REACT_APP_ENTRA_TENANT_ID ||
        "39ccbc87-eacc-4a33-bafb-312252fe0725"
      }`,
    // El bridge usa BroadcastChannel: debe compartir origen con la ventana principal.
    redirectUri: `${window.location.origin}/redirect`
  }
};

export const msalInstance =
  new PublicClientApplication(
    msalConfig
  );
