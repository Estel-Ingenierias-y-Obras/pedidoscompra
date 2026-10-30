import { useEffect, useMemo, useState } from "react";
import BuscadorMovimiento from "./BuscadorMovimiento";
import { buscarProductos, obtenerProducto } from "../services/almacen";

export default function SelectorProducto({ value, producto, onProducto, onChange, label, disabled }) {
  const [texto, setTexto] = useState("");
  const [respuesta, setRespuesta] = useState({ texto: "", articulos: [], hayMas: false });
  const [cargando, setCargando] = useState(false), [error, setError] = useState("");
  const [errorGuardado, setErrorGuardado] = useState("");
  const termino = texto.trim();
  const requiereDetalle = Boolean(value) && !producto;
  useEffect(() => {
    let vigente = true;
    setError("");
    if (termino.length < 3 || disabled) { setCargando(false); return undefined; }
    setCargando(true);
    const temporizador = window.setTimeout(() => {
      buscarProductos(termino).then(datos => { if (vigente) setRespuesta({ texto: termino, ...datos }); })
        .catch(fallo => { if (vigente) setError(fallo.response?.data?.error || fallo.message || "No se pudo buscar el artículo."); })
        .finally(() => { if (vigente) setCargando(false); });
    }, 300);
    return () => { vigente = false; window.clearTimeout(temporizador); };
  }, [termino, disabled]);
  useEffect(() => {
    let vigente = true;
    setErrorGuardado("");
    if (!requiereDetalle) return undefined;
    obtenerProducto(value).then(item => { if (vigente) onProducto(item); })
      .catch(fallo => { if (vigente) setErrorGuardado(fallo.response?.data?.error || fallo.message); });
    return () => { vigente = false; };
  }, [value, requiereDetalle, onProducto]);
  const articulos = useMemo(() => respuesta.texto === termino && termino.length >= 3 && !error ? respuesta.articulos : [], [respuesta, termino, error]);
  const opciones = useMemo(() => {
    const items = new Map(articulos.map(item => [item.numprod, { codigo: item.numprod, referencia: item.referenciaTlm, nombre: item.descripcion }]));
    if (producto) items.set(producto.numprod, { codigo: producto.numprod, referencia: producto.referenciaTlm, nombre: producto.descripcion });
    return [...items.values()];
  }, [articulos, producto]);
  const estado = termino.length < 3 ? "Escribe al menos 3 caracteres de la referencia o descripción."
    : respuesta.texto === termino && respuesta.hayMas ? "Hay más coincidencias. Escribe más caracteres para concretar." : "";
  return <>
    <BuscadorMovimiento {...{ value, onChange, label, disabled, opciones, cargando, estado, error }} remoto onBuscar={setTexto}
      onSeleccion={opcion => {
        const item = articulos.find(p => p.numprod === opcion.codigo) || producto;
        if (item) onProducto(item);
      }} />
    {errorGuardado && <span role="alert" className="journal-error">{errorGuardado}</span>}
  </>;
}
