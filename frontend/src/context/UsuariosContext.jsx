import {
  createContext,
  useState,
  useEffect
} from "react";

import api from "../api";

export const UsuariosContext = createContext();

export function UsuariosProvider({ children }) {

  const [usuarios, setUsuarios] =
  useState([]);

  const cargarUsuarios = async () => {

  try {

    const response =
      await api.get(
        "/api/usuarios"
      );

    setUsuarios(response.data);

  } catch (error) {

    console.error(
      "Error cargando usuarios:",
      error
    );

  }

};

useEffect(() => {

  cargarUsuarios();

}, []);


  return (
    <UsuariosContext.Provider
      value={{
        usuarios,
        setUsuarios
      }}
    >
      {children}
    </UsuariosContext.Provider>
  );
}
