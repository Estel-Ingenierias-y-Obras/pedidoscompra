import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { puedeAcceder, rutaInicio } from "./permissions";
import { AuthContext } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { user } = useContext(AuthContext);
  const { pathname } = useLocation();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!puedeAcceder(user.rol, pathname)) {
    return <Navigate to={rutaInicio(user.rol)} replace />;
  }

  return children;
}

export default ProtectedRoute;
