import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import {AuthProvider} from './context/AuthContext';
import SolicitudesProvider from "./context/SolicitudesContext";
import { UsuariosProvider } from "./context/UsuariosContext";
import { MsalProvider } from "@azure/msal-react";
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
import { msalInstance } from "./authConfig";
import { MaterialesProvider } from "./context/MaterialesContext";

if (window.location.pathname === "/redirect") {
  broadcastResponseToMainFrame().catch((error) => {
    console.error("Error procesando el retorno de Microsoft:", error);
  });
} else {
  const root = ReactDOM.createRoot(
    document.getElementById("root")
  );

  root.render(

    <React.StrictMode>

      <MsalProvider instance={msalInstance}>

        <AuthProvider>

          <UsuariosProvider>

            <SolicitudesProvider>
              <MaterialesProvider>
                <App />
              </MaterialesProvider>

            </SolicitudesProvider>

          </UsuariosProvider>

        </AuthProvider>

      </MsalProvider>

    </React.StrictMode>

  );
}

