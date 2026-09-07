import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartPlus, faPlus } from "@fortawesome/free-solid-svg-icons";
import DeleteIconButton from "./DeleteIconButton";
import { useContext, useId, useState } from "react";
import { MaterialesContext } from "../context/MaterialesContext";

export const crearElementoVacio = () => ({
  materialId: null,
  elemento: "",
  cantidad: 1,
  descripcion: "",
  referencia: "",
  unidadMedida: "",
  descripcionMaterial: ""
});

export const normalizarElementos = elementos =>
  (Array.isArray(elementos) ? elementos : [])
    .map(item => ({
      materialId: item?.materialId || null,
      elemento: String(item?.elemento || "").trim(),
      cantidad: Math.max(0.01, Number(item?.cantidad) || 1),
      descripcion: String(item?.descripcion || "").trim(),
      referencia: String(item?.referencia || "").trim(),
      unidadMedida: String(item?.unidadMedida || "").trim(),
      descripcionMaterial: String(item?.descripcionMaterial || "").trim()
    }))
    .filter(item => item.elemento);

export const elementosATexto = elementos =>
  normalizarElementos(elementos)
    .map(item => `${item.elemento}${item.referencia ? ` (${item.referencia})` : ""}: ${item.cantidad}${item.unidadMedida ? ` ${item.unidadMedida}` : ""}${item.descripcion ? ` - ${item.descripcion}` : ""}`)
    .join("\n");

export const elementosTienenVariantesValidas = elementos =>
  normalizarElementos(elementos).every(item =>
    Boolean(item.referencia) && Boolean(item.unidadMedida)
  );

export const obtenerElementosCompatibles = (elementos, textoLegacy) => {
  const normalizados = normalizarElementos(elementos);
  if (normalizados.length > 0) return normalizados;
  if (!String(textoLegacy || "").trim()) return [];

  return [{ elemento: "Solicitud original", cantidad: 1, descripcion: textoLegacy }];
};

function MaterialAutocomplete({ item, onChange, materiales }) {
  const [abierto, setAbierto] = useState(false);
  const suggestionsId = useId();
  const normalizar = valor => String(valor || "").trim().toLocaleLowerCase("es");
  const termino = normalizar(item.elemento);
  const nombresUnicos = [...new Map(
    materiales.map(material => [normalizar(material.nombre), material.nombre])
  ).values()];
  const sugerencias = termino
    ? nombresUnicos.filter(nombre => normalizar(nombre).includes(termino)).slice(0, 8)
    : nombresUnicos.slice(0, 8);

  const seleccionar = nombre => {
    const registros = materiales.filter(material => normalizar(material.nombre) === normalizar(nombre));
    const registroUnico = registros.length === 1 ? registros[0] : null;
    onChange({
      ...item,
      materialId: registroUnico?._id || null,
      catalogoSeleccionado: true,
      elemento: nombre,
      referencia: registroUnico?.referencia || "",
      unidadMedida: registroUnico?.unidadMedida || "",
      descripcionMaterial: registroUnico?.descripcion || ""
    });
    setAbierto(false);
  };

  return (
    <div className="material-autocomplete">
      <input
        type="text"
        value={item.elemento}
        placeholder="Buscar material"
        autoComplete="off"
        onFocus={() => setAbierto(true)}
        onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
        onChange={event => {
          onChange({
            ...item,
            materialId: null,
            catalogoSeleccionado: false,
            elemento: event.target.value,
            referencia: item.materialId || item.catalogoSeleccionado ? "" : item.referencia,
            unidadMedida: item.materialId || item.catalogoSeleccionado ? "" : item.unidadMedida,
            descripcionMaterial: ""
          });
          setAbierto(true);
        }}
        role="combobox"
        aria-expanded={abierto && sugerencias.length > 0}
        aria-controls={suggestionsId}
        aria-autocomplete="list"
      />
      {abierto && sugerencias.length > 0 && (
        <div className="material-suggestions" id={suggestionsId} role="listbox">
          {sugerencias.map(nombre => (
            <button
              type="button"
              role="option"
              aria-selected={normalizar(nombre) === normalizar(item.elemento)}
              key={normalizar(nombre)}
              onMouseDown={event => event.preventDefault()}
              onClick={() => seleccionar(nombre)}
            >
              <strong>{nombre}</strong>
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

  const seleccionarReferencia = (indice, referencia) => {
    const elemento = elementos[indice];
    const registro = materiales.find(material =>
      material.nombre.toLocaleLowerCase("es") === elemento.elemento.toLocaleLowerCase("es") &&
      material.referencia === referencia
    );
    onChange(elementos.map((item, index) => index === indice ? {
      ...item,
      materialId: registro?._id || null,
      referencia: registro?.referencia || "",
      unidadMedida: registro?.unidadMedida || "",
      descripcionMaterial: registro?.descripcion || ""
    } : item));
  };

  return (
    <div className="request-items-editor">
      <div className="request-items-editor-heading">
        <span>{label}</span>
        <span>{elementos.length} {elementos.length === 1 ? "elemento" : "elementos"}</span>
      </div>

      <div className="request-lines-grid" role="table" aria-label={label}>
        <div className="request-lines-header" role="row">
          <span>Material</span>
          <span>Referencia</span>
          <span>U. medida</span>
          <span>Cantidad</span>
          <span>Observación</span>
          <span className="sr-only">Eliminar</span>
        </div>
        {elementos.map((item, indice) => {
          // El ID persiste al guardar; la marca cubre la selección pendiente de referencia.
          const esCatalogo = Boolean(item.materialId || item.catalogoSeleccionado);
          const registrosMaterial = materiales.filter(material =>
            material.nombre.toLocaleLowerCase("es") === item.elemento.trim().toLocaleLowerCase("es")
          );
          const referencias = [...new Set(registrosMaterial.map(material => material.referencia))];
          const registroExacto = registrosMaterial.find(material => material.referencia === item.referencia);
          const unidadSeleccionada = registroExacto?.unidadMedida || item.unidadMedida;
          return <div className="request-line" role="row" key={item._id || indice}>
            <label className="request-line-material">
              <span>Material</span>
              <MaterialAutocomplete
                item={item}
                materiales={materiales}
                onChange={valor => onChange(elementos.map((actual, index) => index === indice ? valor : actual))}
              />
            </label>
            <label className="request-line-reference">
              <span>Referencia</span>
              {esCatalogo ? <select value={item.referencia} disabled={referencias.length === 0} onChange={event => seleccionarReferencia(indice, event.target.value)} required>
                {!item.referencia && <option value="">Seleccionar</option>}
                {item.referencia && !referencias.includes(item.referencia) && <option value={item.referencia}>{item.referencia}</option>}
                {referencias.map(referencia => <option value={referencia} key={referencia}>{referencia}</option>)}
              </select> : <input type="text" value={item.referencia || ""} onChange={event => actualizar(indice, "referencia", event.target.value)} placeholder="Referencia" required />}
            </label>
            <label className="request-line-unit">
              <span>U. medida</span>
              {esCatalogo ? <select value={unidadSeleccionada} disabled required>
                {!unidadSeleccionada && <option value="">—</option>}
                {unidadSeleccionada && <option value={unidadSeleccionada}>{unidadSeleccionada}</option>}
              </select> : <input type="text" value={item.unidadMedida || ""} onChange={event => actualizar(indice, "unidadMedida", event.target.value)} placeholder="Unidad de medida" required />}
            </label>
            <label className="request-line-quantity">
              <span>Cantidad</span>
              <input
                type="number"
                min="0.01"
                step="any"
                value={item.cantidad}
                onChange={event => actualizar(indice, "cantidad", event.target.value)}
              />
            </label>
            <label className="request-line-observation">
              <span>Observación</span>
              <input
                type="text"
                value={item.descripcion}
                placeholder="Opcional"
                onChange={event => actualizar(indice, "descripcion", event.target.value)}
              />
            </label>
            <DeleteIconButton label={`Eliminar elemento ${indice + 1}`} onClick={() => eliminar(indice)} />
          </div>;
        })}
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
        <span>Material</span><span>Referencia</span><span>Cantidad</span><span>Unidad</span>
      </div>
      {items.map((item, indice) => (
        <div className="request-items-table-row" role="row" key={`${item.elemento}-${indice}`}>
          <div><strong>{item.elemento}</strong>{item.descripcion && <small>{item.descripcion}</small>}</div>
          <span>{item.referencia || "—"}</span>
          <span>{item.cantidad}</span>
          <span>{item.unidadMedida || "—"}</span>
        </div>
      ))}
    </div>
  );
}
