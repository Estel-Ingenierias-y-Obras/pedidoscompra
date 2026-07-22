import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";
import ProtectedRoute from "./routes/ProtectedRoute";
import NuevaSolicitud from "./pages/NuevaSolicitud";
import MisSolicitudes from "./pages/MisSolicitudes";
import ValidarSolicitudes from "./pages/ValidarSolicitudes";
import Configuracion from "./pages/Configuracion";
import "./App.css";
import HistoricoPedidos from "./pages/HistoricoPedidos";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/usuarios"
        element={
          <ProtectedRoute>
          <Usuarios />
          </ProtectedRoute>
          } />
        <Route path="/nuevasolicitud"
        element={
          <ProtectedRoute>
          <NuevaSolicitud />
          </ProtectedRoute>
          } />
        <Route path="/missolicitudes"
          element={
          <ProtectedRoute>
          <MisSolicitudes />
          </ProtectedRoute>
          } />
        <Route path="/validar-solicitudes"
          element={
          <ProtectedRoute>
          <ValidarSolicitudes />
          </ProtectedRoute>
          } />
        <Route path="/configuracion"
          element={
          <ProtectedRoute>
          <Configuracion />
          </ProtectedRoute>
          } />
        <Route path="/historico-pedidos"
            element={
            <ProtectedRoute>
            <HistoricoPedidos />
            </ProtectedRoute>
          }/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;