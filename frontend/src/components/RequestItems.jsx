import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartPlus, faPlus } from "@fortawesome/free-solid-svg-icons";
import DeleteIconButton from "./DeleteIconButton";
import { useContext, useId, useState } from "react";
import { MaterialesContext } from "../context/MaterialesContext";

export const crearElementoVacio = () => ({ elemento: "", cantidad: 1, descripcion: "" });

export const normalizarElementos = elementos =>
  (Array.isArray(elementos) ? elementos : [])
    .map(item => ({
      elemento: String(item?.elemento || "").trim(),
      cantidad: Math.max(1, Number(item?.cantidad) || 1),
      descripcion: String(item?.descripcion || "").trim()
    }))
    .filter(item => item.elemento);

export const elementosATexto = elementos =>
  normalizarElementos(elementos)
    .map(item => `${item.elemento} (${item.cantidad})${item.descripcion ? ` - ${item.descripcion}` : ""}`)
    .join("\n");

export const obtenerElementosCompatibles = (elementos, textoLegacy) => {
  const normalizados = normalizarElementos(elementos);
  if (normalizados.length > 0) return normalizados;
  if (!String(textoLegacy || "").trim()) return [];

  return [{ elemento: "Solicitud original", cantidad: 1, descripcion: textoLegacy }];
};

function MaterialAutocomplete({ value, onChange, materiales }) {
  const [abierto, setAbierto] = useState(false);
  const suggestionsId = useId();
  const termino = String(value || "").trim().toLocaleLowerCase("es");
  const sugerencias = termino
    ? materiales.filter(material => material.nombre.toLocaleLowerCase("es").includes(termino)).slice(0, 6)
    : materiales.slice(0, 6);

  return (
    <div className="material-autocomplete">
      <input
        type="text"
        value={value}
        placeholder="Ej. Monitor"
        autoComplete="off"
        onFocus={() => setAbierto(true)}
        onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
        onChange={event => { onChange(event.target.value); setAbierto(true); }}
        role="combobox"
        aria-expanded={abierto && sugerencias.length > 0}
        aria-controls={suggestionsId}
        aria-autocomplete="list"
      />
      {abierto && sugerencias.length > 0 && (
        <div className="material-suggestions" id={suggestionsId} role="listbox">
          {sugerencias.map(material => (
            <button
              type="button"
              role="option"
              aria-selected={material.nombre === value}
              key={material._id}
              onMouseDown={event => event.preventDefault()}
              onClick={() => { onChange(material.nombre); setAbierto(false); }}
            >
              <strong>{material.nombre}</strong>
              {material.categoria && <span>{material.categoria}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RequestItemsEditor({ value, onChange, label = "Elementos solicitados" }) {
  const { materiales } = useContext(MaterialesContext);
  const elementos = Array.isArray(value) ? value : [];

  const actualizar = (indice, campo, valor) => {
    onChange(elementos.map((item, index) =>
      index === indice ? { ...item, [campo]: valor } : item
    ));
  };

  const eliminar = indice => onChange(elementos.filter((_, index) => index !== indice));

  return (
    <div className="request-items-editor">
      <div className="request-items-editor-heading">
        <span>{label}</span>
        <span>{elementos.length} {elementos.length === 1 ? "elemento" : "elementos"}</span>
      </div>

      <div className="request-items-editor-list">
        {elementos.map((item, indice) => (
          <div className="request-item-row" key={item._id || indice}>
            <span className="request-item-index">{indice + 1}</span>
            <label>
              <span>Elemento</span>
              <MaterialAutocomplete
                value={item.elemento}
                materiales={materiales}
                onChange={valor => actualizar(indice, "elemento", valor)}
              />
            </label>
            <label className="request-item-quantity">
              <span>Cantidad</span>
              <input
                type="number"
                min="1"
                step="1"
                value={item.cantidad}
                onChange={event => actualizar(indice, "cantidad", event.target.value)}
              />
            </label>
            <label>
              <span>Descripción breve (opcional)</span>
              <input
                type="text"
                value={item.descripcion}
                placeholder="Ej. 24 pulgadas"
                onChange={event => actualizar(indice, "descripcion", event.target.value)}
              />
            </label>
            <DeleteIconButton label={`Eliminar elemento ${indice + 1}`} onClick={() => eliminar(indice)} />
          </div>
        ))}
      </div>

      {elementos.length === 0 && (
        <div className="request-items-empty">
          <FontAwesomeIcon icon={faCartPlus} />
          <span>Añade los materiales o servicios que necesitas.</span>
        </div>
      )}

      <button
        type="button"
        className="request-item-add"
        onClick={() => onChange([...elementos, crearElementoVacio()])}
      >
        <FontAwesomeIcon icon={faPlus} />
        Añadir elemento
      </button>
    </div>
  );
}

export function RequestItemsList({ elementos, textoLegacy }) {
  const items = normalizarElementos(elementos);

  if (items.length === 0) {
    return <p className="request-items-legacy">{textoLegacy || "Sin contenido"}</p>;
  }

  return (
    <div className="request-items-table" role="table" aria-label="Elementos solicitados">
      <div className="request-items-table-header" role="row">
        <span>Elemento</span><span>Cantidad</span><span>Descripción</span>
      </div>
      {items.map((item, indice) => (
        <div className="request-items-table-row" role="row" key={`${item.elemento}-${indice}`}>
          <strong>{item.elemento}</strong>
          <span>{item.cantidad}</span>
          <span>{item.descripcion || "—"}</span>
        </div>
      ))}
    </div>
  );
}
