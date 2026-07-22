import { PublicClientApplication }
  from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: "31a2f9db-babe-446c-a24f-5171bd99324a",
    authority:
      "https://login.microsoftonline.com/39ccbc87-eacc-4a33-bafb-312252fe0725",
    redirectUri: "http://localhost:3000/redirect"
  }
};

export const msalInstance =
  new PublicClientApplication(
    msalConfig
  );