import { useId, useRef, useState } from "react";

const normalizar = texto => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

export function predecirOpcion(opciones, texto) {
  const termino = normalizar(texto);
  if (!termino) return null;
  let mejor = null;
  opciones.forEach(opcion => {
    [...new Set([...(opcion.terminos || []), opcion.label])].forEach(valor => {
      const candidato = normalizar(valor);
      const prioridad = candidato === termino ? 0 : candidato.startsWith(termino) ? 1 : candidato.includes(termino) ? 2 : 3;
      if (prioridad === 3) return;
      // Orden alfabético estable en empates, independiente del orden de carga.
      if (!mejor || prioridad < mejor.prioridad || (prioridad === mejor.prioridad &&
        `${opcion.label}:${opcion.id}`.localeCompare(`${mejor.opcion.label}:${mejor.opcion.id}`, "es", { sensitivity: "base" }) < 0)) {
        mejor = { opcion, valor, prioridad };
      }
    });
  });
  return mejor;
}

export default function OrderSearch({ opciones, seleccion, onChange }) {
  const id = useId();
  const inputRef = useRef(null);
  const [texto, setTexto] = useState("");
  const [completado, setCompletado] = useState(null);
  const [enFoco, setEnFoco] = useState(false);
  const [alFinal, setAlFinal] = useState(true);
  const [componiendo, setComponiendo] = useState(false);
  const [descartada, setDescartada] = useState(false);
  const [scroll, setScroll] = useState(0);
  const sugerencia = !seleccion && enFoco && alFinal && !componiendo && !descartada
    ? predecirOpcion(opciones, texto) : null;
  const valor = seleccion ? (completado?.id === seleccion.id ? completado.valor : seleccion.label) : texto;
  const esPrefijo = sugerencia && normalizar(sugerencia.valor).startsWith(normalizar(texto));
  // Una coincidencia interior no puede expresarse como sufijo sin cambiar lo escrito.
  const resto = sugerencia ? (esPrefijo
    ? sugerencia.valor.slice(texto.trim().length)
    : ` → ${sugerencia.valor}`) : "";
  const aceptar = () => {
    if (!sugerencia) return;
    setCompletado({ id: sugerencia.opcion.id, valor: sugerencia.valor });
    onChange(sugerencia.opcion.id);
    setTexto("");
    setScroll(0);
    inputRef.current?.focus();
  };
  const actualizarCursor = event => {
    setAlFinal(event.target.selectionStart === event.target.value.length && event.target.selectionEnd === event.target.value.length);
  };

  return (
    <div className="order-search" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setEnFoco(false);
    }}>
      <label htmlFor={id}>Buscar proyecto o solicitante</label>
      <div className="order-search-input">
        <div className="order-search-field">
          <div className="order-search-ghost" aria-hidden="true">
            <span style={{ transform: `translateX(-${scroll}px)` }}>
              <span className="order-search-written">{valor}</span>{resto}
            </span>
          </div>
          <input ref={inputRef} id={id} type="text" autoComplete="off" spellCheck={false}
            autoCapitalize="none" enterKeyHint="go" aria-autocomplete="inline" aria-describedby={`${id}-ayuda`}
            placeholder="Escribe un proyecto o un nombre..." value={valor}
            onFocus={event => { setEnFoco(true); actualizarCursor(event); }}
            onSelect={actualizarCursor}
            onScroll={event => setScroll(event.target.scrollLeft)}
            onCompositionStart={() => setComponiendo(true)}
            onCompositionEnd={event => { setComponiendo(false); actualizarCursor(event); }}
            onChange={event => {
              setTexto(event.target.value);
              if (seleccion) onChange("");
              setDescartada(false);
              setEnFoco(true);
              actualizarCursor(event);
            }}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing || componiendo) return;
              if (event.key === "Escape") setDescartada(true);
              if (((event.key === "Tab" && !event.shiftKey) || event.key === "Enter") && sugerencia) {
                event.preventDefault();
                aceptar();
              }
            }} />
        </div>
      </div>
      <span id={`${id}-ayuda`} className="sr-only" role="status" aria-live="polite">
        {seleccion ? `${seleccion.tipo} seleccionado: ${seleccion.label}` : sugerencia
          ? `${sugerencia.opcion.tipo}: ${sugerencia.opcion.label}`
          : texto.trim() && enFoco && !componiendo && !descartada && !predecirOpcion(opciones, texto)
            ? "No se encontraron proyectos ni solicitantes." : ""}
      </span>
    </div>
  );
}
