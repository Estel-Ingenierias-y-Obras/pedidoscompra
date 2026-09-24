import { useMemo, useState } from "react";
import OrderSearch from "./OrderSearch";
import useProjectCatalog from "../hooks/useProjectCatalog";

const proyectoDe = pedido => (pedido.proyecto || "Sin proyecto").trim();
const solicitanteDe = pedido => String(pedido.email || pedido.solicitante || "Sin solicitante").trim().toLowerCase();

export function useOrderFilters(pedidos) {
  const catalogo = useProjectCatalog();
  const [seleccionId, setSeleccionId] = useState("");
  const opciones = useMemo(() => {
    const proyectos = new Map();
    const solicitantes = new Map();
    const descripciones = new Map(catalogo.map(proyecto => [proyecto.nomProyecto, proyecto.descProyecto]));
    pedidos.forEach(pedido => {
      const proyecto = proyectoDe(pedido);
      const descripcion = descripciones.get(proyecto);
      proyectos.set(proyecto, {
        id: `proyecto:${proyecto}`, tipo: "Proyecto", value: proyecto,
        terminos: [descripcion, proyecto].filter(Boolean),
        label: descripcion ? `${proyecto} - ${descripcion}` : proyecto
      });
      const solicitante = solicitanteDe(pedido);
      solicitantes.set(solicitante, {
        id: `solicitante:${solicitante}`, tipo: "Solicitante", value: solicitante,
        label: pedido.solicitante || pedido.email || "Sin solicitante"
      });
    });
    const nombres = new Map();
    solicitantes.forEach(opcion => nombres.set(opcion.label, (nombres.get(opcion.label) || 0) + 1));
    solicitantes.forEach(opcion => {
      if (nombres.get(opcion.label) > 1) opcion.label += ` (${opcion.value})`;
    });
    return [...proyectos.values(), ...solicitantes.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" })
    );
  }, [pedidos, catalogo]);
  const seleccion = opciones.find(opcion => opcion.id === seleccionId);
  const filtrados = useMemo(() => !seleccion ? pedidos : pedidos.filter(pedido =>
    (seleccion.tipo === "Proyecto" ? proyectoDe(pedido) : solicitanteDe(pedido)) === seleccion.value
  ), [pedidos, seleccion]);
  return { opciones, seleccion, filtrados, seleccionar: setSeleccionId };
}

export default function OrderFilters({ filtros, onChange }) {
  return <OrderSearch opciones={filtros.opciones} seleccion={filtros.seleccion} onChange={id => {
    filtros.seleccionar(id);
    onChange();
  }} />;
}
