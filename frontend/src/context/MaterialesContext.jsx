import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import api from "../api";

export const MaterialesContext = createContext({ materiales: [], recargarMateriales: async () => {} });

export function MaterialesProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [materiales, setMateriales] = useState([]);

  const recargarMateriales = useCallback(async () => {
    if (!user) return;
    const response = await api.get("/api/materiales");
    setMateriales(response.data);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMateriales([]);
      return;
    }
    recargarMateriales().catch(error => console.error("Error cargando materiales:", error));
  }, [user, recargarMateriales]);

  return (
    <MaterialesContext.Provider value={{ materiales, recargarMateriales }}>
      {children}
    </MaterialesContext.Provider>
  );
}
