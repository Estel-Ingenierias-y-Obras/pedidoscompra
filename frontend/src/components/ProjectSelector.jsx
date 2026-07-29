import { useEffect, useMemo, useState } from "react";
import api from "../api";

function ProjectSelector({ value, onChange, inputId = "buscador-proyecto" }) {
  const [proyectos, setProyectos] = useState([]);
  const [busquedaProyecto, setBusquedaProyecto] = useState(value || "");
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);

  useEffect(() => {
    const cargarProyectos = async () => {
      try {
        const response = await api.get("/api/proyectos");

        setProyectos(
          Array.isArray(response.data)
            ? response.data
            : response.data.value || []
        );
      } catch (error) {
        console.error("Error cargando proyectos:", error);
      }
    };

    cargarProyectos();
  }, []);

  useEffect(() => {
    if (!value) {
      setBusquedaProyecto("");
      return;
    }

    const proyectoSeleccionado = proyectos.find(
      proyectoItem => proyectoItem.nomProyecto === value
    );

    setBusquedaProyecto(
      proyectoSeleccionado
        ? `${proyectoSeleccionado.nomProyecto} - ${proyectoSeleccionado.descProyecto}`
        : value
    );
  }, [proyectos, value]);

  const proyectosFiltrados = useMemo(() => {
    const terminoBusqueda = value
      ? ""
      : busquedaProyecto.trim().toLowerCase();

    return terminoBusqueda
      ? proyectos
          .map(proyectoItem => {
            const codigo =
              (proyectoItem.nomProyecto || "").toLowerCase();
            const descripcionProyecto =
              (proyectoItem.descProyecto || "").toLowerCase();

            let prioridad = 3;

            if (codigo.startsWith(terminoBusqueda)) {
              prioridad = 0;
            } else if (codigo.includes(terminoBusqueda)) {
              prioridad = 1;
            } else if (descripcionProyecto.includes(terminoBusqueda)) {
              prioridad = 2;
            }

            return {
              proyecto: proyectoItem,
              prioridad
            };
          })
          .filter(resultado => resultado.prioridad < 3)
          .sort((a, b) => a.prioridad - b.prioridad)
          .slice(0, 50)
          .map(resultado => resultado.proyecto)
      : proyectos.slice(0, 50);
  }, [busquedaProyecto, proyectos, value]);

  const seleccionarProyecto = (proyectoSeleccionado) => {
    onChange(proyectoSeleccionado.nomProyecto);
    setBusquedaProyecto(
      `${proyectoSeleccionado.nomProyecto} - ${proyectoSeleccionado.descProyecto}`
    );
    setMostrarResultados(false);
    setIndiceActivo(-1);
  };

  const manejarTecladoProyecto = (event) => {
    if (!mostrarResultados || proyectosFiltrados.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndiceActivo(indiceActual =>
        Math.min(indiceActual + 1, proyectosFiltrados.length - 1)
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndiceActivo(indiceActual =>
        Math.max(indiceActual - 1, 0)
      );
    } else if (event.key === "Enter" && indiceActivo >= 0) {
      event.preventDefault();
      seleccionarProyecto(proyectosFiltrados[indiceActivo]);
    } else if (event.key === "Escape") {
      setMostrarResultados(false);
      setIndiceActivo(-1);
    }
  };

  return (
    <div className="buscador-proyectos">
      <input
        id={inputId}
        type="search"
        placeholder="Buscar por código o descripción..."
        value={busquedaProyecto}
        onFocus={(event) => {
          setMostrarResultados(true);
          setIndiceActivo(-1);
          event.target.select();
        }}
        onChange={(event) => {
          setBusquedaProyecto(event.target.value);
          onChange("");
          setMostrarResultados(true);
          setIndiceActivo(-1);
        }}
        onKeyDown={manejarTecladoProyecto}
        onBlur={() => setMostrarResultados(false)}
        role="combobox"
        aria-expanded={mostrarResultados}
        aria-controls={`${inputId}-resultados`}
        aria-autocomplete="list"
      />

      {mostrarResultados && (
        <div
          id={`${inputId}-resultados`}
          className="resultados-proyectos"
          role="listbox"
        >
          {proyectosFiltrados.length === 0 ? (
            <div className="sin-resultados-proyectos">
              No se encontraron proyectos
            </div>
          ) : (
            proyectosFiltrados.map((proyectoItem, indice) => (
              <button
                type="button"
                key={proyectoItem.id || proyectoItem.nomProyecto}
                className={`resultado-proyecto${
                  indice === indiceActivo ? " resultado-proyecto-activo" : ""
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  seleccionarProyecto(proyectoItem);
                }}
                role="option"
                aria-selected={indice === indiceActivo}
              >
                {proyectoItem.nomProyecto} - {proyectoItem.descProyecto}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectSelector;
