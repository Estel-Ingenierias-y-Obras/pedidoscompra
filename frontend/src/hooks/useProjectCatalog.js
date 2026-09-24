import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

// Compartir la consulta entre Pedidos e Histórico, también en StrictMode.
const cache = new Map();
const TTL = 5 * 60 * 1000;

export default function useProjectCatalog() {
  const { user } = useContext(AuthContext);
  const identidad = user?.email || user?._id;
  const [catalogo, setCatalogo] = useState([]);
  useEffect(() => {
    if (!identidad) return;
    let vigente = true;
    let entrada = cache.get(identidad);
    if (!entrada || entrada.expira < Date.now()) {
      entrada = {
        expira: Date.now() + TTL,
        promesa: api.get("/api/proyectos").then(response =>
          Array.isArray(response.data) ? response.data : response.data.value || []
        )
      };
      cache.set(identidad, entrada);
    }
    entrada.promesa.then(datos => { if (vigente) setCatalogo(datos); }).catch(() => {
      if (cache.get(identidad) === entrada) cache.delete(identidad);
      if (vigente) setCatalogo([]);
    });
    return () => { vigente = false; };
  }, [identidad]);
  return catalogo;
}
