import {
  createContext,
  useState,
  useEffect,
  useContext
} from "react";

import api from "../api";
import { AuthContext } from "./AuthContext";

export const SolicitudesContext = createContext();

export function SolicitudesProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [solicitudes, setSolicitudes] = useState([]);

  const cargarSolicitudes = async () => {
    try {
      const response = await api.get("/api/pedidos");
      setSolicitudes(response.data);
    } catch (error) {
      console.error("Error cargando pedidos:", error);
    }
  };

  useEffect(() => {
    if (!user) {
      setSolicitudes([]);
      return;
    }

    cargarSolicitudes();
  }, [user]);

  return (
    <SolicitudesContext.Provider value={{ solicitudes, setSolicitudes }}>
      {children}
    </SolicitudesContext.Provider>
  );
}

export default SolicitudesProvider;