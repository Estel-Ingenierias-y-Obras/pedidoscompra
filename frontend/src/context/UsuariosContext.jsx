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

  useEffect(() => {
    let cancelado = false;
    setUsuarios([]);
    if (!["Admin", "Comprador"].includes(user?.rol)) {
      return;
    }

    const cargarUsuarios = async () => {
      try {
        const endpoint = user.rol === "Comprador" ? "/api/usuarios/compradores" : "/api/usuarios";
        const response = await api.get(endpoint);
        if (!cancelado) setUsuarios(response.data);
      } catch (error) {
        if (!cancelado) console.error("Error cargando usuarios:", error);
      }
    };
    cargarUsuarios();
    return () => { cancelado = true; };
  }, [user]);

  return (
    <UsuariosContext.Provider value={{ usuarios, setUsuarios }}>
      {children}
    </UsuariosContext.Provider>
  );
}
