import {
  createContext,
  useState,
  useEffect
} from "react";

import api from "../api";

export const SolicitudesContext = createContext();

export function SolicitudesProvider({ children }) {

  const [solicitudes, setSolicitudes] = useState([]);

  const cargarSolicitudes = async () => {

  try {

    const response =
      await api.get(
        "/api/pedidos"
      );

    setSolicitudes(response.data);

  } catch (error) {

    console.error(
      "Error cargando pedidos:",
      error
    );

  }

};

useEffect(() => {

  cargarSolicitudes();

}, []);

  return (
    <SolicitudesContext.Provider
      value={{
        solicitudes,
        setSolicitudes
      }}
    >
      {children}
    </SolicitudesContext.Provider>
  );
}

export default SolicitudesProvider;