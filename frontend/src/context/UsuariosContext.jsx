import {
  createContext,
  useState,
  useEffect,
  useContext
} from "react";

import api from "../api";
import { AuthContext } from "./AuthContext";

export const UsuariosContext = createContext();

export function UsuariosProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [usuarios, setUsuarios] = useState([]);

  const cargarUsuarios = async () => {
    try {
      const response = await api.get("/api/usuarios");
      setUsuarios(response.data);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    }
  };

  useEffect(() => {
    if (!["Admin", "Comprador"].includes(user?.rol)) {
      setUsuarios([]);
      return;
    }

    cargarUsuarios();
  }, [user?.rol]);

  return (
    <UsuariosContext.Provider value={{ usuarios, setUsuarios }}>
      {children}
    </UsuariosContext.Provider>
  );
}