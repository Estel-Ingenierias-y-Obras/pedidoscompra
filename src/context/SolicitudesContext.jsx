import {
  createContext,
  useState,
  useEffect
} from "react";

import axios from "axios";

export const SolicitudesContext = createContext();

export function SolicitudesProvider({ children }) {

  const [solicitudes, setSolicitudes] = useState([]);

  const cargarSolicitudes = async () => {

  try {

    const response =
      await axios.get(
        "http://localhost:5000/api/pedidos"
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