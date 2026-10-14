import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const normalizar = texto => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
const etiqueta = opcion => opcion ? `${opcion.codigo}${opcion.nombre ? ` · ${opcion.nombre}` : ""}` : "";
const ALTO = 44;

export default function BuscadorMovimiento({ opciones, value, onChange, label, disabled = false }) {
  const id = useId(), input = useRef(null), lista = useRef(null), editando = useRef(false);
  const seleccion = opciones.find(opcion => opcion.codigo === value);
  const [texto, setTexto] = useState(etiqueta(seleccion));
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [posicion, setPosicion] = useState({});
  const datos = useMemo(() => opciones.map((opcion, index) => ({ opcion, index, codigo: normalizar(opcion.codigo), nombre: normalizar(opcion.nombre) })), [opciones]);
  const coincidencias = useMemo(() => {
    const busqueda = normalizar(texto);
    if (!busqueda || (value && texto === etiqueta(seleccion))) return datos;
    return datos.map(item => ({ ...item, prioridad: item.codigo === busqueda || item.nombre === busqueda ? 0 : item.codigo.startsWith(busqueda) || item.nombre.startsWith(busqueda) ? 1 : 2 }))
      .filter(item => item.codigo.includes(busqueda) || item.nombre.includes(busqueda))
      .sort((a, b) => a.prioridad - b.prioridad || a.index - b.index);
  }, [datos, texto, value, seleccion]);
  useEffect(() => { if (!editando.current) setTexto(etiqueta(seleccion)); }, [value, seleccion]);
  useEffect(() => {
    if (!abierto) return;
    const colocar = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const arriba = window.innerHeight - rect.bottom < 270 && rect.top > 270;
      setPosicion({ position: "fixed", left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(Math.max(rect.width, 320), window.innerWidth - 16) - 8)), width: Math.min(Math.max(rect.width, 320), window.innerWidth - 16), ...(arriba ? { bottom: window.innerHeight - rect.top + 3 } : { top: rect.bottom + 3 }) });
    };
    colocar();
    window.addEventListener("resize", colocar); window.addEventListener("scroll", colocar, true);
    return () => { window.removeEventListener("resize", colocar); window.removeEventListener("scroll", colocar, true); };
  }, [abierto]);
  const elegir = opcion => {
    if (!opcion) return;
    editando.current = false; setTexto(etiqueta(opcion)); setAbierto(false); onChange(opcion.codigo);
  };
  const mover = indice => {
    const siguiente = Math.max(0, Math.min(indice, coincidencias.length - 1));
    setActivo(siguiente);
    if (lista.current) {
      if (siguiente * ALTO < lista.current.scrollTop) lista.current.scrollTop = siguiente * ALTO;
      else if ((siguiente + 1) * ALTO > lista.current.scrollTop + 264) lista.current.scrollTop = (siguiente + 1) * ALTO - 264;
      setScroll(lista.current.scrollTop);
    }
  };
  const desde = Math.max(0, Math.floor(scroll / ALTO) - 2);
  const visibles = coincidencias.slice(desde, desde + 12);
  return <>
    <input ref={input} className="movement-combobox" role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={abierto} aria-controls={`${id}-lista`} aria-activedescendant={abierto && coincidencias.length ? `${id}-${activo}` : undefined} autoComplete="off" disabled={disabled} value={texto} placeholder="Seleccionar…"
      onFocus={event => { editando.current = true; setAbierto(true); setActivo(0); setScroll(0); event.target.select(); }}
      onChange={event => { editando.current = true; setTexto(event.target.value); setAbierto(true); setActivo(0); setScroll(0); if (lista.current) lista.current.scrollTop = 0; if (value) onChange(""); }}
      onBlur={() => { editando.current = false; setAbierto(false); setTexto(etiqueta(opciones.find(opcion => opcion.codigo === value))); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setAbierto(false); setTexto(etiqueta(seleccion)); editando.current = false; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!abierto) { setAbierto(true); mover(0); } else mover(activo + (event.key === "ArrowDown" ? 1 : -1)); }
        if (event.key === "Enter" && abierto) { event.preventDefault(); elegir(coincidencias[activo]?.opcion); }
        if (event.key === "Tab" && !event.shiftKey && abierto && texto.trim()) elegir(coincidencias[activo]?.opcion);
      }} />
    {abierto && !disabled && createPortal(<div ref={lista} id={`${id}-lista`} role="listbox" aria-label={`Coincidencias de ${label}`} className="movement-suggestions" style={posicion} onScroll={event => setScroll(event.currentTarget.scrollTop)}>
      {coincidencias.length ? <div style={{ height: coincidencias.length * ALTO, position: "relative" }}>{visibles.map(({ opcion }, index) => {
        const indice = desde + index;
        return <div id={`${id}-${indice}`} key={opcion.codigo} role="option" title={etiqueta(opcion)} aria-selected={indice === activo} aria-posinset={indice + 1} aria-setsize={coincidencias.length} className={indice === activo ? "movement-option active" : "movement-option"} style={{ position: "absolute", top: indice * ALTO, height: ALTO, left: 0, right: 0 }} onMouseDown={event => { event.preventDefault(); elegir(opcion); }} onClick={() => elegir(opcion)}>{etiqueta(opcion)}</div>;
      })}</div> : <div className="movement-no-matches">Sin coincidencias</div>}
    </div>, document.body)}
  </>;
}
